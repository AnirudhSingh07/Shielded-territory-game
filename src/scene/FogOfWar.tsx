import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import './materials/FogMaterial';
import { FIELD_DEPTH, FIELD_HALF_WIDTH } from '../logic/mapping';

interface Props {
  frontLineWorldX: number;
  opacity: number;
}

export default function FogOfWar({ frontLineWorldX, opacity }: Props) {
  const matRef = useRef<THREE.ShaderMaterial & { uFrontLine: number; uTime: number; uOpacity: number }>(null);

  useFrame((_, delta) => {
    if (!matRef.current) return;
    matRef.current.uFrontLine += (frontLineWorldX - matRef.current.uFrontLine) * Math.min(1, delta * 1.2);
    matRef.current.uOpacity += (opacity - matRef.current.uOpacity) * Math.min(1, delta * 0.8);
    matRef.current.uTime += delta;
  });

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 1.6, 0]}>
      <planeGeometry args={[FIELD_HALF_WIDTH * 2 + 20, FIELD_DEPTH + 10, 1, 1]} />
      <fogMaterial ref={matRef} uFrontLine={frontLineWorldX} uOpacity={opacity} transparent depthWrite={false} />
    </mesh>
  );
}
