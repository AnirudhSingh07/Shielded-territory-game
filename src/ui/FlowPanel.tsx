import type { FlowWindow, WarState } from '../types';
import { formatSignedZec } from '../utils/format';
import SourceBadge from './SourceBadge';

function coverageLabel(w: FlowWindow): string {
  if (!w.partial) return `${w.txCount} real tx`;
  const coveredH = w.coverageMs / 3_600_000;
  const label = coveredH < 1 ? `${Math.round(w.coverageMs / 60_000)}m` : `${coveredH.toFixed(1)}h`;
  return `${w.txCount} real tx · ${label} so far`;
}

function FlowRow({ label, window }: { label: string; window: FlowWindow }) {
  const positive = window.netZec >= 0;
  return (
    <div className="flex items-center justify-between py-1.5">
      <div>
        <div className="text-[11px] tracking-wide text-ink-dim uppercase">{label}</div>
        <div className="text-[9px] text-ink-faint">{coverageLabel(window)}</div>
      </div>
      <span className={`font-mono text-sm font-medium ${positive ? 'text-shield' : 'text-crimson-glow'}`}>{formatSignedZec(window.netZec)}</span>
    </div>
  );
}

export default function FlowPanel({ state }: { state: WarState }) {
  return (
    <div className="panel hud-clip pointer-events-auto w-64 p-3 sm:w-72 sm:p-4">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="font-display text-[11px] font-semibold tracking-[0.2em] text-ink-dim uppercase">Net Shielding Flow</h2>
        <SourceBadge status={state.sources.flows} title="Summed from real individual on-chain transactions" />
      </div>
      <div className="divide-y divide-line/60">
        <FlowRow label="1 hour" window={state.flows.h1} />
        <FlowRow label="24 hours" window={state.flows.h24} />
        <FlowRow label="7 days" window={state.flows.d7} />
      </div>
    </div>
  );
}
