import { useLayoutEffect, useRef } from 'react';
import * as THREE from 'three';
import { FIELD_DEPTH } from '../../logic/mapping';
import { isInRiver, riverCenterX, terrainHeight, waterLevel } from '../terrain/heightField';

const CONCRETE = '#6c6a61';
const CONCRETE_DARK = '#4d4c45';
const WOOD = '#4a3c2a';
const WOOD_DARK = '#33291d';
const SANDBAG = '#7c7150';
const RUBBLE = '#565349';
const dummy = new THREE.Object3D();

function groundY(x: number, z: number) {
  return terrainHeight(x, z);
}

/** A small building — intact or partially ruined (a knocked-out wall + rubble). */
function House({ x, z, rot = 0, ruined = false, scale = 1 }: { x: number; z: number; rot?: number; ruined?: boolean; scale?: number }) {
  const y = groundY(x, z);
  return (
    <group position={[x, y, z]} rotation={[0, rot, 0]} scale={scale}>
      <mesh position={[0, 0.05, 0]} receiveShadow castShadow>
        <boxGeometry args={[4.4, 0.2, 3.6]} />
        <meshStandardMaterial color={CONCRETE_DARK} roughness={1} />
      </mesh>
      {/* walls */}
      <mesh position={[0, 1.2, -1.7]} castShadow receiveShadow>
        <boxGeometry args={[4.2, 2.3, 0.25]} />
        <meshStandardMaterial color={CONCRETE} roughness={0.95} />
      </mesh>
      <mesh position={[-2.05, 1.2, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.25, 2.3, 3.4]} />
        <meshStandardMaterial color={CONCRETE} roughness={0.95} />
      </mesh>
      {!ruined && (
        <>
          <mesh position={[2.05, 1.2, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.25, 2.3, 3.4]} />
            <meshStandardMaterial color={CONCRETE} roughness={0.95} />
          </mesh>
          <mesh position={[0, 1.2, 1.7]} castShadow receiveShadow>
            <boxGeometry args={[4.2, 2.3, 0.25]} />
            <meshStandardMaterial color={CONCRETE} roughness={0.95} />
          </mesh>
          <mesh position={[0, 2.55, 0]} castShadow receiveShadow>
            <boxGeometry args={[4.6, 0.35, 3.8]} />
            <meshStandardMaterial color={CONCRETE_DARK} roughness={1} />
          </mesh>
        </>
      )}
      {ruined && (
        <>
          <mesh position={[1.6, 0.7, 1.2]} castShadow receiveShadow>
            <boxGeometry args={[1.0, 1.4, 0.25]} />
            <meshStandardMaterial color={CONCRETE} roughness={1} />
          </mesh>
          {[0, 1, 2, 3].map((i) => (
            <mesh key={i} position={[(i - 1.5) * 0.7, 0.2, 1.2 + (i % 2) * 0.4]} castShadow>
              <dodecahedronGeometry args={[0.32, 0]} />
              <meshStandardMaterial color={RUBBLE} roughness={1} />
            </mesh>
          ))}
        </>
      )}
    </group>
  );
}

/** A wooden watchtower with a covered platform. */
function Watchtower({ x, z, rot = 0 }: { x: number; z: number; rot?: number }) {
  const y = groundY(x, z);
  const legs: Array<[number, number]> = [
    [-0.9, -0.9],
    [0.9, -0.9],
    [-0.9, 0.9],
    [0.9, 0.9],
  ];
  return (
    <group position={[x, y, z]} rotation={[0, rot, 0]}>
      {legs.map(([lx, lz], i) => (
        <mesh key={i} position={[lx, 2.1, lz]} castShadow>
          <boxGeometry args={[0.22, 4.2, 0.22]} />
          <meshStandardMaterial color={WOOD} roughness={1} />
        </mesh>
      ))}
      <mesh position={[0, 2.3, 0]} castShadow>
        <boxGeometry args={[2.2, 0.15, 2.2]} />
        <meshStandardMaterial color={WOOD} roughness={1} />
      </mesh>
      <mesh position={[0, 4.3, 0]} receiveShadow castShadow>
        <boxGeometry args={[2.5, 0.22, 2.5]} />
        <meshStandardMaterial color={WOOD_DARK} roughness={1} />
      </mesh>
      {/* railing */}
      <mesh position={[0, 3.0, 1.15]}>
        <boxGeometry args={[2.3, 0.7, 0.12]} />
        <meshStandardMaterial color={WOOD} roughness={1} />
      </mesh>
      <mesh position={[0, 3.0, -1.15]}>
        <boxGeometry args={[2.3, 0.7, 0.12]} />
        <meshStandardMaterial color={WOOD} roughness={1} />
      </mesh>
      {/* roof */}
      <mesh position={[0, 4.9, 0]} castShadow>
        <coneGeometry args={[2.0, 1.2, 4]} />
        <meshStandardMaterial color={WOOD_DARK} roughness={1} />
      </mesh>
    </group>
  );
}

