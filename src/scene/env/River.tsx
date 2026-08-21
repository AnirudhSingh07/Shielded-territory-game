import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import '../materials/WaterMaterial';
import { FIELD_DEPTH } from '../../logic/mapping';
import { RIVER_HALF_WIDTH, riverCenterX, waterLevel } from '../terrain/heightField';

const Z_MIN = -(FIELD_DEPTH / 2 + 8);
const Z_MAX = FIELD_DEPTH / 2 + 8;
const STEPS = 80;
const WIDTH = RIVER_HALF_WIDTH * 1.15;

/** A flowing water ribbon that follows the meandering river channel down the field. */
export default function River() {
  const matRef = useRef<THREE.ShaderMaterial & { uTime: number }>(null);

  const geometry = useMemo(() => {
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    const y = waterLevel();
    for (let j = 0; j <= STEPS; j++) {
      const z = THREE.MathUtils.lerp(Z_MIN, Z_MAX, j / STEPS);
      const cx = riverCenterX(z);
      positions.push(cx - WIDTH, y, z, cx + WIDTH, y, z);
      const v = j / STEPS;
      uvs.push(0, v, 1, v);
    }
    for (let j = 0; j < STEPS; j++) {
      const a = j * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(indices);
    g.computeVertexNormals();
    return g;
  }, []);

  useFrame((_, delta) => {
    if (matRef.current) matRef.current.uTime += delta;
  });

  return (
    <mesh geometry={geometry}>
      <waterMaterial ref={matRef} transparent depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  );
}
