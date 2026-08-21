import type { WarState } from '../types';
import { formatPct, formatZec } from '../utils/format';
import SourceBadge from './SourceBadge';

export default function StatsPanel({ state }: { state: WarState }) {
  const { supply } = state;
  return (
    <div className="panel hud-clip pointer-events-auto w-64 p-3 sm:w-72 sm:p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-display text-[11px] font-semibold tracking-[0.2em] text-ink-dim uppercase">Territory Control</h2>
        <SourceBadge status={state.sources.flows} title="Baseline anchor + real observed shielding/unshielding transactions" />
      </div>

      <div className="mb-3 flex h-2.5 overflow-hidden rounded-full border border-line bg-panel-2">
        <div className="h-full bg-shield transition-[width] duration-700 ease-out" style={{ width: `${supply.shieldedFraction * 100}%` }} />
        <div className="h-full bg-crimson transition-[width] duration-700 ease-out" style={{ width: `${(1 - supply.shieldedFraction) * 100}%` }} />
      </div>

      <div className="grid grid-cols-2 gap-3 text-left">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-shield" />
            <span className="text-[10px] tracking-wide text-ink-dim uppercase">Shielded</span>
          </div>
          <div className="font-display text-xl font-semibold text-shield text-shadow-glow">{formatPct(supply.shieldedFraction)}</div>
          <div className="font-mono text-[11px] text-ink-dim">{formatZec(supply.shieldedZec, { compact: true })} ZEC</div>
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-crimson" />
            <span className="text-[10px] tracking-wide text-ink-dim uppercase">Transparent</span>
          </div>
          <div className="font-display text-xl font-semibold text-crimson-glow">{formatPct(1 - supply.shieldedFraction)}</div>
          <div className="font-mono text-[11px] text-ink-dim">{formatZec(supply.transparentZec, { compact: true })} ZEC</div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-line pt-2 text-[10px] text-ink-faint">
        <span className="flex items-center gap-1.5">
          Total supply
          <SourceBadge status={state.sources.supply} title="CoinMetrics Community API" />
        </span>
        <span className="font-mono text-ink-dim">{formatZec(supply.totalSupply, { compact: true })} ZEC</span>
      </div>
    </div>
  );
}