/** A plank bridge across the river channel at a given Z. */
function Bridge({ z }: { z: number }) {
  const cx = riverCenterX(z);
  const deckY = waterLevel() + 1.15;
  const span = 7.2;
  return (
    <group position={[cx, deckY, z]}>
      <mesh receiveShadow castShadow>
        <boxGeometry args={[span, 0.22, 3.0]} />
        <meshStandardMaterial color={WOOD} roughness={1} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, 0.45, s * 1.4]}>
          <boxGeometry args={[span, 0.6, 0.14]} />
          <meshStandardMaterial color={WOOD_DARK} roughness={1} />
        </mesh>
      ))}
      {[-span / 2 + 0.4, 0, span / 2 - 0.4].map((px, i) => (
        <mesh key={i} position={[px, -0.7, 0]}>
          <boxGeometry args={[0.3, 1.6, 2.8]} />
          <meshStandardMaterial color={WOOD_DARK} roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

/** Instanced sandbags forming low defensive walls at a few emplacements. */
function Sandbags() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geo = useRef<THREE.BufferGeometry>(new THREE.CapsuleGeometry(0.28, 0.36, 3, 6));

  // a handful of short sandbag walls, laid out as rows of stacked bags
  const bags: Array<{ x: number; y: number; z: number; rot: number }> = [];
  const walls: Array<{ x: number; z: number; angle: number; len: number }> = [
    { x: 6, z: -9, angle: 0.2, len: 6 },
    { x: -7, z: 7, angle: -0.3, len: 5 },
    { x: 12, z: 4, angle: 1.4, len: 4 },
    { x: -13, z: -5, angle: 1.2, len: 4 },
  ];
  for (const w of walls) {
    const dx = Math.cos(w.angle);
    const dz = Math.sin(w.angle);
    for (let i = 0; i < w.len; i++) {
      const bx = w.x + (i - w.len / 2) * dx * 0.62;
      const bz = w.z + (i - w.len / 2) * dz * 0.62;
      if (isInRiver(bx, bz, 1)) continue;
      const g = terrainHeight(bx, bz);
      for (let layer = 0; layer < 2; layer++) {
        bags.push({ x: bx + (layer % 2) * 0.12, y: g + 0.18 + layer * 0.34, z: bz, rot: w.angle + Math.PI / 2 });
      }
    }
  }

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    bags.forEach((b, i) => {
      dummy.position.set(b.x, b.y, b.z);
      dummy.rotation.set(0, b.rot, Math.PI / 2);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <instancedMesh ref={ref} args={[geo.current, undefined, bags.length]} castShadow receiveShadow frustumCulled={false}>
      <meshStandardMaterial color={SANDBAG} roughness={1} />
    </instancedMesh>
  );
}

/**
 * Static man-made features scattered across the battlefield: bridges over
 * the river, intact and ruined houses, watchtowers, and sandbag
 * emplacements. All cosmetic set-dressing, muted PBR materials.
 */
export default function Structures() {
  return (
    <group>
      <Bridge z={-6} />
      <Bridge z={FIELD_DEPTH / 2 - 2} />
      <House x={-16} z={-10} rot={0.5} />
      <House x={15} z={9} rot={-0.7} ruined />
      <House x={-18} z={8} rot={0.2} ruined scale={0.9} />
      <House x={18} z={-8} rot={2.4} />
      <House x={2} z={13} rot={0.1} ruined scale={1.1} />
      <Watchtower x={-11} z={-11} rot={0.3} />
      <Watchtower x={10} z={11} rot={-0.5} />
      <Sandbags />
    </group>
  );
}
