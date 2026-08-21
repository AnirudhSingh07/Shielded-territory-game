import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import Explosion from './Explosion';
import { FIELD_DEPTH, SHIELD_FORT_X, TRANSPARENT_FORT_X } from '../../logic/mapping';
import { terrainHeight } from '../terrain/heightField';
import { triggerShake } from '../cameraShake';
import { vibrate } from '../haptics';
import { useUIStore } from '../../state/uiStore';
import { playCannonReport, playImpactThump } from '../../audio/soundManager';

/**
 * Continuous AMBIENT COMBAT along the front line — tracer crossfire, plus
 * tank / artillery / fort cannon fire (muzzle flash → arcing shell → impact
 * with a subtle camera shake, a quiet report/thump, and a light mobile
 * buzz). Purely cosmetic set-dressing: NEVER tied to transaction data, never
 * in the activity feed, never a banner. Warm neutral tracers and shells,
 * dusty grey-brown impacts — real confirmed transactions arrive as a running
 * courier with a TEAM-COLOURED burst and a louder cannon boom, which this
 * deliberately never mimics, so the layers stay distinct. Shake is kept small
 * (~0.1) so a real event's shake (0.35+) still punches through.
 */

const TRACER_COUNT = 64;
const TRACER_COLOR = new THREE.Color('#ffcf7a');
const SHELL_COLOR = new THREE.Color('#ffd98a');
const MUZZLE_COLOR = '#ffd27a';
const DIRT = '#6f5c42';
const TANK_OFFSET = 15; // matches the armour rank's staging distance in Army.tsx
const dummy = new THREE.Object3D();
const upVec = new THREE.Vector3(0, 1, 0);

const rand = (a: number, b: number) => a + Math.random() * (b - a);

/* ----------------------------- tracers ----------------------------- */

interface Tracer {
  sideSign: number;
  z: number;
  targetZ: number;
  fromOff: number;
  toOff: number;
  y0: number;
  y1: number;
  prog: number;
  speed: number;
}

function makeTracer(frontX: number): Tracer {
  const sideSign = Math.random() > 0.5 ? 1 : -1;
  const z = rand(-FIELD_DEPTH / 2 + 2, FIELD_DEPTH / 2 - 2);
  const targetZ = z + rand(-3, 3);
  const fromOff = rand(3, 11);
  const toOff = rand(2, 9);
  const y0 = terrainHeight(frontX + sideSign * fromOff, z) + 1.3;
  const y1 = terrainHeight(frontX - sideSign * toOff, targetZ) + rand(0.4, 1.4);
  return { sideSign, z, targetZ, fromOff, toOff, y0, y1, prog: Math.random(), speed: rand(2.2, 3.6) };
}

/* ------------------------- shells & impacts ------------------------ */

interface Shell {
  key: number;
  from: [number, number, number];
  to: [number, number, number];
}

/** A single arcing cannon shell — a glowing warm bolt that lobs to its impact point. */
function ShellArc({ from, to, onImpact }: { from: [number, number, number]; to: [number, number, number]; onImpact: () => void }) {
  const ref = useRef<THREE.Group>(null);
  const age = useRef(0);
  const done = useRef(false);
  const start = useMemo(() => new THREE.Vector3(...from), [from]);
  const end = useMemo(() => new THREE.Vector3(...to), [to]);
  const duration = THREE.MathUtils.clamp(start.distanceTo(end) / 22, 0.6, 1.4);
  const arc = 3 + start.distanceTo(end) * 0.12;

  useFrame((_, delta) => {
    if (done.current || !ref.current) return;
    age.current += delta;
    const t = Math.min(1, age.current / duration);
    ref.current.position.set(THREE.MathUtils.lerp(start.x, end.x, t), THREE.MathUtils.lerp(start.y, end.y, t) + Math.sin(t * Math.PI) * arc, THREE.MathUtils.lerp(start.z, end.z, t));
    if (t >= 1) {
      done.current = true;
      onImpact();
    }
  });

  return (
    <group ref={ref} position={from}>
      <mesh>
        <sphereGeometry args={[0.16, 8, 8]} />
        <meshBasicMaterial color={SHELL_COLOR} toneMapped={false} />
      </mesh>
      <pointLight color={SHELL_COLOR} intensity={2} distance={6} decay={2} />
    </group>
  );
}

