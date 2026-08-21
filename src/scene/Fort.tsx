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

const FLAME_COLOR = new THREE.Color('#ffb347');

/** Cheap noise-ish flicker: a few off-frequency sines summed, so it never looks like a clean loop. */
function flicker(t: number, phase: number): number {
  return 0.7 + 0.18 * Math.sin(t * 9 + phase) + 0.08 * Math.sin(t * 23 + phase * 2.7) + 0.05 * Math.sin(t * 5.3 + phase * 0.4);
}

/**
 * A stronghold at each end of the field: the green Shielded Fort defends
 * the privacy pool, the red Transparent Fort defends the exposed one. Real
 * shielding transactions launch a courier + cannon flash from the
 * transparent fort toward the shielded fort; unshielding runs it back.
 *
 * The torches, banners, and floating core all animate continuously and
 * independently of any data — the point is that the fort never looks
 * "frozen" during a real quiet stretch between transactions.
 */
export default function Fort({ side, x }: Props) {
  const coreRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const bannerRefs = useRef<Array<THREE.Group | null>>([]);
  const flameRefs = useRef<Array<THREE.Mesh | null>>([]);
  const flameLightRefs = useRef<Array<THREE.PointLight | null>>([]);
  const { base, glow } = PALETTE[side];
  const faceInward = side === 'shield' ? Math.PI : 0; // cosmetic only, towers are radially symmetric

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (coreRef.current) {
      coreRef.current.rotation.y = t * 0.3;
      coreRef.current.position.y = 6.2 + Math.sin(t * 0.8 + x) * 0.25;
    }
    if (ringRef.current) ringRef.current.rotation.z = -t * 0.15;

    bannerRefs.current.forEach((g, i) => {
      if (!g) return;
      g.rotation.z = Math.sin(t * 1.4 + i * 2.1 + x) * 0.14;
      g.rotation.y = Math.sin(t * 0.9 + i * 3.3 + x) * 0.08;
    });
    flameRefs.current.forEach((m, i) => {
      if (!m) return;
      const f = flicker(t, i * 4.2 + x);
      m.scale.set(0.85 + f * 0.3, 1 + f * 0.5, 0.85 + f * 0.3);
    });
    flameLightRefs.current.forEach((l, i) => {
      if (!l) return;
      l.intensity = 2.2 * flicker(t, i * 4.2 + x + 1.7);
    });
  });

  const towerOffsets: Array<[number, number]> = [
    [-1.7, -1.7],
    [-1.7, 1.7],
    [1.7, -1.7],
    [1.7, 1.7],
  ];
  const torchOffsets: Array<[number, number]> = [
    [3.4, -2.6],
    [3.4, 2.6],
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

      {/* banner/flag pair flanking the gate — sways continuously, see useFrame above */}
      {[-1.1, 1.1].map((fz, i) => (
        <group key={fz} position={[2.8, 0, fz]} ref={(el) => { bannerRefs.current[i] = el; }}>
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

      {/* flickering gate torches — continuous, independent of any data */}
      {torchOffsets.map(([tx, tz], i) => (
        <group key={i} position={[tx, 0, tz]}>
          <mesh position={[0, 0.9, 0]} castShadow>
            <cylinderGeometry args={[0.045, 0.06, 1.8, 6]} />
            <meshStandardMaterial color="#1a1f1c" roughness={0.85} />
          </mesh>
          <mesh position={[0, 1.85, 0]}>
            <cylinderGeometry args={[0.16, 0.1, 0.14, 8]} />
            <meshStandardMaterial color="#2a221a" roughness={0.8} metalness={0.2} />
          </mesh>
          <mesh ref={(el) => { flameRefs.current[i] = el; }} position={[0, 2.05, 0]}>
            <coneGeometry args={[0.11, 0.34, 8]} />
            <meshBasicMaterial color={FLAME_COLOR} transparent opacity={0.9} toneMapped={false} />
          </mesh>
          <pointLight ref={(el) => { flameLightRefs.current[i] = el; }} position={[0, 2.1, 0]} color={FLAME_COLOR} intensity={2} distance={7} decay={2} />
        </group>
      ))}

      <pointLight position={[0, 6.2, 0]} color={glow} intensity={5.5} distance={20} decay={2} />
      <pointLight position={[0, 2, 0]} color={base} intensity={2.6} distance={16} decay={2} />
    </group>
  );
}
