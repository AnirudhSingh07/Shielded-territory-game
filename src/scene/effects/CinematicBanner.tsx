import { useEffect, useState } from 'react';
import { Html } from '@react-three/drei';
import { formatZec } from '../../utils/format';

interface Props {
  position: [number, number, number];
  amountZec: number;
  side: 'shield' | 'transparent';
  txHash: string;
  onDone: () => void;
}

const LIFETIME_MS = 3200;

/**
 * A big, in-scene floating readout for major real transactions — directly
 * inspired by the dramatic "$530.3K" wall-size banners on zec-battlefield's
 * order-book war. Ours reads a real on-chain ZEC amount instead of a
 * synthetic order-book wall, and links out to the transaction.
 */
export default function CinematicBanner({ position, amountZec, side, txHash, onDone }: Props) {
  const [visible, setVisible] = useState(true);
  const isShield = side === 'shield';

  useEffect(() => {
    const fadeTimer = setTimeout(() => setVisible(false), LIFETIME_MS - 500);
    const doneTimer = setTimeout(onDone, LIFETIME_MS);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Html position={position} center distanceFactor={22} zIndexRange={[10, 0]} pointerEvents="none">
      <a
        href={`https://blockchair.com/zcash/transaction/${txHash}`}
        target="_blank"
        rel="noopener noreferrer"
        className={`pointer-events-auto block w-max -translate-y-16 select-none rounded-md border px-5 py-3 text-center backdrop-blur-md transition-all duration-500 ${
          visible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        } ${isShield ? 'border-shield/60 bg-shield/10 shadow-[0_0_30px_rgba(0,229,160,0.35)]' : 'border-crimson/60 bg-crimson/10 shadow-[0_0_30px_rgba(255,59,92,0.35)]'}`}
      >
        <div className={`font-display text-[11px] font-semibold tracking-[0.3em] uppercase ${isShield ? 'text-shield' : 'text-crimson-glow'}`}>
          {isShield ? 'Shielded' : 'Unshielded'}
        </div>
        <div className={`font-cinematic text-3xl font-bold tracking-wide ${isShield ? 'text-shield' : 'text-crimson-glow'}`} style={{ textShadow: '0 0 20px currentColor' }}>
          {formatZec(amountZec, { compact: true })} ZEC
        </div>
      </a>
    </Html>
  );
}
