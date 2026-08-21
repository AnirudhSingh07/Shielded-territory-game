import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { getBushGeometry, getRockGeometry, getTreeGeometry } from '../geometry/propGeometry';
import { FIELD_DEPTH, FIELD_HALF_WIDTH, SHIELD_FORT_X, TRANSPARENT_FORT_X } from '../../logic/mapping';
import { isInRiver, terrainHeight } from '../terrain/heightField';

const X_RANGE = FIELD_HALF_WIDTH + 10;
const Z_RANGE = FIELD_DEPTH / 2 + 6;
const dummy = new THREE.Object3D();

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

interface Placement {
  x: number;
  z: number;
  rot: number;
  scale: number;
}

function scatter(seed: number, target: number, opts: { edgeBias: number; minScale: number; maxScale: number }): Placement[] {
  const rng = mulberry32(seed);
  const out: Placement[] = [];
  let guard = 0;
  while (out.length < target && guard < target * 12) {
    guard++;
    let x = (rng() * 2 - 1) * X_RANGE;
    const z = (rng() * 2 - 1) * Z_RANGE;
    // bias density toward the edges/back so the central battle stays readable
    if (opts.edgeBias > 0 && Math.abs(x) < X_RANGE * 0.5 && rng() < opts.edgeBias) continue;
    if (isInRiver(x, z, 2)) continue;
    // keep clear of the two fort footprints
    if (Math.abs(x - SHIELD_FORT_X) < 6 && Math.abs(z) < 6) continue;
    if (Math.abs(x - TRANSPARENT_FORT_X) < 6 && Math.abs(z) < 6) continue;
    x += (rng() - 0.5) * 0.5;
    out.push({ x, z, rot: rng() * Math.PI * 2, scale: opts.minScale + rng() * (opts.maxScale - opts.minScale) });
  }
  return out;
}

function InstancedProp({
  geometry,
  placements,
  castShadow,
  roughness,
}: {
  geometry: THREE.BufferGeometry;
  placements: Placement[];
  castShadow: boolean;
  roughness: number;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    placements.forEach((p, i) => {
      dummy.position.set(p.x, terrainHeight(p.x, p.z), p.z);
      dummy.rotation.set(0, p.rot, 0);
      dummy.scale.setScalar(p.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [placements]);
  return (
    <instancedMesh ref={ref} args={[geometry, undefined, placements.length]} castShadow={castShadow} receiveShadow frustumCulled={false}>
      <meshStandardMaterial vertexColors roughness={roughness} metalness={0} />
    </instancedMesh>
  );
}

/** Instanced trees, bushes and rocks scattered across the field, clear of the river and forts. */
export default function Vegetation() {
  const treeGeo = useMemo(() => getTreeGeometry(), []);
  const bushGeo = useMemo(() => getBushGeometry(), []);
  const rockGeo = useMemo(() => getRockGeometry(), []);

  const trees = useMemo(() => scatter(9001, 120, { edgeBias: 0.7, minScale: 0.8, maxScale: 1.7 }), []);
  const bushes = useMemo(() => scatter(9002, 90, { edgeBias: 0.35, minScale: 0.7, maxScale: 1.5 }), []);
  const rocks = useMemo(() => scatter(9003, 80, { edgeBias: 0.2, minScale: 0.6, maxScale: 1.8 }), []);

  return (
    <group>
      <InstancedProp geometry={treeGeo} placements={trees} castShadow roughness={0.9} />
      <InstancedProp geometry={bushGeo} placements={bushes} castShadow={false} roughness={0.9} />
      <InstancedProp geometry={rockGeo} placements={rocks} castShadow roughness={1} />
    </group>
  );
}
