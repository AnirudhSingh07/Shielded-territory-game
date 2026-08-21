import { useUIStore } from '../state/uiStore';

export default function Disclaimer() {
  const show = useUIStore((s) => s.showDisclaimer);
  const dismiss = useUIStore((s) => s.dismissDisclaimer);

  if (!show) {
    return (
      <p className="pointer-events-none fixed bottom-1 left-1/2 z-30 -translate-x-1/2 px-2 text-center font-mono text-[9px] text-ink-faint sm:bottom-2">
        Theatrical visualization of public on-chain data. Not financial advice.
      </p>
    );
  }

  return (
    <div className="pointer-events-auto fixed inset-0 z-40 flex items-end justify-center bg-void/70 p-4 backdrop-blur-sm sm:items-center">
      <div className="panel animate-flicker-in max-w-md rounded-lg p-5 text-center sm:p-6">
        <h2 className="font-display text-sm font-semibold tracking-[0.2em] text-shield uppercase">Welcome to the front</h2>
        <p className="mt-3 text-sm leading-relaxed text-ink-dim">
          <strong className="text-ink">Shielded Territory War</strong> is a live theatrical visualization of Zcash's public
          transparent vs. shielded pool dynamics, staged as a battlefield. Each <strong className="text-ink">courier soldier</strong>{' '}
          that sprints across the field is a <strong className="text-ink">real, confirmed on-chain transaction</strong>; the faint{' '}
          <strong className="text-ink">ghost scouts</strong> are real <em>pending</em> transactions still in the mempool. The green
          spire is the Shielded Growth Monument, rising with real shielding. Click any line in the activity feed to verify it on a
          block explorer. Total supply, price and every flow number are live too — the one anchored value is the <em>starting
          point</em> of the shielded-territory %, which has no live public API and is then moved only by those real transactions.
        </p>
        <p className="mt-3 font-mono text-[11px] text-ink-faint">This is not financial advice, and no wallet or trading is involved.</p>
        <button
          onClick={dismiss}
          className="mt-5 rounded-md border border-shield/40 bg-shield/10 px-5 py-2 font-display text-xs font-semibold tracking-widest text-shield uppercase transition-colors hover:bg-shield/20"
        >
          Enter the battlefield
        </button>
      </div>
    </div>
  );
}
