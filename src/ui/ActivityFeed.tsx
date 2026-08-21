import type { BattleEvent } from '../types';
import { formatRelativeTime } from '../utils/format';
import { useNowTick } from '../hooks/useNowTick';

export default function ActivityFeed({ events }: { events: BattleEvent[] }) {
  const now = useNowTick(1000);
  const recent = events.slice(0, 12);

  return (
    <div className="panel hud-clip pointer-events-auto w-72 p-3 sm:w-80 sm:p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-display text-[11px] font-semibold tracking-[0.2em] text-ink-dim uppercase">Live Activity</h2>
        <span className="text-[9px] text-ink-faint">real on-chain tx →</span>
      </div>
      {recent.length === 0 ? (
        <p className="py-4 text-center text-xs text-ink-faint">Watching the chain for the first shielding transaction…</p>
      ) : (
        <ul className="scroll-thin max-h-48 space-y-1.5 overflow-y-auto pr-1">
          {recent.map((e) => (
            <li key={e.id} className="flex items-start gap-2 border-l-2 py-0.5 pl-2 text-xs" style={{ borderColor: e.side === 'shield' ? '#00e5a0' : '#ff3b5c' }}>
              <div className="min-w-0 flex-1">
                <a
                  href={`https://blockchair.com/zcash/transaction/${e.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block truncate text-ink hover:text-shield hover:underline"
                  title="View this transaction on Blockchair"
                >
                  {e.message}
                </a>
                <p className="text-[10px] text-ink-faint">
                  {formatRelativeTime(now - e.timestamp)} · block #{e.blockId.toLocaleString()}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
