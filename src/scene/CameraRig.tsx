import { useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { useUIStore } from '../state/uiStore';
import { getShakeOffset } from './cameraShake';
import { SHIELD_FORT_X, TRANSPARENT_FORT_X } from '../logic/mapping';

const DEFAULT_POSITION = new THREE.Vector3(0, 26, 42);
const DEFAULT_TARGET = new THREE.Vector3(0, 0, 0);
const PAN_SPEED = 18;
const TRANSITION_S = 4;

interface Shot {
  name: string;
  target: (frontLineX: number) => THREE.Vector3;
  radius: number;
  height: number;
  drift: number; // radians/second the shot slowly pans while held, for continuous motion within a shot
  holdS: number;
}

/**
 * A rotating set of preset framings (inspired by "cinematic mode" on
 * reference battlefield dashboards) so a viewer leaving this open for hours
 * sees a produced highlight reel — wide shot, a sweep along the live front
 * line, a close pass on each fort, a high overview — rather than one static
 * orbit forever. Every shot keeps drifting while held, so there's always
 * some motion even mid-shot.
 */
const SHOTS: Shot[] = [
  { name: 'wide', target: () => new THREE.Vector3(0, 1, 0), radius: 44, height: 25, drift: 0.045, holdS: 34 },
  { name: 'front-line-sweep', target: (x) => new THREE.Vector3(x, 0.5, 0), radius: 20, height: 6.5, drift: 0.11, holdS: 22 },
  { name: 'shield-fort-close', target: () => new THREE.Vector3(SHIELD_FORT_X - 4, 3, 0), radius: 15, height: 8.5, drift: 0.05, holdS: 26 },
  { name: 'high-overview', target: () => new THREE.Vector3(0, 0, 0), radius: 58, height: 46, drift: 0.03, holdS: 24 },
  { name: 'transparent-fort-close', target: () => new THREE.Vector3(TRANSPARENT_FORT_X + 4, 3, 0), radius: 15, height: 8.5, drift: 0.05, holdS: 26 },
];

/**
 * Orbit + free-look camera: mouse/touch drag to orbit, scroll to zoom, WASD
 * to pan, a cycling cinematic shot list when idle (paused on user
 * interaction, resumed a few seconds after they let go), a reset-to-default
 * driven by uiStore.cameraResetToken, and a screen-shake kick
 * (cameraShake.ts) applied on top for major real-transaction events.
 */
export default function CameraRig({ frontLineWorldX }: { frontLineWorldX: number }) {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const { camera } = useThree();
  const autoOrbit = useUIStore((s) => s.autoOrbit);
  const setAutoOrbit = useUIStore((s) => s.setAutoOrbit);
  const resetToken = useUIStore((s) => s.cameraResetToken);
  const keys = useRef<Record<string, boolean>>({});
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const frontLineRef = useRef(frontLineWorldX);
  useEffect(() => {
    frontLineRef.current = frontLineWorldX;
  }, [frontLineWorldX]);

  // Shuffle the shot order once per session so every visit doesn't open on the same framing.
  // The one-time-random values below live in a useState initializer (run exactly once, on
  // mount) rather than directly in a useRef(...) call, which would technically re-evaluate
  // Math.random()/performance.now() on every render even though only the first result is kept.
  const [{ shots, initialAzimuth }] = useState(() => ({ shots: shuffled(SHOTS), initialAzimuth: Math.random() * Math.PI * 2 }));
  const shotIndex = useRef(0);
  const shotStartMs = useRef(0);
  const shotBaseAzimuth = useRef(initialAzimuth);
  const transitionFrom = useRef<{ pos: THREE.Vector3; target: THREE.Vector3 } | null>(null);

  useEffect(() => {
    shotStartMs.current = performance.now();
  }, []);

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
    shotIndex.current = 0;
    shotStartMs.current = performance.now();
    transitionFrom.current = null;
  }, [resetToken, camera]);

  const handleStart = () => {
    setAutoOrbit(false);
    if (idleTimer.current) clearTimeout(idleTimer.current);
  };
  const handleEnd = () => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      // Re-entering cinematic mode always starts a fresh transition from wherever the user left the camera.
      transitionFrom.current = { pos: camera.position.clone(), target: controlsRef.current?.target.clone() ?? DEFAULT_TARGET.clone() };
      shotStartMs.current = performance.now();
      shotBaseAzimuth.current = Math.random() * Math.PI * 2;
      setAutoOrbit(true);
    }, 4000);
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
      const nowMs = performance.now();
      let heldMs = nowMs - shotStartMs.current;

      if (heldMs > shots[shotIndex.current].holdS * 1000) {
        // Advance to the next shot and start a fresh transition from the current camera pose.
        transitionFrom.current = { pos: camera.position.clone(), target: controls.target.clone() };
        shotIndex.current = (shotIndex.current + 1) % shots.length;
        shotStartMs.current = nowMs;
        shotBaseAzimuth.current = Math.random() * Math.PI * 2;
        heldMs = 0;
      }

      const shot = shots[shotIndex.current];
      const target = shot.target(frontLineRef.current);
      const azimuth = shotBaseAzimuth.current + (heldMs / 1000) * shot.drift;
      const desiredPos = new THREE.Vector3(target.x + Math.cos(azimuth) * shot.radius, target.y + shot.height, target.z + Math.sin(azimuth) * shot.radius);

      if (transitionFrom.current) {
        const t = Math.min(1, heldMs / (TRANSITION_S * 1000));
        const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        camera.position.lerpVectors(transitionFrom.current.pos, desiredPos, eased);
        controls.target.lerpVectors(transitionFrom.current.target, target, eased);
        if (t >= 1) transitionFrom.current = null;
      } else {
        camera.position.copy(desiredPos);
        controls.target.copy(target);
      }
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
      minDistance={8}
      maxDistance={80}
      maxPolarAngle={Math.PI * 0.49}
      minPolarAngle={0.1}
      onStart={handleStart}
      onEnd={handleEnd}
    />
  );
}

function shuffled<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
