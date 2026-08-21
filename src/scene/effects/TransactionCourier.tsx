import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getSoldierGeometry } from '../geometry/soldierGeometry';
import { terrainHeight } from '../terrain/heightField';
import Explosion from './Explosion';

interface Props {
  from: [number, number, number];
  to: [number, number, number];
  color: THREE.ColorRepresentation;
  scale: number;
  particleCount: number;
  onDone: () => void;
}

const SPEED = 15; // world units / second — a runner sprinting an order across the field

/**
 * The visual heart of "this is real, not simulated": one courier — a lone
 * soldier — sprints the length of the field for each CONFIRMED on-chain
 * transaction the moment it's observed. Shielding transactions run from the
 * Transparent Fort to the Shielded Fort; unshielding runs the other way.
 * Arrival triggers an Explosion (and, for large transactions,
 * EventEffectsManager also fires a cannon flash + camera shake).
 *
 * A modest emissive team wash is the ONE deliberate glow on a ground unit —
 * it's how a confirmed-event runner reads apart from the static army. It is
 * never applied to the standing armies or to the (ghostly) mempool scouts,
 * so the three unit classes stay visually distinct.
 */
export default function TransactionCourier({ from, to, color, scale, particleCount, onDone }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const ageRef = useRef(0);
  const [arrived, setArrived] = useState(false);

  const start = new THREE.Vector3(...from);
  const end = new THREE.Vector3(...to);
  // Shielding runs toward +X (the Shielded Fort); that direction picks the courier's team geometry.
  const team = end.x > start.x ? 'shield' : 'transparent';
  const geometry = useMemo(() => getSoldierGeometry(team), [team]);

  const distance = start.distanceTo(end);
  const duration = THREE.MathUtils.clamp(distance / SPEED, 0.7, 3.0);
  // Soldier geometry's local forward is -X; the rotation.y aligning it with travel (dx,dz) is atan2(dz, -dx).
  const facing = Math.atan2(end.z - start.z, -(end.x - start.x));

  useFrame((_, delta) => {
    if (arrived || !groupRef.current) return;
    ageRef.current += delta;
    const t = Math.min(1, ageRef.current / duration);
    const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    const pos = start.clone().lerp(end, eased);
    pos.y = terrainHeight(pos.x, pos.z) + Math.abs(Math.sin(ageRef.current * 11)) * 0.14; // follow ground + run bob
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
          <meshStandardMaterial vertexColors emissive={color} emissiveIntensity={0.4} roughness={0.7} />
        </mesh>
      )}
      {arrived && <Explosion position={[0, 0.5, 0]} color={color} particleCount={particleCount} scale={scale * 0.8} onDone={onDone} />}
    </group>
  );
}
