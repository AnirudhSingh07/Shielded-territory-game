import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { useUIStore } from '../state/uiStore';
import { getShakeOffset } from './cameraShake';

const DEFAULT_POSITION = new THREE.Vector3(0, 26, 42);
const DEFAULT_TARGET = new THREE.Vector3(0, 0, 0);
const PAN_SPEED = 18;

/**
 * Orbit + free-look camera: mouse/touch drag to orbit, scroll to zoom, WASD
 * to pan, slow automatic orbit when idle (paused on user interaction,
 * resumed a couple seconds after they let go), a reset-to-default driven by
 * uiStore.cameraResetToken, and a screen-shake kick (cameraShake.ts) applied
 * on top of whatever OrbitControls computed, for major real-transaction events.
 */
export default function CameraRig() {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const { camera } = useThree();
  const autoOrbit = useUIStore((s) => s.autoOrbit);
  const setAutoOrbit = useUIStore((s) => s.setAutoOrbit);
  const resetToken = useUIStore((s) => s.cameraResetToken);
  const keys = useRef<Record<string, boolean>>({});
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keys.current[e.key.toLowerCase()] = true;
    };
    const up = (e: KeyboardEvent) => {
      keys.current[e.key.toLowerCase()] = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  useEffect(() => {
    camera.position.copy(DEFAULT_POSITION);
    controlsRef.current?.target.copy(DEFAULT_TARGET);
    controlsRef.current?.update();
  }, [resetToken, camera]);

  const handleStart = () => {
    setAutoOrbit(false);
    if (idleTimer.current) clearTimeout(idleTimer.current);
  };
  const handleEnd = () => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => setAutoOrbit(true), 4000);
  };

  useFrame((_, delta) => {
    const controls = controlsRef.current;
    if (!controls) return;

    const anyKey = keys.current['w'] || keys.current['a'] || keys.current['s'] || keys.current['d'];
    if (anyKey) {
      const forward = new THREE.Vector3();
      camera.getWorldDirection(forward);
      forward.y = 0;
      forward.normalize();
      const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
      const move = new THREE.Vector3();
      if (keys.current['w']) move.add(forward);
      if (keys.current['s']) move.sub(forward);
      if (keys.current['d']) move.add(right);
      if (keys.current['a']) move.sub(right);
      if (move.lengthSq() > 0) {
        move.normalize().multiplyScalar(PAN_SPEED * delta);
        camera.position.add(move);
        controls.target.add(move);
      }
    }

    if (autoOrbit && !anyKey) {
      // Slow ambient orbit around the fort for the "leave it open" hypnotic feel.
      const angle = delta * 0.06;
      const p = camera.position;
      const c = Math.cos(angle);
      const s = Math.sin(angle);
      const relX = p.x - controls.target.x;
      const relZ = p.z - controls.target.z;
      camera.position.x = controls.target.x + relX * c - relZ * s;
      camera.position.z = controls.target.z + relX * s + relZ * c;
    }

    controls.update();

    const shake = getShakeOffset(performance.now());
    if (shake.x || shake.y || shake.z) {
      camera.position.x += shake.x;
      camera.position.y += shake.y;
      camera.position.z += shake.z;
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.08}
      minDistance={10}
      maxDistance={70}
      maxPolarAngle={Math.PI * 0.49}
      minPolarAngle={0.15}
      onStart={handleStart}
      onEnd={handleEnd}
    />
  );
}
