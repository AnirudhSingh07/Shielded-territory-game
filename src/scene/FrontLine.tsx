import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { FIELD_DEPTH } from '../logic/mapping';

interface Props {
  worldX: number;
  color: THREE.ColorRepresentation;
}

/** A glowing emissive ribbon marking the live front line, pulsing with battlefield tension. */
export default function FrontLine({ worldX, color }: Props) {
  const group = useRef<THREE.Group>(null);
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  const smoothed = useRef(worldX);

  useFrame(({ clock }, delta) => {
    smoothed.current += (worldX - smoothed.current) * Math.min(1, delta * 1.6);
    if (group.current) group.current.position.x = smoothed.current;
    if (mat.current) {
      const pulse = 0.55 + 0.45 * Math.sin(clock.elapsedTime * 3);
      mat.current.opacity = 0.5 + pulse * 0.4;
    }
  });

  return (
    <group ref={group} position={[worldX, 0.05, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.5, FIELD_DEPTH]} />
        <meshBasicMaterial ref={mat} color={color} transparent opacity={0.8} toneMapped={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.6, FIELD_DEPTH]} />
        <meshBasicMaterial color={color} transparent opacity={0.15} toneMapped={false} />
      </mesh>
    </group>
  );
}
