import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getSoldierGeometry } from './geometry/soldierGeometry';
import { getTankGeometry, getArtilleryGeometry } from './geometry/vehicleGeometry';
import { FIELD_DEPTH } from '../logic/mapping';
import { pushOutOfRiver, terrainHeight } from './terrain/heightField';

const MAX_SOLDIERS = 170;
const MAX_TANKS = 8;
const MAX_ARTILLERY = 4;
const dummy = new THREE.Object3D();

interface Slot {
  ox: number; // offset from the front line toward the home fort
  oz: number;
  jitter: number;
  scale: number;
}

interface Props {
  side: 'shield' | 'transparent';
  count: number; // strength from real ZEC (see logic/mapping.ts#zecToUnitCount)
  frontLineWorldX: number;
  push: number; // 0..1 advance pressure from real momentum
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

/** Build a stable, seeded set of formation slots in a band of X-offsets. */
function makeSlots(seed: number, n: number, cols: number, oxStart: number, oxStep: number, jitterOx: number, scaleBase: number, scaleVar: number): Slot[] {
  const rng = mulberry32(seed);
  const arr: Slot[] = [];
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const ox = oxStart + row * oxStep + rng() * jitterOx;
    const oz = (col - (cols - 1) / 2) * (FIELD_DEPTH / cols) + (rng() - 0.5) * 1.2;
    arr.push({ ox, oz, jitter: rng() * Math.PI * 2, scale: scaleBase + rng() * scaleVar });
  }
  return arr;
}

/**
 * A full combined-arms force for one side: a mass of infantry with a rank of
 * armour and a few artillery pieces at the rear. All strength (unit counts)
 * is derived from the real ZEC on that side of the ledger; nothing here is
 * synthetic. Units stand on the shared terrain height-field and never in the
 * river. Idle bob/sway keeps the line alive between real events.
 */
export default function Army({ side, count, frontLineWorldX, push }: Props) {
  const soldierRef = useRef<THREE.InstancedMesh>(null);
  const tankRef = useRef<THREE.InstancedMesh>(null);
  const artyRef = useRef<THREE.InstancedMesh>(null);
  const dir = side === 'shield' ? 1 : -1; // +X toward shield fort, -X toward transparent fort
  const baseFacing = dir > 0 ? 0 : Math.PI; // geometry forward is -X; this aims each unit at the enemy

  const soldierGeo = useMemo(() => getSoldierGeometry(side), [side]);
  const tankGeo = useMemo(() => getTankGeometry(side), [side]);
  const artyGeo = useMemo(() => getArtilleryGeometry(side), [side]);

  const soldierSlots = useMemo(() => makeSlots(side === 'shield' ? 1337 : 7331, MAX_SOLDIERS, 17, 2.2, 1.15, 0.5, 0.92, 0.16), [side]);
  const tankSlots = useMemo(() => makeSlots(side === 'shield' ? 220 : 221, MAX_TANKS, 4, 15, 3.2, 0.6, 1, 0), [side]);
  const artySlots = useMemo(() => makeSlots(side === 'shield' ? 330 : 331, MAX_ARTILLERY, 4, 22, 2, 0.4, 1, 0), [side]);

  const soldierCount = Math.min(count, MAX_SOLDIERS);
  const tankCount = Math.min(MAX_TANKS, Math.floor(count / 26));
  const artyCount = Math.min(MAX_ARTILLERY, Math.floor(count / 65));

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;

    const place = (
      mesh: THREE.InstancedMesh | null,
      slots: Slot[],
      visible: number,
      max: number,
      opts: { bob: number; sway: number; march: number; flat?: boolean },
    ) => {
      if (!mesh) return;
      for (let i = 0; i < max; i++) {
        const slot = slots[i];
        const active = i < visible;
        const z = slot.oz;
        const march = active ? Math.sin(t * 0.5 + slot.jitter) * (opts.march * (0.4 + push)) : 0;
        let x = frontLineWorldX + dir * (slot.ox - march);
        x = pushOutOfRiver(x, z);
        const ground = terrainHeight(x, z);
        const bob = active && opts.bob ? Math.abs(Math.sin(t * 2.3 + slot.jitter)) * opts.bob : 0;
        const y = active ? ground + bob : -40;
        const facing = baseFacing + (opts.flat ? 0 : Math.sin(t * 0.4 + slot.jitter) * opts.sway);
        dummy.position.set(x, y, z);
        dummy.rotation.set(0, facing, 0);
        dummy.scale.setScalar(active ? slot.scale : 0.0001);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    };

    place(soldierRef.current, soldierSlots, soldierCount, MAX_SOLDIERS, { bob: 0.09, sway: 0.14, march: 0.4 });
    place(tankRef.current, tankSlots, tankCount, MAX_TANKS, { bob: 0, sway: 0, march: 0.12, flat: true });
    place(artyRef.current, artySlots, artyCount, MAX_ARTILLERY, { bob: 0, sway: 0, march: 0, flat: true });
  });

  return (
    <group>
      {/* Soldiers don't cast shadows (up to ~170 per side); armour/structures/monument carry the shadow richness. */}
      <instancedMesh ref={soldierRef} args={[soldierGeo, undefined, MAX_SOLDIERS]} receiveShadow frustumCulled={false}>
        <meshStandardMaterial vertexColors roughness={0.85} metalness={0.05} />
      </instancedMesh>
      <instancedMesh ref={tankRef} args={[tankGeo, undefined, MAX_TANKS]} castShadow receiveShadow frustumCulled={false}>
        <meshStandardMaterial vertexColors roughness={0.7} metalness={0.25} />
      </instancedMesh>
      <instancedMesh ref={artyRef} args={[artyGeo, undefined, MAX_ARTILLERY]} castShadow receiveShadow frustumCulled={false}>
        <meshStandardMaterial vertexColors roughness={0.7} metalness={0.25} />
      </instancedMesh>
    </group>
  );
}
