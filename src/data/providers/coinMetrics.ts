/**
 * CoinMetrics Community API — REAL, LIVE data source.
 *
 * Free tier, no API key, CORS-enabled (verified). Gives us Zcash's true
 * circulating supply (`SplyCur`) at daily resolution. This is the one number
 * in the whole app that is unambiguously "real total ZEC supply right now" —
 * everything shielded/transparent-split related is layered on top of it by
 * the simulation engine (see src/data/providers/simulation.ts) because no
 * free, CORS-enabled API currently exposes the live Sprout/Sapling/Orchard
 * value-pool breakdown.
 *
 * Docs: https://docs.coinmetrics.io/api/v4
 */

const ENDPOINT = 'https://community-api.coinmetrics.io/v4/timeseries/asset-metrics';

export interface CoinMetricsSupplyPoint {
  time: string;
  totalSupply: number;
}

const FETCH_TIMEOUT_MS = 8000;

async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`CoinMetrics HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** Fetches the last `days` of total ZEC circulating supply. Throws on any failure. */
export async function fetchZecSupplyHistory(days = 10): Promise<CoinMetricsSupplyPoint[]> {
  const url = `${ENDPOINT}?assets=zec&metrics=SplyCur&frequency=1d&page_size=${days}&sort=time&order=descending`;
  const json = (await fetchJson(url)) as {
    data?: Array<{ time: string; SplyCur?: string }>;
    error?: { message: string };
  };
  if (json.error) throw new Error(json.error.message);
  const rows = json.data ?? [];
  if (rows.length === 0) throw new Error('CoinMetrics returned no supply rows');
  return rows
    .filter((r) => r.SplyCur != null)
    .map((r) => ({ time: r.time, totalSupply: Number(r.SplyCur) }))
    .sort((a, b) => a.time.localeCompare(b.time));
}

/** Convenience: just the latest known total supply. */
export async function fetchLatestZecSupply(): Promise<CoinMetricsSupplyPoint> {
  const history = await fetchZecSupplyHistory(3);
  return history[history.length - 1];
}
