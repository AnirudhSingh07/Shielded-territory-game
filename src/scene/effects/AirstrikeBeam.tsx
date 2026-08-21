import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import Explosion from './Explosion';

interface Props {
  position: [number, number, number];
  color: THREE.ColorRepresentation;
  particleCount: number;
  scale: number;
  onDone: () => void;
}

const STRIKE_DURATION = 0.45;
const BEAM_HEIGHT = 22;

/**
 * A beam descending from the sky to mark a large flow event, followed by an
 * explosion burst at impact. Green descents read as reinforcements dropping
 * in behind the shielded line; red descents read as an incoming strike.
 */
export default function AirstrikeBeam({ position, color, particleCount, scale, onDone }: Props) {
  const beamRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const ageRef = useRef(0);
  const [impacted, setImpacted] = useState(false);

  useFrame((_, delta) => {
    if (impacted) return;
    ageRef.current += delta;
    const t = Math.min(1, ageRef.current / STRIKE_DURATION);
    if (beamRef.current) {
      const h = BEAM_HEIGHT * (1 - t);
      beamRef.current.scale.y = Math.max(h, 0.001);
      beamRef.current.position.y = h / 2;
    }
    if (matRef.current) matRef.current.opacity = 0.85 * (1 - t * 0.3);
    if (t >= 1) setImpacted(true);
  });

  return (
    <group position={position}>
      {!impacted && (
        <mesh ref={beamRef} position={[0, BEAM_HEIGHT / 2, 0]}>
          <cylinderGeometry args={[0.12 * scale, 0.35 * scale, 1, 8, 1, true]} />
          <meshBasicMaterial ref={matRef} color={color} transparent opacity={0.85} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
        </mesh>
      )}
      {impacted && <Explosion position={[0, 0, 0]} color={color} particleCount={particleCount} scale={scale} onDone={onDone} />}
    </group>
  );
}
