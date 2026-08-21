import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getZebraGeometry } from './geometry/zebraGeometry';
import { FIELD_DEPTH } from '../logic/mapping';

const MAX_UNITS = 320;
const dummy = new THREE.Object3D();

interface Slot {
  ox: number; // offset from the front line along the advance axis (0 = at the line, grows toward the home fort)
  oz: number;
  jitter: number;
  scale: number;
}

interface Props {
  side: 'shield' | 'transparent';
  count: number;
  frontLineWorldX: number;
  color: THREE.ColorRepresentation;
  emissiveColor: THREE.ColorRepresentation;
  push: number; // 0..1, how hard this side is currently advancing (from real momentum)
}

/**
 * Instanced zebra "force" units representing the real ZEC value on each
 * side of the front line (see logic/mapping.ts#zecToUnitCount). Green
 * zebras mass between the Shielded Fort and the line, red zebras between
 * the Transparent Fort and the line, facing each other across it. Slots are
 * stable (not reshuffled) so growth/retreat reads as reinforcement rather
 * than random regeneration each poll.
 */
export default function Army({ side, count, frontLineWorldX, color, emissiveColor, push }: Props) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dir = side === 'shield' ? 1 : -1; // shield units stand on +X (toward their fort), transparent on -X
  const geometry = useMemo(() => getZebraGeometry(), []);

  const slots = useMemo<Slot[]>(() => {
    const rng = mulberry32(side === 'shield' ? 1337 : 7331);
    const arr: Slot[] = [];
    const cols = 20;
    for (let i = 0; i < MAX_UNITS; i++) {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const ox = 1.4 + row * 1.05 + rng() * 0.4;
      const oz = (col - cols / 2) * (FIELD_DEPTH / cols) + (rng() - 0.5) * 0.6;
      arr.push({ ox, oz, jitter: rng() * Math.PI * 2, scale: 0.78 + rng() * 0.5 });
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
      const bob = active ? Math.abs(Math.sin(t * 2.4 + slot.jitter)) * 0.07 : 0;
      const march = active ? Math.sin(t * 0.55 + slot.jitter) * (0.14 + push * 0.35) : 0;
      const x = frontLineWorldX + dir * (slot.ox - march);
      const y = active ? bob : -4;
      const z = slot.oz;
      const s = active ? slot.scale : 0.0001;
      // the zebra geometry's local "forward" (nose) points -X; face across the line toward the enemy, with a small idle sway
      const facing = (dir > 0 ? 0 : Math.PI) + Math.sin(t * 0.4 + slot.jitter) * 0.12;
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