/** A brief warm muzzle flash at a gun barrel. */
function Muzzle({ position, onDone }: { position: [number, number, number]; onDone: () => void }) {
  const ref = useRef<THREE.Mesh>(null);
  const light = useRef<THREE.PointLight>(null);
  const age = useRef(0);
  const done = useRef(false);
  useFrame((_, delta) => {
    if (done.current) return;
    age.current += delta;
    const k = Math.max(0, 1 - age.current / 0.14);
    if (ref.current) ref.current.scale.setScalar(0.2 + (1 - k) * 0.6);
    if (light.current) light.current.intensity = k * 9;
    const mat = ref.current?.material as THREE.MeshBasicMaterial | undefined;
    if (mat) mat.opacity = k;
    if (k <= 0 && !done.current) {
      done.current = true;
      onDone();
    }
  });
  return (
    <group position={position}>
      <mesh ref={ref}>
        <sphereGeometry args={[0.5, 8, 8]} />
        <meshBasicMaterial color={MUZZLE_COLOR} transparent opacity={1} toneMapped={false} />
      </mesh>
      <pointLight ref={light} color={MUZZLE_COLOR} intensity={9} distance={9} decay={2} />
    </group>
  );
}

/** A short-lived expanding smoke puff left by an impact. */
function SmokePuff({ position, onDone }: { position: [number, number, number]; onDone: () => void }) {
  const ref = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const age = useRef(0);
  const done = useRef(false);
  useFrame((_, delta) => {
    if (done.current) return;
    age.current += delta;
    const t = age.current / 2.6;
    if (ref.current) {
      ref.current.scale.setScalar(0.6 + t * 3.4);
      ref.current.position.y = position[1] + t * 2.3;
    }
    if (matRef.current) matRef.current.opacity = Math.max(0, 0.32 * (1 - t));
    if (t >= 1 && !done.current) {
      done.current = true;
      onDone();
    }
  });
  return (
    <mesh ref={ref} position={position}>
      <icosahedronGeometry args={[1, 0]} />
      <meshBasicMaterial ref={matRef} color="#8a8378" transparent opacity={0.32} depthWrite={false} />
    </mesh>
  );
}

let idc = 0;

