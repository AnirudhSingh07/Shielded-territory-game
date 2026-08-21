import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import './materials/TerrainMaterial';
import { FIELD_OUTER_MARGIN } from '../logic/mapping';

interface Props {
  frontRadius: number;
}

/** The abstract siege-map ground plane, centered on the Shielded Fort. Not a real-world map. */
export default function Battlefield({ frontRadius }: Props) {
  const matRef = useRef<THREE.ShaderMaterial & { uFrontRadius: number; uTime: number }>(null);
  const smoothed = useRef(frontRadius);

  useFrame((_, delta) => {
    smoothed.current += (frontRadius - smoothed.current) * Math.min(1, delta * 1.5);
    if (matRef.current) {
      matRef.current.uFrontRadius = smoothed.current;
      matRef.current.uTime += delta;
    }
  });

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, 0, 0]}>
      <circleGeometry args={[FIELD_OUTER_MARGIN, 96]} />
      <terrainMaterial ref={matRef} uFrontRadius={frontRadius} />
    </mesh>
  );
}
