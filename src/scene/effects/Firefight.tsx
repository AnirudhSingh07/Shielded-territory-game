import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import Explosion from './Explosion';
import { FIELD_DEPTH } from '../../logic/mapping';
import { terrainHeight } from '../terrain/heightField';

/**
 * Continuous AMBIENT COMBAT along the front line — tracer crossfire, artillery
 * impacts, and lingering smoke. This is purely cosmetic set-dressing (like the
 * ambient battle in any war game): it is NEVER tied to transaction data, never
 * logged to the activity feed, never triggers a banner. To keep it visually
 * distinct from real events, it uses warm neutral tracer colour and dusty
 * grey-brown impacts — real confirmed transactions arrive as a running courier
 * soldier with a TEAM-COLOURED burst, which this deliberately never mimics.
 *
 * Its only job is to make sure the battlefield always looks like an active war,
 * even during the long real-world lulls between actual shielding transactions.
 */

const TRACER_COUNT = 64;
const TRACER_COLOR = new THREE.Color('#ffcf7a');
const DIRT = '#6f5c42';
const dummy = new THREE.Object3D();
const upVec = new THREE.Vector3(0, 1, 0);

interface Tracer {
  sideSign: number; // +1 fires from the shielded side toward -X, -1 the other way
  z: number;
  targetZ: number;
  fromOff: number;
  toOff: number;
  y0: number;
  y1: number;
  prog: number;
  speed: number;
}

function rand(a: number, b: number) {
  return a + Math.random() * (b - a);
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
      ref.current.scale.setScalar(0.6 + t * 3.2);
      ref.current.position.y = position[1] + t * 2.2;
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

export default function Firefight({ worldX }: { worldX: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const frontRef = useRef(worldX);
  useEffect(() => {
    frontRef.current = worldX;
  }, [worldX]);

  const tracers = useMemo(() => Array.from({ length: TRACER_COUNT }, () => makeTracer(worldX)), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [impacts, setImpacts] = useState<Array<{ key: number; pos: [number, number, number] }>>([]);
  const [puffs, setPuffs] = useState<Array<{ key: number; pos: [number, number, number] }>>([]);
  const counter = useRef(0);

  // continuous artillery impacts in no-man's-land
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const spawn = () => {
      if (cancelled) return;
      const frontX = frontRef.current;
      const x = frontX + rand(-6, 6);
      const z = rand(-FIELD_DEPTH / 2 + 3, FIELD_DEPTH / 2 - 3);
      const y = terrainHeight(x, z) + 0.3;
      counter.current += 1;
      const key = counter.current;
      setImpacts((p) => [...p.slice(-5), { key, pos: [x, y, z] }]);
      setPuffs((p) => [...p.slice(-6), { key, pos: [x, y + 0.6, z] }]);
      timer = setTimeout(spawn, rand(1100, 2600));
    };
    timer = setTimeout(spawn, 900);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

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
      const arc = Math.sin(tr.prog * Math.PI) * 0.6;
      const y = THREE.MathUtils.lerp(tr.y0, tr.y1, tr.prog) + arc;
      dummy.position.set(x, y, z);
      // orient the streak along its travel direction
      const dx = endX - startX;
      const dz = tr.targetZ - tr.z;
      dummy.quaternion.setFromUnitVectors(upVec, new THREE.Vector3(dx, tr.y1 - tr.y0, dz).normalize());
      // fade the streak in/out over its flight via length
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
      {impacts.map((im) => (
        <Explosion
          key={im.key}
          position={im.pos}
          color={DIRT}
          particleCount={26}
          scale={1.1}
          onDone={() => setImpacts((p) => p.filter((x) => x.key !== im.key))}
        />
      ))}
      {puffs.map((pf) => (
        <SmokePuff key={pf.key} position={pf.pos} onDone={() => setPuffs((p) => p.filter((x) => x.key !== pf.key))} />
      ))}
    </group>
  );
}
