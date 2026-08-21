import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import TransactionCourier from './TransactionCourier';
import CannonFlash from './CannonFlash';
import { isMajorEvent, magnitudeToEffectScale, SHIELD_FORT_X, TRANSPARENT_FORT_X } from '../../logic/mapping';
import type { BattleEvent } from '../../types';
import { useUIStore } from '../../state/uiStore';
import { playAlertHit, playCannonBoom, playShieldChime } from '../../audio/soundManager';
import { triggerShake } from '../cameraShake';

interface Props {
  events: BattleEvent[];
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
  major: boolean;
}

interface LiveFlash {
  key: string;
  position: [number, number, number];
  color: THREE.ColorRepresentation;
  scale: number;
}

const MAX_CONCURRENT = 10;
const GATE_Z_SPREAD = 2.6;

function gatePoint(x: number): [number, number, number] {
  return [x, 0.3, (Math.random() - 0.5) * GATE_Z_SPREAD];
}

/**
 * Watches the real transaction feed and spawns one courier per newly-seen
 * event, running the length of the field between the two forts — this is
 * the literal, visible "a real shielding/unshielding transaction just
 * happened" moment. Large transactions additionally get a cannon-flash
 * launch and a camera shake for extra "war effect" punch.
 */
export default function EventEffectsManager({ events, shieldColor, transparentColor }: Props) {
  // Couriers + flashes are kept as one state object (rather than two separate useState calls)
  // so a new batch of real events triggers exactly one re-render, not two.
  const [live, setLive] = useState<{ couriers: LiveCourier[]; flashes: LiveFlash[] }>({ couriers: [], flashes: [] });
  const seenIds = useRef<Set<string>>(new Set());
  const soundOn = useUIStore((s) => s.soundOn);
  const intensity = useUIStore((s) => s.intensity);

  useEffect(() => {
    if (events.length === 0) return;
    const fresh = events.filter((e) => !seenIds.current.has(e.id));
    if (fresh.length === 0) return;
    fresh.forEach((e) => seenIds.current.add(e.id));

    const intensityMul = intensity === 'low' ? 0.5 : intensity === 'high' ? 1.6 : 1;
    const newCouriers: LiveCourier[] = [];
    const newFlashes: LiveFlash[] = [];

    fresh.slice(0, 4).forEach((e) => {
      const { particles, scale } = magnitudeToEffectScale(e.magnitude);
      const isShield = e.side === 'shield';
      const color = isShield ? shieldColor : transparentColor;
      const fromX = isShield ? TRANSPARENT_FORT_X : SHIELD_FORT_X;
      const toX = isShield ? SHIELD_FORT_X : TRANSPARENT_FORT_X;
      const from = gatePoint(fromX);
      const to = gatePoint(toX);
      const major = isMajorEvent(e.magnitude);

      newCouriers.push({ key: e.id, from, to, color, particleCount: Math.round(particles * intensityMul), scale: scale * intensityMul, major });

      if (major) {
        newFlashes.push({ key: `${e.id}_flash`, position: from, color, scale: scale * intensityMul });
        triggerShake(0.35 + e.magnitude * 0.5);
      }

      if (soundOn) {
        if (major) playCannonBoom(e.magnitude);
        else if (isShield) playShieldChime(e.magnitude);
        else playAlertHit(e.magnitude);
      }
    });

    setLive((prev) => ({
      couriers: [...prev.couriers, ...newCouriers].slice(-MAX_CONCURRENT),
      flashes: newFlashes.length ? [...prev.flashes, ...newFlashes].slice(-MAX_CONCURRENT) : prev.flashes,
    }));
    // Deliberately keyed on `events` only — colors/sound/intensity are read at spawn-time via closure.
  }, [events]);

  return (
    <>
      {live.couriers.map((c) => (
        <TransactionCourier
          key={c.key}
          from={c.from}
          to={c.to}
          color={c.color}
          scale={c.scale}
          particleCount={c.particleCount}
          onDone={() => setLive((prev) => ({ ...prev, couriers: prev.couriers.filter((f) => f.key !== c.key) }))}
        />
      ))}
      {live.flashes.map((f) => (
        <CannonFlash
          key={f.key}
          position={f.position}
          color={f.color}
          scale={f.scale}
          onDone={() => setLive((prev) => ({ ...prev, flashes: prev.flashes.filter((x) => x.key !== f.key) }))}
        />
      ))}
    </>
  );
}
