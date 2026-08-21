import type { WarState } from '../types';
import { formatSignedZec } from '../utils/format';
import SourceBadge from './SourceBadge';

function FlowRow({ label, netZec, estimated }: { label: string; netZec: number; estimated: boolean }) {
  const positive = netZec >= 0;
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-[11px] tracking-wide text-ink-dim uppercase">{label}</span>
      <span className={`font-mono text-sm font-medium ${positive ? 'text-shield' : 'text-crimson-glow'}`}>
        {formatSignedZec(netZec)}
        {estimated && <span className="ml-1 text-[9px] text-ink-faint align-top">est.</span>}
      </span>
    </div>
  );
}

export default function FlowPanel({ state }: { state: WarState }) {
  return (
    <div className="panel hud-clip pointer-events-auto w-64 p-3 sm:w-72 sm:p-4">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="font-display text-[11px] font-semibold tracking-[0.2em] text-ink-dim uppercase">Net Shielding Flow</h2>
        <SourceBadge status={state.sources.flows} title="Modeled from shielded-fraction dynamics; see README" />
      </div>
      <div className="divide-y divide-line/60">
        <FlowRow label="1 hour" netZec={state.flows.h1.netZec} estimated={state.flows.h1.estimated} />
        <FlowRow label="24 hours" netZec={state.flows.h24.netZec} estimated={state.flows.h24.estimated} />
        <FlowRow label="7 days" netZec={state.flows.d7.netZec} estimated={state.flows.d7.estimated} />
      </div>
    </div>
  );
}
