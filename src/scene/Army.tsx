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
const SHIFT_RANGE = 4; // how far the whole formation creeps forward/back with the tide of battle
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
  /** signed war fortune for THIS side: +1 winning/advancing, -1 losing/falling back (from real momentum). */
  advance: number;
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
 * A full combined-arms force for one side: infantry with a rank of armour and
 * a few artillery pieces at the rear. Strength (unit counts) is derived from
 * real ZEC. The whole formation reacts to the real tide of battle (`advance`):
 * it creeps toward the line and surges when its side is winning, crouches and
 * falls back when losing, and every soldier fires with a small recoil. All of
 * it is per-instance matrix math in one useFrame — one draw call per mesh.
 */
export default function Army({ side, count, frontLineWorldX, advance }: Props) {
  const soldierRef = useRef<THREE.InstancedMesh>(null);
  const tankRef = useRef<THREE.InstancedMesh>(null);
  const artyRef = useRef<THREE.InstancedMesh>(null);
  const shiftRef = useRef(0); // smoothed formation advance/retreat
  const dir = side === 'shield' ? 1 : -1;
  const baseFacing = dir > 0 ? 0 : Math.PI;

  const soldierGeo = useMemo(() => getSoldierGeometry(side), [side]);
  const tankGeo = useMemo(() => getTankGeometry(side), [side]);
  const artyGeo = useMemo(() => getArtilleryGeometry(side), [side]);

  const soldierSlots = useMemo(() => makeSlots(side === 'shield' ? 1337 : 7331, MAX_SOLDIERS, 17, 2.2, 1.15, 0.5, 0.92, 0.16), [side]);
  const tankSlots = useMemo(() => makeSlots(side === 'shield' ? 220 : 221, MAX_TANKS, 4, 15, 3.2, 0.6, 1, 0), [side]);
  const artySlots = useMemo(() => makeSlots(side === 'shield' ? 330 : 331, MAX_ARTILLERY, 4, 22, 2, 0.4, 1, 0), [side]);

  const soldierCount = Math.min(count, MAX_SOLDIERS);
  const tankCount = Math.min(MAX_TANKS, Math.floor(count / 26));
  const artyCount = Math.min(MAX_ARTILLERY, Math.floor(count / 65));

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime;
    const pushForward = Math.max(0, advance);
    const retreat = Math.max(0, -advance);
    // smooth the formation's forward/back drift toward the real tide of battle
    shiftRef.current += (advance * SHIFT_RANGE - shiftRef.current) * Math.min(1, delta * 0.6);
    const shift = shiftRef.current;

    // --- infantry: bob, sway, firing recoil, crouch-when-losing ---
    const sm = soldierRef.current;
    if (sm) {
      for (let i = 0; i < MAX_SOLDIERS; i++) {
        const slot = soldierSlots[i];
        const active = i < soldierCount;
        const z = slot.oz;
        const march = active ? Math.sin(t * 0.5 + slot.jitter) * (0.12 + pushForward * 0.5) : 0;
        // firing recoil: a quick backward kick on each shot
        const fireCycle = (t * 1.5 + slot.jitter * 3.7) % 1;
        const recoil = active && fireCycle < 0.09 ? (1 - fireCycle / 0.09) * 0.16 : 0;
        const effOx = slot.ox - shift; // advancing pulls the formation toward the line
        let x = frontLineWorldX + dir * (effOx - march + recoil);
        x = pushOutOfRiver(x, z);
        const ground = terrainHeight(x, z);
        const bob = active ? Math.abs(Math.sin(t * 2.3 + slot.jitter)) * 0.09 : 0;
        const crouch = retreat * 0.16;
        const y = active ? ground + bob - crouch : -40;
        const pitch = recoil * 0.6 + retreat * 0.18; // recoil kick + hunched-when-retreating lean
        const facing = baseFacing + Math.sin(t * 0.4 + slot.jitter) * 0.12;
        dummy.position.set(x, y, z);
        dummy.rotation.set(pitch, facing, 0);
        dummy.scale.setScalar(active ? slot.scale : 0.0001);
        dummy.updateMatrix();
        sm.setMatrixAt(i, dummy.matrix);
      }
      sm.instanceMatrix.needsUpdate = true;
    }

    // --- vehicles: mostly hold position, occasional firing recoil ---
    const placeVehicles = (mesh: THREE.InstancedMesh | null, slots: Slot[], visible: number, max: number, fireRate: number, recoilAmt: number) => {
      if (!mesh) return;
      for (let i = 0; i < max; i++) {
        const slot = slots[i];
        const active = i < visible;
        const z = slot.oz;
        const fireCycle = (t * fireRate + slot.jitter) % 1;
        const recoil = active && fireCycle < 0.05 ? (1 - fireCycle / 0.05) * recoilAmt : 0;
        let x = frontLineWorldX + dir * (slot.ox - shift * 0.6 + recoil);
        x = pushOutOfRiver(x, z);
        const y = active ? terrainHeight(x, z) : -40;
        dummy.position.set(x, y, z);
        dummy.rotation.set(0, baseFacing, 0);
        dummy.scale.setScalar(active ? slot.scale : 0.0001);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    };
    placeVehicles(tankRef.current, tankSlots, tankCount, MAX_TANKS, 0.16, 0.5);
    placeVehicles(artyRef.current, artySlots, artyCount, MAX_ARTILLERY, 0.1, 0.7);
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
