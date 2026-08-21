/**
 * Blockchair Zcash Stats API — REAL, LIVE data source.
 *
 * Free tier, no API key, CORS-enabled (verified). Used only for market /
 * network "flavor" stats (price, market cap, block height, hash rate) that
 * decorate the HUD — none of the war-simulation math depends on it, so if it
 * fails the battlefield keeps running untouched, just without the ticker.
 *
 * Docs: https://blockchair.com/api/docs#link_M
 */

const ENDPOINT = 'https://api.blockchair.com/zcash/stats';
const FETCH_TIMEOUT_MS = 8000;

export interface BlockchairStats {
  priceUsd: number | null;
  marketCapUsd: number | null;
  change24hPct: number | null;
  blockHeight: number | null;
  hashRate: number | null;
}

export async function fetchBlockchairStats(): Promise<BlockchairStats> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(ENDPOINT, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`Blockchair HTTP ${res.status}`);
    const json = (await res.json()) as {
      data?: {
        market_price_usd?: number;
        market_cap_usd?: number;
        market_price_usd_change_24h_percentage?: number;
        best_block_height?: number;
        hashrate_24h?: string;
      };
    };
    const d = json.data;
    if (!d) throw new Error('Blockchair returned no data');
    return {
      priceUsd: d.market_price_usd ?? null,
      marketCapUsd: d.market_cap_usd ?? null,
      change24hPct: d.market_price_usd_change_24h_percentage ?? null,
      blockHeight: d.best_block_height ?? null,
      hashRate: d.hashrate_24h ? Number(d.hashrate_24h) : null,
    };
  } finally {
    clearTimeout(timer);
  }
}
