import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getSoldierGeometry } from './geometry/soldierGeometry';
import { terrainHeight } from './terrain/heightField';
import { SHIELD_FORT_X, TRANSPARENT_FORT_X } from '../logic/mapping';
import type { MempoolScout } from '../types';

const ADVANCE_MS = 45_000; // how long a pending scout takes to creep from its fort toward the line
const FADE_MS = 900;

const GHOST = {
  shield: new THREE.Color('#8fe6c0'),
  transparent: new THREE.Color('#e8a6ad'),
};

/**
 * A single ghostly scout for one REAL pending (unconfirmed) mempool
 * transaction. Deliberately a different visual language from confirmed
 * units: translucent, no shadow, a faint dashed trail, and it never
 * explodes or advances past the line — it just creeps forward while the tx
 * waits to confirm. If it confirms, the engine drops it here and its full
 * confirmed courier + effects fire instead; if it drops out of the mempool,
 * it fades out. `leaving` triggers the fade-out.
 */
function Scout({ scout, frontLineWorldX, leaving, onGone }: { scout: MempoolScout; frontLineWorldX: number; leaving: boolean; onGone: () => void }) {
  const groupRef = useRef<THREE.Group>(null);
  const bodyMat = useRef<THREE.MeshStandardMaterial>(null);
  const trailMat = useRef<THREE.MeshBasicMaterial>(null);
  const fadeRef = useRef(0); // 0..1 in, then back to 0 out
  const goneRef = useRef(false);
  const geometry = useMemo(() => getSoldierGeometry(scout.side), [scout.side]);
  const color = GHOST[scout.side];

  const startX = scout.side === 'shield' ? SHIELD_FORT_X - 6 : TRANSPARENT_FORT_X + 6;
  const laneZ = useMemo(() => (hashToUnit(scout.txHash) - 0.5) * 18, [scout.txHash]);
  const facing = scout.side === 'shield' ? 0 : Math.PI;
  const scale = 0.9 + scout.magnitude * 0.7;

  useFrame((_, delta) => {
    const g = groupRef.current;
    if (!g) return;
    // fade in, or fade out when leaving
    if (leaving) {
      fadeRef.current = Math.max(0, fadeRef.current - delta / (FADE_MS / 1000));
      if (fadeRef.current <= 0 && !goneRef.current) {
        goneRef.current = true;
        onGone();
        return;
      }
    } else {
      fadeRef.current = Math.min(1, fadeRef.current + delta / (FADE_MS / 1000));
    }

    const progress = Math.min(0.85, (Date.now() - scout.firstSeenMs) / ADVANCE_MS);
    const x = startX + (frontLineWorldX - startX) * progress;
    g.position.set(x, terrainHeight(x, laneZ) + 0.05, laneZ);
    g.rotation.y = facing;
    g.scale.setScalar(scale);

    const op = fadeRef.current;
    if (bodyMat.current) bodyMat.current.opacity = op * 0.4;
    if (trailMat.current) trailMat.current.opacity = op * 0.18 * (0.5 + 0.5 * Math.sin(Date.now() * 0.006));
  });

  return (
    <group ref={groupRef}>
      <mesh geometry={geometry}>
        <meshStandardMaterial ref={bodyMat} color={color} emissive={color} emissiveIntensity={0.4} transparent opacity={0} depthWrite={false} roughness={0.9} />
      </mesh>
      {/* faint dashed trail streak pointing back toward the home fort */}
      <mesh position={[scout.side === 'shield' ? 1.4 : -1.4, 0.7, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.6, 0.5]} />
        <meshBasicMaterial ref={trailMat} color={color} transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/** Renders the current set of real pending-transaction scouts, handling enter/exit fades by diffing hashes. */
export default function MempoolScouts({ scouts, frontLineWorldX }: { scouts: MempoolScout[]; frontLineWorldX: number }) {
  const [rendered, setRendered] = useState<Map<string, MempoolScout>>(new Map());
  const liveHashes = useMemo(() => new Set(scouts.map((s) => s.txHash)), [scouts]);

  useEffect(() => {
    setRendered((prev) => {
      const next = new Map(prev);
      for (const s of scouts) next.set(s.txHash, s); // add/update live scouts
      return next;
    });
  }, [scouts]);

  const remove = (hash: string) =>
    setRendered((prev) => {
      const next = new Map(prev);
      next.delete(hash);
      return next;
    });

  return (
    <>
      {[...rendered.values()].map((s) => (
        <Scout key={s.txHash} scout={s} frontLineWorldX={frontLineWorldX} leaving={!liveHashes.has(s.txHash)} onGone={() => remove(s.txHash)} />
      ))}
    </>
  );
}

function hashToUnit(hash: string): number {
  let h = 0;
  for (let i = 0; i < Math.min(hash.length, 10); i++) h = (h * 31 + hash.charCodeAt(i)) >>> 0;
  return (h % 1000) / 1000;
}
