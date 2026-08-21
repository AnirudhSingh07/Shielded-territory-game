/**
 * Real, PENDING (unconfirmed) Zcash transactions — REAL data, not yet final.
 *
 * Blockchair's Zcash mempool endpoint exposes the same `shielded_value_delta`
 * field as the confirmed-transactions endpoint (verified), on transactions
 * that have been broadcast but not yet mined (`block_id: -1`). Because real
 * shielding/unshielding confirmations are infrequent, polling the mempool
 * more often (every 5–8s) gives the scene a steady stream of genuine
 * incoming activity to visualize as "scouts" ahead of confirmation — still
 * 100% real on-chain data, just flagged as pending rather than confirmed.
 *
 * Docs: https://blockchair.com/api/docs
 */

const ENDPOINT = 'https://api.blockchair.com/zcash/mempool/transactions';
const FETCH_TIMEOUT_MS = 8000;

export interface PendingFlowTx {
  hash: string;
  /** first time WE observed it (the mempool `time` is broadcast time; we stamp our own for advance timing) */
  observedMs: number;
  deltaZatoshi: number;
}

interface RawRow {
  hash: string;
  shielded_value_delta: number;
}

/** Fetch pending transactions and keep only those that actually move shielded-pool value. */
export async function fetchPendingShieldedFlows(limit = 100): Promise<PendingFlowTx[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${ENDPOINT}?limit=${limit}`, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`Blockchair mempool HTTP ${res.status}`);
    const json = (await res.json()) as { data?: RawRow[] };
    const now = Date.now();
    return (json.data ?? [])
      .filter((r) => r.shielded_value_delta !== 0)
      .map((r) => ({ hash: r.hash, observedMs: now, deltaZatoshi: r.shielded_value_delta }));
  } finally {
    clearTimeout(timer);
  }
}
