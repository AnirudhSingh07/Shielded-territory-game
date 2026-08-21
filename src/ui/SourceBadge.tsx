import type { SourceStatus } from '../types';

const CONFIG: Record<SourceStatus, { label: string; dot: string; text: string }> = {
  live: { label: 'LIVE', dot: 'bg-shield', text: 'text-shield' },
  stale: { label: 'STALE', dot: 'bg-gold', text: 'text-gold' },
  simulated: { label: 'SIMULATED', dot: 'bg-ink-dim', text: 'text-ink-dim' },
  loading: { label: 'SYNCING', dot: 'bg-ink-dim', text: 'text-ink-dim' },
  error: { label: 'OFFLINE', dot: 'bg-crimson-glow', text: 'text-crimson-glow' },
};

export default function SourceBadge({ status, title }: { status: SourceStatus; title?: string }) {
  const c = CONFIG[status];
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-full border border-line px-1.5 py-0.5 text-[9px] font-mono tracking-widest ${c.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot} ${status === 'live' ? 'animate-pulse-soft' : ''}`} />
      {c.label}
    </span>
  );
}
