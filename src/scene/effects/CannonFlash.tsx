import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface Props {
  position: [number, number, number];
  color: THREE.ColorRepresentation;
  scale: number;
  onDone: () => void;
}

const DURATION = 0.35;

/** A brief muzzle-flash burst at a fort when it launches a major real transaction — the "war effect" beat. */
export default function CannonFlash({ position, color, scale, onDone }: Props) {
  const meshRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const age = useRef(0);
  const [done, setDone] = useState(false);

  useFrame((_, delta) => {
    if (done) return;
    age.current += delta;
    const t = Math.min(1, age.current / DURATION);
    const s = scale * (1.4 - t) * (t < 0.15 ? t / 0.15 : 1);
    if (meshRef.current) meshRef.current.scale.setScalar(Math.max(0.001, s));
    if (lightRef.current) lightRef.current.intensity = (1 - t) * 14 * scale;
    if (t >= 1) {
      setDone(true);
      onDone();
    }
  });

  return (
    <group position={position}>
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.5, 10, 10]} />
        <meshBasicMaterial color={color} transparent opacity={0.85} toneMapped={false} />
      </mesh>
      <pointLight ref={lightRef} color={color} intensity={14 * scale} distance={14} decay={2} />
    </group>
  );
}
