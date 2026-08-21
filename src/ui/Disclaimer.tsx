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
          transparent vs. shielded pool dynamics. Every courier zebra you see is a <strong className="text-ink">real, individual
          on-chain transaction</strong>, pulled straight from the chain and running to or from the Shielded Fort the moment it's
          observed — click any line in the activity feed to verify it on a block explorer. Total supply, price, and every flow
          number are live too; the one exception is the *starting point* of the shielded-territory %, which has no live public
          API and is anchored to a documented estimate, then moved only by those real transactions from then on.
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
