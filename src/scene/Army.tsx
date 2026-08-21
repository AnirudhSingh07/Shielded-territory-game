import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { FIELD_DEPTH } from '../logic/mapping';

const MAX_UNITS = 320;
const dummy = new THREE.Object3D();

interface Slot {
  ox: number; // offset from front line along the advance axis (0 = at the line, grows toward rear)
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
  push: number; // 0..1, how hard this side is currently advancing (from momentum)
}

/**
 * Instanced "force" units representing the ZEC value on each side of the
 * line (see logic/mapping.ts#zecToUnitCount for the count derivation). Units
 * are stable slots that fade in/out as `count` changes rather than
 * reshuffling, so the formation reads as reinforcing/retreating instead of
 * randomly regenerating every poll.
 */
export default function Army({ side, count, frontLineWorldX, color, emissiveColor, push }: Props) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dir = side === 'shield' ? 1 : -1; // shield territory is +X, transparent is -X

  const slots = useMemo<Slot[]>(() => {
    const rng = mulberry32(side === 'shield' ? 1337 : 7331);
    const arr: Slot[] = [];
    const cols = 20;
    for (let i = 0; i < MAX_UNITS; i++) {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const ox = 1.5 + row * 1.15 + rng() * 0.4;
      const oz = (col - cols / 2) * (FIELD_DEPTH / cols) + (rng() - 0.5) * 0.6;
      arr.push({ ox, oz, jitter: rng() * Math.PI * 2, scale: 0.75 + rng() * 0.5 });
    }
    return arr;
  }, [side]);

  const visibleCount = Math.min(count, MAX_UNITS);

  useLayoutEffect(() => {
    if (!meshRef.current) return;
    // Static per-instance color so the palette reads consistently frame to frame.
    const c = new THREE.Color(color);
    for (let i = 0; i < MAX_UNITS; i++) {
      meshRef.current.setColorAt(i, c);
    }
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  }, [color]);

  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const t = clock.elapsedTime;
    for (let i = 0; i < MAX_UNITS; i++) {
      const slot = slots[i];
      const active = i < visibleCount;
      const bob = active ? Math.sin(t * 2.2 + slot.jitter) * 0.08 : 0;
      const march = active ? Math.sin(t * 0.6 + slot.jitter) * (0.15 + push * 0.35) : 0;
      const x = frontLineWorldX + dir * (slot.ox - march);
      const y = active ? 0.35 * slot.scale + bob : -3; // sink hidden units below the field
      const z = slot.oz;
      const s = active ? slot.scale : 0.0001;
      dummy.position.set(x, y, z);
      dummy.rotation.set(0, dir > 0 ? Math.PI : 0, 0);
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  const geometry = side === 'shield' ? <octahedronGeometry args={[0.42, 0]} /> : <tetrahedronGeometry args={[0.5, 0]} />;

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_UNITS]} castShadow receiveShadow frustumCulled={false}>
      {geometry}
      <meshStandardMaterial color={color} emissive={emissiveColor} emissiveIntensity={0.6} roughness={0.35} metalness={0.4} />
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
