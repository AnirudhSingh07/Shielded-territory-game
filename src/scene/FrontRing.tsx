import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import './materials/FrontRingMaterial';
import { FIELD_OUTER_MARGIN } from '../logic/mapping';

interface Props {
  radius: number;
  color: THREE.ColorRepresentation;
}

/** The glowing boundary between shielded and transparent territory, live-driven by the real shielded fraction. */
export default function FrontRing({ radius, color }: Props) {
  const matRef = useRef<THREE.ShaderMaterial & { uRadius: number; uTime: number; uColor: THREE.Color }>(null);

  useFrame((_, delta) => {
    if (!matRef.current) return;
    matRef.current.uRadius += (radius - matRef.current.uRadius) * Math.min(1, delta * 1.6);
    matRef.current.uColor.lerp(new THREE.Color(color), Math.min(1, delta * 2));
    matRef.current.uTime += delta;
  });

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 0]}>
      <circleGeometry args={[FIELD_OUTER_MARGIN, 96]} />
      <frontRingMaterial ref={matRef} uRadius={radius} uColor={new THREE.Color(color)} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  );
}
