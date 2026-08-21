import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface Props {
  position: [number, number, number];
  color: THREE.ColorRepresentation;
  particleCount: number;
  scale: number;
  onDone: () => void;
}

const LIFETIME = 1.6;

/** A single burst of particles fired outward and up, then fading — a "shielding surge" or "unshielding breach" event. */
export default function Explosion({ position, color, particleCount, scale, onDone }: Props) {
  const pointsRef = useRef<THREE.Points>(null);
  const ageRef = useRef(0);
  const doneRef = useRef(false);

  // Computed once via the state initializer (never recomputed — each Explosion is a
  // fresh, keyed instance for a single event) rather than useMemo, so the one-time
  // randomization doesn't run again on re-render.
  const [{ positions, velocities }] = useState(() => {
    const positions = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * 0.5;
      const speed = (2.5 + Math.random() * 4.5) * scale;
      velocities[i * 3] = Math.cos(theta) * Math.sin(phi) * speed;
      velocities[i * 3 + 1] = Math.cos(phi) * speed * 1.4;
      velocities[i * 3 + 2] = Math.sin(theta) * Math.sin(phi) * speed;
      positions[i * 3] = 0;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = 0;
    }
    return { positions, velocities };
  });

  const geomRef = useRef<THREE.BufferGeometry>(null);

  useFrame((_, delta) => {
    ageRef.current += delta;
    const t = ageRef.current;
    if (t > LIFETIME) {
      if (!doneRef.current) {
        doneRef.current = true;
        onDone();
      }
      return;
    }
    const geom = geomRef.current;
    if (!geom) return;
    const posAttr = geom.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < particleCount; i++) {
      const vx = velocities[i * 3];
      const vy = velocities[i * 3 + 1] - 9.8 * t * 0.5; // gravity pulls the arc down
      const vz = velocities[i * 3 + 2];
      posAttr.setXYZ(i, vx * t, Math.max(vy * t, -1), vz * t);
    }
    posAttr.needsUpdate = true;
    const mat = pointsRef.current?.material as THREE.PointsMaterial | undefined;
    if (mat) mat.opacity = Math.max(0, 1 - t / LIFETIME);
  });

  return (
    <group position={position}>
      <points ref={pointsRef}>
        <bufferGeometry ref={geomRef}>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <pointsMaterial color={color} size={0.22 * scale} transparent opacity={1} sizeAttenuation depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
      <pointLight color={color} intensity={12 * scale} distance={10 * scale} decay={2} />
    </group>
  );
}
