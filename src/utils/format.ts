export function formatZec(zec: number, opts: { compact?: boolean } = {}): string {
  const abs = Math.abs(zec);
  if (opts.compact && abs >= 1000) {
    return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(zec);
  }
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(zec);
}

export function formatSignedZec(zec: number): string {
  const sign = zec > 0 ? '+' : zec < 0 ? '−' : '';
  return `${sign}${formatZec(Math.abs(zec), { compact: true })} ZEC`;
}

export function formatPct(fraction: number, digits = 1): string {
  return `${(fraction * 100).toFixed(digits)}%`;
}

export function formatUsd(v: number | null, opts: { compact?: boolean } = {}): string {
  if (v == null) return '—';
  if (opts.compact) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 2 }).format(v);
  }
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(v);
}

export function formatRelativeTime(msAgo: number): string {
  const s = Math.round(msAgo / 1000);
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return `${h}h ago`;
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
