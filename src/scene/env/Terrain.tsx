import { useMemo } from 'react';
import * as THREE from 'three';
import { FIELD_DEPTH, FIELD_HALF_WIDTH } from '../../logic/mapping';
import { distanceToRiver, RIVER_HALF_WIDTH, terrainHeight } from '../terrain/heightField';

const X_MIN = -(FIELD_HALF_WIDTH + 12);
const X_MAX = FIELD_HALF_WIDTH + 12;
const Z_MIN = -(FIELD_DEPTH / 2 + 8);
const Z_MAX = FIELD_DEPTH / 2 + 8;
const NX = 200;
const NZ = 120;

const GRASS = new THREE.Color('#47552f');
const GRASS_DRY = new THREE.Color('#5c5a34');
const DIRT = new THREE.Color('#54432f');
const MUD = new THREE.Color('#3f3323');

function hash(x: number, z: number): number {
  const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * The battlefield ground: a displaced mesh sampling the shared height-field
 * (terrain/heightField.ts), vertex-coloured by slope and proximity to the
 * river so it reads as grass on the flats, churned dirt on the slopes, and
 * mud along the water. Muted, PBR, no emissive — grounded, not neon.
 */
export default function Terrain() {
  const geometry = useMemo(() => {
    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    const eps = 0.75;
    const tmp = new THREE.Color();

    for (let j = 0; j <= NZ; j++) {
      const z = THREE.MathUtils.lerp(Z_MIN, Z_MAX, j / NZ);
      for (let i = 0; i <= NX; i++) {
        const x = THREE.MathUtils.lerp(X_MIN, X_MAX, i / NX);
        const y = terrainHeight(x, z);
        positions.push(x, y, z);

        // slope from finite differences
        const slope = Math.min(1, (Math.abs(terrainHeight(x + eps, z) - y) + Math.abs(terrainHeight(x, z + eps) - y)) / eps);
        const riverd = distanceToRiver(x, z);
        const nearWater = 1 - THREE.MathUtils.clamp((riverd - RIVER_HALF_WIDTH) / 3, 0, 1);
        const grime = hash(x * 1.7, z * 1.7);

        tmp.copy(GRASS).lerp(GRASS_DRY, grime * 0.6);
        tmp.lerp(DIRT, THREE.MathUtils.clamp(slope * 1.4, 0, 1));
        tmp.lerp(MUD, nearWater);
        colors.push(tmp.r, tmp.g, tmp.b);
      }
    }

    const row = NX + 1;
    for (let j = 0; j < NZ; j++) {
      for (let i = 0; i < NX; i++) {
        const a = j * row + i;
        const b = a + 1;
        const c = a + row;
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    return g;
  }, []);

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial vertexColors roughness={1} metalness={0} />
    </mesh>
  );
}
