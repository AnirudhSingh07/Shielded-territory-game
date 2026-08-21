import { useEffect, useState } from 'react';

/** Re-renders the caller every `intervalMs` — used for "3s ago" style relative timestamps. */
export function useNowTick(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
