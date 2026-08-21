import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import './materials/TerrainMaterial';
import { FIELD_DEPTH, FIELD_HALF_WIDTH } from '../logic/mapping';

interface Props {
  frontLineWorldX: number;
}

/** The abstract war-map ground plane. Not a real-world map — a stylized tactical grid. */
export default function Battlefield({ frontLineWorldX }: Props) {
  const matRef = useRef<THREE.ShaderMaterial & { uFrontLine: number; uTime: number }>(null);
  const smoothedFront = useRef(frontLineWorldX);

  useFrame((_, delta) => {
    smoothedFront.current += (frontLineWorldX - smoothedFront.current) * Math.min(1, delta * 1.5);
    if (matRef.current) {
      matRef.current.uFrontLine = smoothedFront.current;
      matRef.current.uTime += delta;
    }
  });

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, 0, 0]}>
      <planeGeometry args={[FIELD_HALF_WIDTH * 2 + 20, FIELD_DEPTH + 10, 1, 1]} />
      <terrainMaterial ref={matRef} uFrontLine={frontLineWorldX} />
    </mesh>
  );
}
