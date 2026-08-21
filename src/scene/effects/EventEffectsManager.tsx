import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import TransactionCourier from './TransactionCourier';
import CannonFlash from './CannonFlash';
import CinematicBanner from './CinematicBanner';
import { isMajorEvent, magnitudeToEffectScale, SHIELD_FORT_X, TRANSPARENT_FORT_X } from '../../logic/mapping';
import type { BattleEvent } from '../../types';
import { useUIStore } from '../../state/uiStore';
import { playAlertHit, playCannonBoom, playShieldChime } from '../../audio/soundManager';
import { triggerShake } from '../cameraShake';
import { requestFrontLineFocus } from '../cameraFocus';
import { vibrate } from '../haptics';
import { terrainHeight } from '../terrain/heightField';

interface Props {
  events: BattleEvent[];
  frontLineWorldX: number;
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

interface LiveBanner {
  key: string;
  position: [number, number, number];
  amountZec: number;
  side: 'shield' | 'transparent';
  txHash: string;
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
 * launch, a camera shake, and a big in-scene CinematicBanner reading the
 * real ZEC amount (inspired by zec-battlefield.eh-f01.workers.dev's
 * dollar-amount wall banners) for extra "war effect" punch.
 */
export default function EventEffectsManager({ events, frontLineWorldX, shieldColor, transparentColor }: Props) {
  const frontLineRef = useRef(frontLineWorldX);
  useEffect(() => {
    frontLineRef.current = frontLineWorldX;
  }, [frontLineWorldX]);
  // Couriers + flashes + banners are kept as one state object (rather than three separate
  // useState calls) so a new batch of real events triggers exactly one re-render.
  const [live, setLive] = useState<{ couriers: LiveCourier[]; flashes: LiveFlash[]; banners: LiveBanner[] }>({ couriers: [], flashes: [], banners: [] });
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
    const newBanners: LiveBanner[] = [];

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
        newFlashes.push({ key: `${e.id}_flash`, position: [fromX, terrainHeight(fromX, 0) + 1.6, from[2]], color, scale: scale * intensityMul });
        newBanners.push({ key: `${e.id}_banner`, position: [toX, terrainHeight(toX, 0) + 9, 0], amountZec: Math.abs(e.netZec), side: e.side, txHash: e.txHash });
        triggerShake(0.35 + e.magnitude * 0.5);
        requestFrontLineFocus(frontLineRef.current, 0.55 + e.magnitude * 0.45);
        vibrate(35 + Math.round(e.magnitude * 45)); // a real confirmed event buzzes harder than ambient impacts (normal+ intensity)
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
      banners: newBanners.length ? [...prev.banners, ...newBanners].slice(-3) : prev.banners,
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
      {live.banners.map((b) => (
        <CinematicBanner
          key={b.key}
          position={b.position}
          amountZec={b.amountZec}
          side={b.side}
          txHash={b.txHash}
          onDone={() => setLive((prev) => ({ ...prev, banners: prev.banners.filter((x) => x.key !== b.key) }))}
        />
      ))}
    </>
  );
}
