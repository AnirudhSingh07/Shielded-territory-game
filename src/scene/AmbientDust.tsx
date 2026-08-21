import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import './materials/DustMaterial';
import { FIELD_DEPTH, FIELD_HALF_WIDTH } from '../logic/mapping';

const COUNT = 260;

/** Slow-drifting motes across the whole field — see materials/DustMaterial.ts for why. */
export default function AmbientDust() {
  const matRef = useRef<THREE.ShaderMaterial & { uTime: number }>(null);

  const [{ positions, seeds, speeds }] = useState(() => {
    const positions = new Float32Array(COUNT * 3);
    const seeds = new Float32Array(COUNT);
    const speeds = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * (FIELD_HALF_WIDTH * 2 - 4);
      positions[i * 3 + 1] = Math.random() * 6;
      positions[i * 3 + 2] = (Math.random() - 0.5) * (FIELD_DEPTH - 2);
      seeds[i] = Math.random();
      speeds[i] = 0.12 + Math.random() * 0.22;
    }
    return { positions, seeds, speeds };
  });

  useFrame((_, delta) => {
    if (matRef.current) matRef.current.uTime += delta;
  });

  return (
    <points frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aSeed" args={[seeds, 1]} />
        <bufferAttribute attach="attributes-aSpeed" args={[speeds, 1]} />
      </bufferGeometry>
      <dustMaterial ref={matRef} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
}
