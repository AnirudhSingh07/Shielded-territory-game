export default function LoadingScreen() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-void">
      <div className="relative h-20 w-20">
        <div className="absolute inset-0 animate-spin rounded-full border-2 border-shield/20 border-t-shield" style={{ animationDuration: '1.6s' }} />
        <div className="absolute inset-2 animate-spin rounded-full border-2 border-crimson/20 border-b-crimson" style={{ animationDuration: '2.2s', animationDirection: 'reverse' }} />
        <div className="absolute inset-0 flex items-center justify-center font-display text-lg font-bold text-ink">Z</div>
      </div>
      <div className="text-center">
        <h1 className="font-display text-sm font-semibold tracking-[0.35em] text-ink uppercase">Shielded Territory War</h1>
        <p className="mt-2 font-mono text-[11px] text-ink-dim">establishing secure uplink to the front…</p>
      </div>
      <div className="h-px w-48 overflow-hidden bg-line">
        <div className="h-full w-1/3 animate-[scan_1.4s_ease-in-out_infinite] bg-shield" />
      </div>
    </div>
  );
}
