import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import './materials/FogMaterial';
import { FIELD_OUTER_MARGIN } from '../logic/mapping';

interface Props {
  frontRadius: number;
  opacity: number;
}

export default function FogOfWar({ frontRadius, opacity }: Props) {
  const matRef = useRef<THREE.ShaderMaterial & { uFrontRadius: number; uTime: number; uOpacity: number }>(null);

  useFrame((_, delta) => {
    if (!matRef.current) return;
    matRef.current.uFrontRadius += (frontRadius - matRef.current.uFrontRadius) * Math.min(1, delta * 1.2);
    matRef.current.uOpacity += (opacity - matRef.current.uOpacity) * Math.min(1, delta * 0.8);
    matRef.current.uTime += delta;
  });

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 1.6, 0]}>
      <circleGeometry args={[FIELD_OUTER_MARGIN, 96]} />
      <fogMaterial ref={matRef} uFrontRadius={frontRadius} uOpacity={opacity} transparent depthWrite={false} />
    </mesh>
  );
}
