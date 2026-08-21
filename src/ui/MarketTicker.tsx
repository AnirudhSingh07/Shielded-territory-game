import type { MarketSnapshot, SourceStatus } from '../types';
import { formatUsd } from '../utils/format';
import SourceBadge from './SourceBadge';

export default function MarketTicker({ market, status }: { market: MarketSnapshot; status: SourceStatus }) {
  return (
    <div className="panel hud-clip pointer-events-auto flex items-center gap-3 px-3 py-1.5 font-mono text-[11px]">
      <span className="text-ink-dim">ZEC</span>
      <span className="text-ink">{formatUsd(market.priceUsd)}</span>
      {market.change24hPct != null && (
        <span className={market.change24hPct >= 0 ? 'text-shield' : 'text-crimson-glow'}>
          {market.change24hPct >= 0 ? '▲' : '▼'} {Math.abs(market.change24hPct).toFixed(1)}%
        </span>
      )}
      <span className="hidden text-ink-faint sm:inline">mkt cap {formatUsd(market.marketCapUsd, { compact: true })}</span>
      {market.blockHeight != null && <span className="hidden text-ink-faint md:inline">block #{market.blockHeight.toLocaleString()}</span>}
      <SourceBadge status={status} title="Market data source" />
    </div>
  );
}
