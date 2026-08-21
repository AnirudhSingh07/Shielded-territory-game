import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import AirstrikeBeam from './AirstrikeBeam';
import { magnitudeToEffectScale } from '../../logic/mapping';
import type { BattleEvent } from '../../types';
import { useUIStore } from '../../state/uiStore';
import { playAlertHit, playShieldChime } from '../../audio/soundManager';

interface Props {
  events: BattleEvent[];
  frontLineWorldX: number;
  shieldColor: THREE.ColorRepresentation;
  transparentColor: THREE.ColorRepresentation;
}

interface LiveEffect {
  key: string;
  position: [number, number, number];
  color: THREE.ColorRepresentation;
  particleCount: number;
  scale: number;
}

const MAX_CONCURRENT = 6;

/** Watches the live event feed and spawns cinematic VFX for newly-seen battle events. */
export default function EventEffectsManager({ events, frontLineWorldX, shieldColor, transparentColor }: Props) {
  const [live, setLive] = useState<LiveEffect[]>([]);
  const seenIds = useRef<Set<string>>(new Set());
  const soundOn = useUIStore((s) => s.soundOn);
  const intensity = useUIStore((s) => s.intensity);

  useEffect(() => {
    if (events.length === 0) return;
    const fresh = events.filter((e) => !seenIds.current.has(e.id));
    if (fresh.length === 0) return;
    fresh.forEach((e) => seenIds.current.add(e.id));

    const intensityMul = intensity === 'low' ? 0.5 : intensity === 'high' ? 1.6 : 1;
    const spawned: LiveEffect[] = fresh.slice(0, 3).map((e) => {
      const { particles, scale } = magnitudeToEffectScale(e.magnitude);
      const dir = e.side === 'shield' ? 1 : -1;
      const x = frontLineWorldX + dir * (2 + Math.random() * 10);
      const z = (Math.random() - 0.5) * 26;
      const color = e.side === 'shield' ? shieldColor : transparentColor;
      if (soundOn) {
        if (e.side === 'shield') playShieldChime(e.magnitude);
        else playAlertHit(e.magnitude);
      }
      return {
        key: e.id,
        position: [x, 0, z],
        color,
        particleCount: Math.round(particles * intensityMul),
        scale: scale * intensityMul,
      };
    });

    setLive((prev) => [...prev, ...spawned].slice(-MAX_CONCURRENT));
    // Deliberately keyed on `events` only — frontLine/colors/sound/intensity are read
    // at spawn-time via closure and shouldn't retrigger a re-scan of the event list.
  }, [events]);

  return (
    <>
      {live.map((fx) => (
        <AirstrikeBeam
          key={fx.key}
          position={fx.position}
          color={fx.color}
          particleCount={fx.particleCount}
          scale={fx.scale}
          onDone={() => setLive((prev) => prev.filter((f) => f.key !== fx.key))}
        />
      ))}
    </>
  );
}
