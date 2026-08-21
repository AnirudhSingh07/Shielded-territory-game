import type { ReactNode } from 'react';
import { useUIStore, type EffectIntensity } from '../state/uiStore';
import { startAmbient, startBattleAmbience, stopAmbient, stopBattleAmbience } from '../audio/soundManager';

const INTENSITIES: EffectIntensity[] = ['low', 'normal', 'high'];

function IconButton({ active, onClick, label, children }: { active?: boolean; onClick: () => void; label: string; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={`flex h-8 w-8 items-center justify-center rounded-md border text-sm transition-colors ${
        active ? 'border-shield/50 bg-shield/10 text-shield' : 'border-line text-ink-dim hover:border-ink-faint hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}

export default function Controls() {
  const soundOn = useUIStore((s) => s.soundOn);
  const toggleSound = useUIStore((s) => s.toggleSound);
  const intensity = useUIStore((s) => s.intensity);
  const setIntensity = useUIStore((s) => s.setIntensity);
  const resetCamera = useUIStore((s) => s.resetCamera);

  const handleToggleSound = () => {
    if (!soundOn) {
      startAmbient();
      startBattleAmbience();
    } else {
      stopAmbient();
      stopBattleAmbience();
    }
    toggleSound();
  };

  return (
    <div className="panel hud-clip pointer-events-auto flex items-center gap-2 p-2">
      <IconButton active={soundOn} onClick={handleToggleSound} label={soundOn ? 'Mute sound' : 'Enable sound'}>
        {soundOn ? '🔊' : '🔇'}
      </IconButton>
      <IconButton onClick={resetCamera} label="Reset camera view">
        ⟲
      </IconButton>
      <div className="mx-1 h-5 w-px bg-line" />
      <div className="flex items-center gap-1" role="group" aria-label="Effect intensity">
        {INTENSITIES.map((i) => (
          <button
            key={i}
            onClick={() => setIntensity(i)}
            className={`rounded px-2 py-1 font-mono text-[10px] tracking-wide uppercase transition-colors ${
              intensity === i ? 'bg-shield/15 text-shield' : 'text-ink-faint hover:text-ink-dim'
            }`}
          >
            {i}
          </button>
        ))}
      </div>
    </div>
  );
}
