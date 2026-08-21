/**
 * Real, individual Zcash on-chain transactions — REAL, LIVE data source.
 *
 * Blockchair's Zcash transactions endpoint (free, no key, CORS-enabled,
 * verified) includes `shielded_value_delta`: the signed change in the
 * shielded value pools caused by that specific transaction (in zatoshi,
 * 1 ZEC = 1e8 zatoshi). Positive = value moved INTO the shielded pools
 * (a shielding transaction); negative = value moved OUT (an unshielding
 * transaction); zero = an ordinary fully-transparent transaction.
 *
 * This is the core "not simulated" data source for the app: every courier,
 * every activity-feed line, and every net-flow number is built by summing
 * these real per-transaction deltas — nothing here is randomly generated.
 *
 * Docs: https://blockchair.com/api/docs#link_M
 */

const ENDPOINT = 'https://api.blockchair.com/zcash/transactions';
const FETCH_TIMEOUT_MS = 10_000;

export interface RealFlowTx {
  hash: string;
  blockId: number;
  timeMs: number;
  /** Signed zatoshi delta to the shielded pools; positive = shielding, negative = unshielding. */
  deltaZatoshi: number;
}

interface RawTxRow {
  hash: string;
  block_id: number;
  time: string; // "YYYY-MM-DD HH:MM:SS", UTC, no offset suffix
  shielded_value_delta: number;
}

function parseTimeToMs(t: string): number {
  return new Date(`${t.replace(' ', 'T')}Z`).getTime();
}

async function fetchPage(limit: number, offset: number): Promise<RawTxRow[]> {
  const url = `${ENDPOINT}?s=time(desc)&limit=${limit}&offset=${offset}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`Blockchair HTTP ${res.status}`);
    const json = (await res.json()) as { data?: RawTxRow[] };
    return json.data ?? [];
  } finally {
    clearTimeout(timer);
  }
}

function toRealFlowTx(rows: RawTxRow[]): RealFlowTx[] {
  return rows
    .filter((r) => r.shielded_value_delta !== 0)
    .map((r) => ({ hash: r.hash, blockId: r.block_id, timeMs: parseTimeToMs(r.time), deltaZatoshi: r.shielded_value_delta }));
}

/** Fetch the most recent page and return only the transactions that actually moved shielded-pool value. */
export async function fetchLatestShieldedFlows(limit = 40): Promise<RealFlowTx[]> {
  return toRealFlowTx(await fetchPage(limit, 0));
}

/**
 * Walk backward through real transaction history until at least `targetMs`
 * of real wall-clock time is covered (bounded by maxPages so a slow network
 * can't hang startup — coverage then just comes up short, honestly reported
 * via the returned `coveredMs`, and grows on its own as live polling continues).
 */
export async function backfillShieldedFlows(
  targetMs: number,
  opts: { pageSize?: number; maxPages?: number } = {},
): Promise<{ events: RealFlowTx[]; coveredMs: number }> {
  const pageSize = opts.pageSize ?? 100;
  const maxPages = opts.maxPages ?? 6;
  const nowMs = Date.now();
  const collected: RealFlowTx[] = [];
  let oldestSeenMs = nowMs;

  for (let page = 0; page < maxPages; page++) {
    let rows: RawTxRow[];
    try {
      rows = await fetchPage(pageSize, page * pageSize);
    } catch {
      break; // keep whatever real history we already collected rather than failing the whole backfill
    }
    if (rows.length === 0) break;
    collected.push(...toRealFlowTx(rows));
    oldestSeenMs = parseTimeToMs(rows[rows.length - 1].time);
    if (nowMs - oldestSeenMs >= targetMs) break;
    if (rows.length < pageSize) break;
  }

  collected.sort((a, b) => a.timeMs - b.timeMs);
  return { events: collected, coveredMs: nowMs - oldestSeenMs };
}
