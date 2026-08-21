import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getZebraGeometry } from './geometry/zebraGeometry';
import { FIELD_MAX_RADIUS, FORT_RADIUS } from '../logic/mapping';

const MAX_UNITS = 320;
const dummy = new THREE.Object3D();

interface Slot {
  angle: number;
  /** Offset from the front line, along the radial axis (toward the fort for green, away for red). */
  offset: number;
  jitter: number;
  scale: number;
}

interface Props {
  side: 'shield' | 'transparent';
  count: number;
  frontRadius: number;
  color: THREE.ColorRepresentation;
  emissiveColor: THREE.ColorRepresentation;
  push: number; // 0..1, how hard this side is currently advancing (from momentum)
}

/**
 * Instanced zebra "force" units representing the real ZEC value on each
 * side of the front line (see logic/mapping.ts#zecToUnitCount). Green
 * zebras garrison the ring between the fort and the front line; red zebras
 * mass outside it. Slots are stable (not reshuffled) so growth/retreat
 * reads as reinforcement rather than random regeneration each poll.
 */
export default function Army({ side, count, frontRadius, color, emissiveColor, push }: Props) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dir = side === 'shield' ? -1 : 1; // shield units sit *inside* the front radius, transparent *outside*
  const geometry = useMemo(() => getZebraGeometry(), []);

  const slots = useMemo<Slot[]>(() => {
    const rng = mulberry32(side === 'shield' ? 1337 : 7331);
    const arr: Slot[] = [];
    for (let i = 0; i < MAX_UNITS; i++) {
      arr.push({
        angle: rng() * Math.PI * 2,
        offset: 0.6 + Math.pow(rng(), 0.7) * 9.5,
        jitter: rng() * Math.PI * 2,
        scale: 0.8 + rng() * 0.5,
      });
    }
    return arr;
  }, [side]);

  const visibleCount = Math.min(count, MAX_UNITS);

  useLayoutEffect(() => {
    if (!meshRef.current) return;
    const c = new THREE.Color(color);
    for (let i = 0; i < MAX_UNITS; i++) meshRef.current.setColorAt(i, c);
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  }, [color]);

  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const t = clock.elapsedTime;
    for (let i = 0; i < MAX_UNITS; i++) {
      const slot = slots[i];
      const active = i < visibleCount;
      const bob = active ? Math.abs(Math.sin(t * 2.4 + slot.jitter)) * 0.06 : 0;
      const shuffle = active ? Math.sin(t * 0.5 + slot.jitter) * (0.1 + push * 0.3) : 0;
      const radius = clamp(frontRadius + dir * (slot.offset - shuffle), FORT_RADIUS + 0.4, FIELD_MAX_RADIUS - 0.5);
      const x = Math.cos(slot.angle) * radius;
      const z = Math.sin(slot.angle) * radius;
      const y = active ? bob : -4;
      const s = active ? slot.scale : 0.0001;
      // face roughly toward the fort (or away, for a bit of life) with a gentle idle sway
      const facing = Math.atan2(z, x) + Math.PI / 2 + Math.sin(t * 0.4 + slot.jitter) * 0.15;
      dummy.position.set(x, y, z);
      dummy.rotation.set(0, facing, 0);
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[geometry, undefined, MAX_UNITS]} castShadow receiveShadow frustumCulled={false}>
      {/* material.color stays white (default) — per-instance setColorAt above supplies the team tint,
          which multiplies with the geometry's baked vertex colors (white body / dark stripes+eyes+mane) */}
      <meshStandardMaterial vertexColors emissive={emissiveColor} emissiveIntensity={0.35} roughness={0.55} metalness={0.15} />
    </instancedMesh>
  );
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
