import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getZebraGeometry } from '../geometry/zebraGeometry';
import Explosion from './Explosion';

interface Props {
  from: [number, number, number];
  to: [number, number, number];
  color: THREE.ColorRepresentation;
  scale: number;
  particleCount: number;
  onDone: () => void;
}

const SPEED = 10; // world units / second

/**
 * The visual heart of "this is real, not simulated": one courier zebra per
 * real on-chain transaction, physically running the length of the field
 * between the two forts the moment it's observed. Shielding transactions
 * run from the Transparent Fort to the Shielded Fort; unshielding runs the
 * other way. Arrival triggers an Explosion (and, for large transactions,
 * EventEffectsManager also fires a cannon flash + camera shake).
 */
export default function TransactionCourier({ from, to, color, scale, particleCount, onDone }: Props) {
  const groupRef = useRef<THREE.Group>(null); // position + facing only — Explosion (a sibling) needs an un-shrunk frame
  const meshRef = useRef<THREE.Mesh>(null); // the zebra body fades/shrinks on arrival, independent of the group
  const ageRef = useRef(0);
  const [arrived, setArrived] = useState(false);
  const geometry = getZebraGeometry();

  const start = new THREE.Vector3(...from);
  const end = new THREE.Vector3(...to);
  const distance = start.distanceTo(end);
  const duration = THREE.MathUtils.clamp(distance / SPEED, 0.7, 3.2);
  // The zebra geometry's local forward is -X (see zebraGeometry.ts's final rotateY(PI)); solving
  // for the rotation.y that points that vector along the real travel direction (dx, dz) gives
  // atan2(dz, -dx) rather than the more common atan2(dz, dx) you'd use for a +X-forward model.
  const facing = Math.atan2(end.z - start.z, -(end.x - start.x));

  useFrame((_, delta) => {
    if (arrived || !groupRef.current) return;
    ageRef.current += delta;
    const t = Math.min(1, ageRef.current / duration);
    const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    const pos = start.clone().lerp(end, eased);
    pos.y += Math.sin(t * Math.PI) * 0.9 * scale; // little running arc
    pos.y += Math.abs(Math.sin(ageRef.current * 9)) * 0.1; // gallop bob
    groupRef.current.position.copy(pos);
    if (meshRef.current) {
      const fade = t > 0.85 ? 1 - (t - 0.85) / 0.15 : 1;
      meshRef.current.scale.setScalar(scale * fade);
    }
    if (t >= 1) setArrived(true);
  });

  return (
    <group ref={groupRef} position={from} rotation={[0, facing, 0]}>
      {!arrived && (
        <mesh ref={meshRef} geometry={geometry} scale={scale} castShadow>
          <meshStandardMaterial vertexColors emissive={color} emissiveIntensity={0.55} roughness={0.5} />
        </mesh>
      )}
      {arrived && <Explosion position={[0, 0.4, 0]} color={color} particleCount={particleCount} scale={scale * 0.8} onDone={onDone} />}
    </group>
  );
}
