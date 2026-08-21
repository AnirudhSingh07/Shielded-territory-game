import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import TransactionCourier from './TransactionCourier';
import { magnitudeToEffectScale } from '../../logic/mapping';
import { FORT_RADIUS } from '../../logic/mapping';
import type { BattleEvent } from '../../types';
import { useUIStore } from '../../state/uiStore';
import { playAlertHit, playShieldChime } from '../../audio/soundManager';

interface Props {
  events: BattleEvent[];
  frontRadius: number;
  shieldColor: THREE.ColorRepresentation;
  transparentColor: THREE.ColorRepresentation;
}

interface LiveCourier {
  key: string;
  from: [number, number, number];
  to: [number, number, number];
  color: THREE.ColorRepresentation;
  particleCount: number;
  scale: number;
}

const MAX_CONCURRENT = 10;

function pointOnCircle(radius: number, angle: number): [number, number, number] {
  return [Math.cos(angle) * radius, 0, Math.sin(angle) * radius];
}

/**
 * Watches the real transaction feed and spawns one courier per newly-seen
 * event — this is the literal, visible "a real shielding/unshielding
 * transaction just happened" moment, not a generic periodic effect.
 */
export default function EventEffectsManager({ events, frontRadius, shieldColor, transparentColor }: Props) {
  const [live, setLive] = useState<LiveCourier[]>([]);
  const seenIds = useRef<Set<string>>(new Set());
  const soundOn = useUIStore((s) => s.soundOn);
  const intensity = useUIStore((s) => s.intensity);

  useEffect(() => {
    if (events.length === 0) return;
    const fresh = events.filter((e) => !seenIds.current.has(e.id));
    if (fresh.length === 0) return;
    fresh.forEach((e) => seenIds.current.add(e.id));

    const intensityMul = intensity === 'low' ? 0.5 : intensity === 'high' ? 1.6 : 1;
    const spawned: LiveCourier[] = fresh.slice(0, 4).map((e) => {
      const { particles, scale } = magnitudeToEffectScale(e.magnitude);
      const angle = Math.random() * Math.PI * 2;
      const outerPoint = pointOnCircle(frontRadius + 3 + Math.random() * 9, angle + (Math.random() - 0.5) * 0.6);
      const gatePoint = pointOnCircle(FORT_RADIUS - 0.3, angle);
      const isShield = e.side === 'shield';
      const color = isShield ? shieldColor : transparentColor;
      if (soundOn) {
        if (isShield) playShieldChime(e.magnitude);
        else playAlertHit(e.magnitude);
      }
      return {
        key: e.id,
        from: isShield ? outerPoint : gatePoint,
        to: isShield ? gatePoint : outerPoint,
        color,
        particleCount: Math.round(particles * intensityMul),
        scale: scale * intensityMul,
      };
    });

    setLive((prev) => [...prev, ...spawned].slice(-MAX_CONCURRENT));
    // Deliberately keyed on `events` only — frontRadius/colors/sound/intensity are read
    // at spawn-time via closure and shouldn't retrigger a re-scan of the event list.
  }, [events]);

  return (
    <>
      {live.map((c) => (
        <TransactionCourier
          key={c.key}
          from={c.from}
          to={c.to}
          color={c.color}
          scale={c.scale}
          particleCount={c.particleCount}
          onDone={() => setLive((prev) => prev.filter((f) => f.key !== c.key))}
        />
      ))}
    </>
  );
}