export default function Firefight({ worldX }: { worldX: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const frontRef = useRef(worldX);
  useEffect(() => {
    frontRef.current = worldX;
  }, [worldX]);

  const tracers = useMemo(() => Array.from({ length: TRACER_COUNT }, () => makeTracer(worldX)), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [shells, setShells] = useState<Shell[]>([]);
  const [muzzles, setMuzzles] = useState<Array<{ key: number; pos: [number, number, number] }>>([]);
  const [impacts, setImpacts] = useState<Array<{ key: number; pos: [number, number, number] }>>([]);
  const [puffs, setPuffs] = useState<Array<{ key: number; pos: [number, number, number] }>>([]);

  // cannon / tank / fort fire loop
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const fire = () => {
      if (cancelled) return;
      const frontX = frontRef.current;
      const sideSign = Math.random() > 0.5 ? 1 : -1;
      const z = rand(-FIELD_DEPTH / 2 + 3, FIELD_DEPTH / 2 - 3);

      // most shots come from the armour rank; occasionally from a fort's firing slit
      let originX: number;
      let originY: number;
      if (Math.random() < 0.25) {
        const fortX = sideSign > 0 ? SHIELD_FORT_X : TRANSPARENT_FORT_X;
        originX = fortX + (fortX > 0 ? -2.8 : 2.8);
        originY = terrainHeight(fortX, 0) + 1.9;
      } else {
        originX = frontX + sideSign * (TANK_OFFSET + rand(-2, 2));
        originY = terrainHeight(originX, z) + 1.5;
      }
      const from: [number, number, number] = [originX, originY, z];
      const tx = frontX + rand(-6, 6);
      const tz = rand(-FIELD_DEPTH / 2 + 3, FIELD_DEPTH / 2 - 3);
      const to: [number, number, number] = [tx, terrainHeight(tx, tz) + 0.3, tz];

      idc += 1;
      const key = idc;
      setMuzzles((p) => [...p.slice(-5), { key, pos: from }]);
      setShells((p) => [...p.slice(-6), { key, from, to }]);
      if (useUIStore.getState().soundOn) playCannonReport(0.9);

      timer = setTimeout(fire, rand(1500, 3400));
    };
    timer = setTimeout(fire, 1200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  const onShellImpact = (key: number, pos: [number, number, number]) => {
    setShells((p) => p.filter((s) => s.key !== key));
    setImpacts((p) => [...p.slice(-5), { key, pos }]);
    setPuffs((p) => [...p.slice(-6), { key, pos: [pos[0], pos[1] + 0.6, pos[2]] }]);
    triggerShake(0.08 + Math.random() * 0.05); // subtle — real-event shakes (0.35+) still dominate
    vibrate(16, { minIntensity: 'high' }); // only buzz on 'high' intensity for ambient impacts
    if (useUIStore.getState().soundOn) playImpactThump(0.9);
  };

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const frontX = frontRef.current;
    for (let i = 0; i < TRACER_COUNT; i++) {
      const tr = tracers[i];
      tr.prog += delta * tr.speed;
      if (tr.prog >= 1) Object.assign(tr, makeTracer(frontX), { prog: 0 });
      const startX = frontX + tr.sideSign * tr.fromOff;
      const endX = frontX - tr.sideSign * tr.toOff;
      const x = THREE.MathUtils.lerp(startX, endX, tr.prog);
      const z = THREE.MathUtils.lerp(tr.z, tr.targetZ, tr.prog);
      const yArc = Math.sin(tr.prog * Math.PI) * 0.6;
      const y = THREE.MathUtils.lerp(tr.y0, tr.y1, tr.prog) + yArc;
      dummy.position.set(x, y, z);
      dummy.quaternion.setFromUnitVectors(upVec, new THREE.Vector3(endX - startX, tr.y1 - tr.y0, tr.targetZ - tr.z).normalize());
      const len = 1.6 * Math.sin(Math.min(1, tr.prog * 3)) * (1 - Math.max(0, tr.prog - 0.85) / 0.15);
      dummy.scale.set(1, Math.max(0.05, len), 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={meshRef} args={[undefined, undefined, TRACER_COUNT]} frustumCulled={false}>
        <cylinderGeometry args={[0.04, 0.04, 1, 5]} />
        <meshBasicMaterial color={TRACER_COLOR} toneMapped={false} />
      </instancedMesh>

      {muzzles.map((m) => (
        <Muzzle key={m.key} position={m.pos} onDone={() => setMuzzles((p) => p.filter((x) => x.key !== m.key))} />
      ))}
      {shells.map((s) => (
        <ShellArc key={s.key} from={s.from} to={s.to} onImpact={() => onShellImpact(s.key, s.to)} />
      ))}
      {impacts.map((im) => (
        <Explosion key={im.key} position={im.pos} color={DIRT} particleCount={30} scale={1.3} onDone={() => setImpacts((p) => p.filter((x) => x.key !== im.key))} />
      ))}
      {puffs.map((pf) => (
        <SmokePuff key={pf.key} position={pf.pos} onDone={() => setPuffs((p) => p.filter((x) => x.key !== pf.key))} />
      ))}
    </group>
  );
}
