import type { MomentumState } from '../types';
import { momentumLabels } from '../logic/mapping';

const STYLES: Record<MomentumState, string> = {
  'privacy-surge': 'text-shield border-shield/60 shadow-[0_0_20px_rgba(0,229,160,0.35)]',
  'privacy-advancing': 'text-shield/90 border-shield/30',
  stalemate: 'text-ink-dim border-line',
  'transparent-counter': 'text-crimson-glow/90 border-crimson/30',
  'transparent-surge': 'text-crimson-glow border-crimson/60 shadow-[0_0_20px_rgba(255,59,92,0.35)]',
};

export default function MomentumBanner({ state }: { state: MomentumState }) {
  const isSurge = state === 'privacy-surge' || state === 'transparent-surge';
  return (
    <div
      className={`panel pointer-events-none flex items-center gap-2 rounded-full border px-4 py-1.5 font-display text-xs font-semibold tracking-[0.15em] uppercase transition-all duration-500 ${STYLES[state]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full bg-current ${isSurge ? 'animate-pulse-soft' : ''}`} />
      {momentumLabels[state]}
    </div>
  );
}
