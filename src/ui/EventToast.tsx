import { useEffect, useRef, useState } from 'react';
import type { BattleEvent } from '../types';

interface Toast extends BattleEvent {
  toastId: number;
}

let counter = 0;

/** Rising, fading banner announcements for large flow events — the "cinematic" call-outs. */
export default function EventToast({ events }: { events: BattleEvent[] }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seenIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    const fresh = events.filter((e) => !seenIds.current.has(e.id) && e.magnitude > 0.3);
    if (fresh.length === 0) return;
    fresh.forEach((e) => seenIds.current.add(e.id));
    const newToasts = fresh.slice(0, 2).map((e) => ({ ...e, toastId: counter++ }));
    setToasts((prev) => [...prev, ...newToasts]);
    newToasts.forEach((t) => {
      setTimeout(() => setToasts((prev) => prev.filter((x) => x.toastId !== t.toastId)), 6000);
    });
  }, [events]);

  return (
    <div className="pointer-events-none fixed top-20 left-1/2 z-30 flex -translate-x-1/2 flex-col items-center gap-2 sm:top-24">
      {toasts.map((t) => (
        <div
          key={t.toastId}
          className={`animate-rise-fade rounded-full border px-5 py-2 font-display text-xs font-bold tracking-[0.12em] uppercase backdrop-blur-md ${
            t.side === 'shield' ? 'border-shield/50 bg-shield/10 text-shield' : 'border-crimson/50 bg-crimson/10 text-crimson-glow'
          }`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
