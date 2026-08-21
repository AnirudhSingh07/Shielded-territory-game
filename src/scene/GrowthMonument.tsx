import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { SHIELD_FORT_X } from '../logic/mapping';
import { terrainHeight } from './terrain/heightField';

interface Props {
  sessionNetShieldedZec: number;
  absoluteShieldedZec: number;
  shieldedFraction: number;
}

const MONUMENT_X = SHIELD_FORT_X - 13;
const MAX_TIERS = 16;
const BASE_TIERS = 4;
const TIER_HEIGHT = 1.15;
const ZEC_PER_TIER = 3; // one new crystal tier per ~3 real ZEC shielded this session
const GREEN = new THREE.Color('#25e39a');
const GREEN_BRIGHT = new THREE.Color('#9dffd9');

/**
 * The Shielded Growth Monument — the beacon the whole visualization is
 * rooting for. A layered crystal spire on the shielded side whose height,
 * tier count, and glow grow with REAL shielding: its *visible* growth is
 * driven by net shielded ZEC observed live this session (starts at 0, only
 * real confirmed positive deltas raise it), while the label reports the
 * honest anchored absolute total. Big real shielding events make it flare.
 *
 * This structure is allowed to glow — it's a beacon, not neon set-dressing —
 * but every number attached to it is real, badged LIVE·ANCHORED.
 */
export default function GrowthMonument({ sessionNetShieldedZec, absoluteShieldedZec, shieldedFraction }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const tierRefs = useRef<Array<THREE.Mesh | null>>([]);
  const apexRef = useRef<THREE.Mesh>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const visibleTiersRef = useRef(BASE_TIERS);
  const glowRef = useRef(0.5);
  const prevSessionRef = useRef(sessionNetShieldedZec);

  const groundY = useMemo(() => terrainHeight(MONUMENT_X, 0), []);

  const targetTiers = Math.min(MAX_TIERS, BASE_TIERS + Math.max(0, Math.floor(sessionNetShieldedZec / ZEC_PER_TIER)));

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime;

    // pulse when the session net jumps up (a real shielding just confirmed)
    const grew = sessionNetShieldedZec - prevSessionRef.current;
    if (grew > 0.001) glowRef.current = Math.min(2.4, glowRef.current + Math.min(1.6, grew * 0.4));
    prevSessionRef.current = sessionNetShieldedZec;
    glowRef.current += (0.55 - glowRef.current) * Math.min(1, delta * 0.8); // relax back to idle glow

    visibleTiersRef.current += (targetTiers - visibleTiersRef.current) * Math.min(1, delta * 1.5);
    const vt = visibleTiersRef.current;

    for (let i = 0; i < MAX_TIERS; i++) {
      const mesh = tierRefs.current[i];
      if (!mesh) continue;
      const filled = THREE.MathUtils.clamp(vt - i, 0, 1);
      const s = filled * (1 - i / (MAX_TIERS + 4)); // taper upward
      mesh.scale.setScalar(Math.max(0.0001, s));
      mesh.position.y = i * TIER_HEIGHT * (vt > i ? 1 : 0.0001);
      mesh.rotation.y = t * 0.25 + i * 0.4;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.5 + glowRef.current * 0.6;
    }

    if (apexRef.current) {
      apexRef.current.position.y = vt * TIER_HEIGHT + 0.6 + Math.sin(t * 1.4) * 0.15;
      apexRef.current.rotation.y = -t * 0.6;
      (apexRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.2 + glowRef.current;
    }
    if (haloRef.current) {
      haloRef.current.position.y = vt * TIER_HEIGHT + 0.6;
      haloRef.current.rotation.z = t * 0.4;
      haloRef.current.scale.setScalar(1 + glowRef.current * 0.15);
    }
    if (lightRef.current) {
      lightRef.current.position.y = vt * TIER_HEIGHT + 1;
      lightRef.current.intensity = 3 + glowRef.current * 4;
    }
  });

  const sessionSign = sessionNetShieldedZec >= 0 ? '+' : '−';
  const sessionAbs = Math.abs(sessionNetShieldedZec);
  const labelY = MAX_TIERS * TIER_HEIGHT * 0.5 + groundY + 6;

  return (
    <group ref={groupRef} position={[MONUMENT_X, groundY, 0]}>
      {/* plinth */}
      <mesh position={[0, 0.4, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[2.4, 3.0, 0.8, 8]} />
        <meshStandardMaterial color="#31413a" roughness={0.8} metalness={0.2} />
      </mesh>

      {/* crystal tiers */}
      <group position={[0, 0.9, 0]}>
        {Array.from({ length: MAX_TIERS }).map((_, i) => (
          <mesh key={i} ref={(el) => { tierRefs.current[i] = el; }} castShadow>
            <octahedronGeometry args={[1.5, 0]} />
            <meshStandardMaterial color={GREEN} emissive={GREEN} emissiveIntensity={0.6} roughness={0.25} metalness={0.5} transparent opacity={0.92} />
          </mesh>
        ))}
        <mesh ref={apexRef}>
          <octahedronGeometry args={[0.7, 0]} />
          <meshStandardMaterial color={GREEN_BRIGHT} emissive={GREEN_BRIGHT} emissiveIntensity={1.4} roughness={0.15} metalness={0.6} />
        </mesh>
        <mesh ref={haloRef} rotation={[Math.PI / 2.3, 0, 0]}>
          <torusGeometry args={[1.7, 0.05, 8, 48]} />
          <meshBasicMaterial color={GREEN_BRIGHT} transparent opacity={0.7} toneMapped={false} />
        </mesh>
      </group>

      <pointLight ref={lightRef} color={GREEN_BRIGHT} intensity={3} distance={30} decay={2} />

      <Html position={[0, labelY, 0]} center distanceFactor={30} pointerEvents="none" zIndexRange={[8, 0]}>
        <div style={labelStyle}>
          <div style={titleStyle}>SHIELDED GROWTH</div>
          <div style={bigStyle}>
            {sessionSign}
            {sessionAbs.toLocaleString(undefined, { maximumFractionDigits: sessionAbs < 1 ? 4 : 2 })} ZEC
            <span style={sinceStyle}> this session</span>
          </div>
          <div style={subStyle}>
            {Math.round(absoluteShieldedZec).toLocaleString()} ZEC shielded · {(shieldedFraction * 100).toFixed(1)}%
          </div>
          <div style={badgeStyle}>● LIVE·ANCHORED</div>
        </div>
      </Html>
    </group>
  );
}

const labelStyle: React.CSSProperties = {
  fontFamily: "'Rajdhani', system-ui, sans-serif",
  textAlign: 'center',
  color: '#dffff2',
  textShadow: '0 0 12px rgba(37,227,154,0.6)',
  whiteSpace: 'nowrap',
  userSelect: 'none',
};
const titleStyle: React.CSSProperties = { fontSize: 13, fontWeight: 700, letterSpacing: '0.28em', color: '#7dffce' };
const bigStyle: React.CSSProperties = { fontSize: 30, fontWeight: 700, lineHeight: 1.1, fontFamily: "'Orbitron', 'Rajdhani', sans-serif" };
const sinceStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, opacity: 0.7, letterSpacing: '0.05em' };
const subStyle: React.CSSProperties = { fontSize: 13, opacity: 0.85, fontVariantNumeric: 'tabular-nums' };
const badgeStyle: React.CSSProperties = { marginTop: 2, fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', color: '#25e39a' };
