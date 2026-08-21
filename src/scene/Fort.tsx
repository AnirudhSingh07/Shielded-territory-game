import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface Props {
  side: 'shield' | 'transparent';
  x: number;
}

const PALETTE = {
  shield: { base: new THREE.Color('#00e5a0'), glow: new THREE.Color('#7dffdb') },
  transparent: { base: new THREE.Color('#ff3b5c'), glow: new THREE.Color('#ff9db0') },
};

/**
 * A stronghold at each end of the field: the green Shielded Fort defends
 * the privacy pool, the red Transparent Fort defends the exposed one. Real
 * shielding transactions launch a courier + cannon flash from the
 * transparent fort toward the shielded fort; unshielding runs it back.
 */
export default function Fort({ side, x }: Props) {
  const coreRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const { base, glow } = PALETTE[side];
  const faceInward = side === 'shield' ? Math.PI : 0; // cosmetic only, towers are radially symmetric

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (coreRef.current) {
      coreRef.current.rotation.y = t * 0.3;
      coreRef.current.position.y = 6.2 + Math.sin(t * 0.8 + x) * 0.25;
    }
    if (ringRef.current) ringRef.current.rotation.z = -t * 0.15;
  });

  const towerOffsets: Array<[number, number]> = [
    [-1.7, -1.7],
    [-1.7, 1.7],
    [1.7, -1.7],
    [1.7, 1.7],
  ];

  return (
    <group position={[x, 0, 0]} rotation={[0, faceInward, 0]}>
      {/* base platform */}
      <mesh position={[0, 0.15, 0]} receiveShadow castShadow>
        <boxGeometry args={[6.4, 0.3, 8.2]} />
        <meshStandardMaterial color="#0a1114" roughness={0.85} metalness={0.1} />
      </mesh>

      {/* keep */}
      <mesh position={[0, 2.4, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[2.0, 2.4, 4.5, 14]} />
        <meshStandardMaterial color="#101c1a" emissive={base} emissiveIntensity={0.2} roughness={0.6} metalness={0.3} />
      </mesh>
      <mesh position={[0, 5.05, 0]} castShadow>
        <coneGeometry args={[2.25, 1.7, 14]} />
        <meshStandardMaterial color={base} emissive={base} emissiveIntensity={0.4} roughness={0.4} metalness={0.4} />
      </mesh>

      {/* corner towers */}
      {towerOffsets.map(([tx, tz], i) => (
        <group key={i} position={[tx, 0, tz]}>
          <mesh position={[0, 1.5, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.5, 0.6, 3, 10]} />
            <meshStandardMaterial color="#101c1a" emissive={base} emissiveIntensity={0.16} roughness={0.65} metalness={0.25} />
          </mesh>
          <mesh position={[0, 3.2, 0]} castShadow>
            <coneGeometry args={[0.6, 0.65, 10]} />
            <meshStandardMaterial color={base} emissive={base} emissiveIntensity={0.35} roughness={0.4} />
          </mesh>
        </group>
      ))}

      {/* low outer wall */}
      <mesh position={[0, 0.9, 0]}>
        <boxGeometry args={[5.6, 0.5, 7.4]} />
        <meshStandardMaterial color={base} emissive={base} emissiveIntensity={0.18} roughness={0.55} wireframe />
      </mesh>

      {/* floating core above the keep */}
      <mesh ref={coreRef} position={[0, 6.2, 0]}>
        <icosahedronGeometry args={[0.65, 0]} />
        <meshStandardMaterial color={glow} emissive={glow} emissiveIntensity={1.1} roughness={0.2} metalness={0.6} />
      </mesh>
      <mesh ref={ringRef} position={[0, 6.2, 0]} rotation={[Math.PI / 2.4, 0, 0]}>
        <torusGeometry args={[1.05, 0.03, 8, 40]} />
        <meshBasicMaterial color={glow} transparent opacity={0.6} toneMapped={false} />
      </mesh>

      {/* banner/flag pair flanking the gate */}
      {[-1.1, 1.1].map((fz) => (
        <group key={fz} position={[2.8, 0, fz]}>
          <mesh position={[0, 1.2, 0]}>
            <cylinderGeometry args={[0.03, 0.03, 2.4, 5]} />
            <meshStandardMaterial color="#1a1f1c" roughness={0.8} />
          </mesh>
          <mesh position={[0.28, 2.0, 0]}>
            <planeGeometry args={[0.6, 0.42]} />
            <meshStandardMaterial color={base} emissive={base} emissiveIntensity={0.5} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}

      <pointLight position={[0, 6.2, 0]} color={glow} intensity={5.5} distance={20} decay={2} />
      <pointLight position={[0, 2, 0]} color={base} intensity={2.6} distance={16} decay={2} />
    </group>
  );
}
