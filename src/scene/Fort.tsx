import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { terrainHeight } from './terrain/heightField';

interface Props {
  side: 'shield' | 'transparent';
  x: number;
}

const CONCRETE = '#6a685f';
const CONCRETE_DARK = '#48473f';
const SLIT = '#141414';

const FLAG = {
  shield: new THREE.Color('#2f8f5b'),
  transparent: new THREE.Color('#b23a3a'),
};

/**
 * A real military fortification: a concrete bunker with a firing slit,
 * perimeter wall, corner guard towers, a sandbag gate, and a waving team
 * flag. Colours are muted concrete/olive; the only team-coloured element is
 * the flag (with a faint emissive so it reads at distance and catches a
 * touch of bloom) — that's the fort's identity marker, not decoration.
 */
export default function Fort({ side, x }: Props) {
  const flagRef = useRef<THREE.Mesh>(null);
  const y = useMemo(() => terrainHeight(x, 0), [x]);
  const flagColor = FLAG[side];
  // face the fort's gate toward the enemy (toward field center)
  const faceSign = x > 0 ? -1 : 1;

  const towerPositions: Array<[number, number]> = [
    [-4.2, -4.2],
    [4.2, -4.2],
    [-4.2, 4.2],
    [4.2, 4.2],
  ];

  useFrame(({ clock }) => {
    if (flagRef.current) {
      const t = clock.elapsedTime;
      flagRef.current.rotation.y = Math.sin(t * 2.2) * 0.18 + (faceSign > 0 ? 0 : Math.PI);
      flagRef.current.scale.x = 1 + Math.sin(t * 3.1) * 0.06;
    }
  });

  return (
    <group position={[x, y, 0]}>
      {/* raised concrete pad so the fort sits flat on uneven ground */}
      <mesh position={[0, 0.25, 0]} receiveShadow castShadow>
        <boxGeometry args={[11, 0.5, 11]} />
        <meshStandardMaterial color={CONCRETE_DARK} roughness={1} />
      </mesh>

      {/* perimeter walls */}
      {[
        { p: [0, 1.3, -5.2] as const, s: [10.4, 2.0, 0.7] as const },
        { p: [0, 1.3, 5.2] as const, s: [10.4, 2.0, 0.7] as const },
        { p: [-5.2, 1.3, 0] as const, s: [0.7, 2.0, 10.4] as const },
        { p: [5.2, 1.3, 0] as const, s: [0.7, 2.0, 10.4] as const },
      ].map((w, i) => (
        <mesh key={i} position={w.p} scale={w.s} castShadow receiveShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={CONCRETE} roughness={0.95} />
        </mesh>
      ))}

      {/* corner guard towers */}
      {towerPositions.map(([tx, tz], i) => (
        <group key={i} position={[tx, 0, tz]}>
          <mesh position={[0, 1.9, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.85, 1.0, 3.8, 8]} />
            <meshStandardMaterial color={CONCRETE} roughness={0.95} />
          </mesh>
          <mesh position={[0, 3.95, 0]} castShadow>
            <cylinderGeometry args={[1.05, 1.05, 0.35, 8]} />
            <meshStandardMaterial color={CONCRETE_DARK} roughness={1} />
          </mesh>
        </group>
      ))}

      {/* central bunker with firing slit */}
      <mesh position={[0, 1.4, 0]} castShadow receiveShadow>
        <boxGeometry args={[5.5, 2.8, 5.5]} />
        <meshStandardMaterial color={CONCRETE} roughness={0.95} />
      </mesh>
      <mesh position={[0, 3.1, 0]} castShadow receiveShadow>
        <sphereGeometry args={[2.9, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={CONCRETE_DARK} roughness={1} />
      </mesh>
      <mesh position={[faceSign * 2.78, 1.9, 0]}>
        <boxGeometry args={[0.15, 0.4, 3.2]} />
        <meshStandardMaterial color={SLIT} roughness={1} />
      </mesh>
      {/* faint interior glow behind the slit */}
      <pointLight position={[faceSign * 2.2, 1.9, 0]} color={flagColor} intensity={1.1} distance={6} decay={2} />

      {/* sandbag gate ring toward the enemy */}
      {[-1.4, 0, 1.4].map((gz) => (
        <mesh key={gz} position={[faceSign * 5.6, 0.7, gz]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <capsuleGeometry args={[0.32, 0.5, 3, 6]} />
          <meshStandardMaterial color="#7c7150" roughness={1} />
        </mesh>
      ))}

      {/* flagpole + waving team flag on top of the bunker */}
      <mesh position={[0, 5.4, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 4.4, 6]} />
        <meshStandardMaterial color="#2a2a2a" roughness={0.8} metalness={0.3} />
      </mesh>
      <mesh ref={flagRef} position={[0.85, 6.9, 0]}>
        <planeGeometry args={[1.7, 1.05, 6, 1]} />
        <meshStandardMaterial color={flagColor} emissive={flagColor} emissiveIntensity={0.5} roughness={0.6} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}
