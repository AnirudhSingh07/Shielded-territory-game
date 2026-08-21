import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { FORT_RADIUS } from '../logic/mapping';

const SHIELD_GREEN = new THREE.Color('#00e5a0');
const SHIELD_GLOW = new THREE.Color('#7dffdb');

/**
 * The Shielded Fort — a fixed stronghold at the center of the map
 * representing the shielded pool itself. The privacy force garrisons and
 * defends it; every real shielding transaction sends a courier zebra in
 * through its gate, every unshielding transaction sends one back out.
 */
export default function Fort() {
  const coreRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (coreRef.current) {
      coreRef.current.rotation.y = t * 0.3;
      coreRef.current.position.y = 6.4 + Math.sin(t * 0.8) * 0.25;
    }
    if (ringRef.current) {
      ringRef.current.rotation.z = -t * 0.15;
    }
  });

  const towerAngles = [0, 72, 144, 216, 288].map((d) => (d * Math.PI) / 180);

  return (
    <group>
      {/* base platform */}
      <mesh position={[0, 0.15, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[FORT_RADIUS + 0.6, FORT_RADIUS + 1, 0.3, 24]} />
        <meshStandardMaterial color="#0a1712" roughness={0.85} metalness={0.1} />
      </mesh>

      {/* keep */}
      <mesh position={[0, 2.4, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[2.1, 2.5, 4.5, 16]} />
        <meshStandardMaterial color="#0e2a22" emissive={SHIELD_GREEN} emissiveIntensity={0.18} roughness={0.6} metalness={0.3} />
      </mesh>
      <mesh position={[0, 5.1, 0]} castShadow>
        <coneGeometry args={[2.35, 1.8, 16]} />
        <meshStandardMaterial color={SHIELD_GREEN} emissive={SHIELD_GREEN} emissiveIntensity={0.4} roughness={0.4} metalness={0.4} />
      </mesh>

      {/* corner towers */}
      {towerAngles.map((angle, i) => {
        const r = FORT_RADIUS - 1.1;
        const x = Math.cos(angle) * r;
        const z = Math.sin(angle) * r;
        return (
          <group key={i} position={[x, 0, z]}>
            <mesh position={[0, 1.5, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[0.55, 0.65, 3, 10]} />
              <meshStandardMaterial color="#0e2a22" emissive={SHIELD_GREEN} emissiveIntensity={0.15} roughness={0.65} metalness={0.25} />
            </mesh>
            <mesh position={[0, 3.25, 0]} castShadow>
              <coneGeometry args={[0.65, 0.7, 10]} />
              <meshStandardMaterial color={SHIELD_GREEN} emissive={SHIELD_GREEN} emissiveIntensity={0.35} roughness={0.4} />
            </mesh>
          </group>
        );
      })}

      {/* low outer wall */}
      <mesh position={[0, 0.9, 0]}>
        <torusGeometry args={[FORT_RADIUS - 1.1, 0.15, 8, 48]} />
        <meshStandardMaterial color={SHIELD_GREEN} emissive={SHIELD_GREEN} emissiveIntensity={0.25} roughness={0.5} />
      </mesh>

      {/* floating shield core above the keep */}
      <mesh ref={coreRef} position={[0, 6.4, 0]}>
        <icosahedronGeometry args={[0.7, 0]} />
        <meshStandardMaterial color={SHIELD_GLOW} emissive={SHIELD_GLOW} emissiveIntensity={1.1} roughness={0.2} metalness={0.6} />
      </mesh>
      <mesh ref={ringRef} position={[0, 6.4, 0]} rotation={[Math.PI / 2.4, 0, 0]}>
        <torusGeometry args={[1.15, 0.035, 8, 40]} />
        <meshBasicMaterial color={SHIELD_GLOW} transparent opacity={0.6} toneMapped={false} />
      </mesh>

      <pointLight position={[0, 6.4, 0]} color={SHIELD_GLOW} intensity={6} distance={22} decay={2} />
      <pointLight position={[0, 2, 0]} color={SHIELD_GREEN} intensity={3} distance={FORT_RADIUS * 2.4} decay={2} />
    </group>
  );
}
