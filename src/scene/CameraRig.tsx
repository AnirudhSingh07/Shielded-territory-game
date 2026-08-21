import { useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { useUIStore } from '../state/uiStore';
import { getShakeOffset } from './cameraShake';
import { getFocus } from './cameraFocus';
import { SHIELD_FORT_X, TRANSPARENT_FORT_X } from '../logic/mapping';
import { terrainHeight } from './terrain/heightField';

const DEFAULT_POSITION = new THREE.Vector3(0, 24, 44);
const DEFAULT_TARGET = new THREE.Vector3(0, 0, 0);
const PAN_SPEED = 18;
const TRANSITION_S = 4;

interface Shot {
  name: string;
  targetX: (frontLineX: number) => number;
  targetLift: number; // metres above the ground at the target point
  radius: number;
  height: number;
  drift: number; // radians/second the shot slowly pans while held
  holdS: number;
}

/**
 * A rotating set of preset framings tuned for war feel: it favours low,
 * close angles on the front line and the two forts over high overviews, so a
 * viewer leaving it open sees the fighting, not a map. Targets follow the
 * terrain height so low shots never sit under a hill. On a major CONFIRMED
 * transaction, cameraFocus punches the view in on the front line (see below).
 */
const SHOTS: Shot[] = [
  { name: 'combat-low', targetX: (x) => x, targetLift: 2, radius: 16, height: 5, drift: 0.08, holdS: 26 },
  { name: 'front-line-sweep', targetX: (x) => x, targetLift: 1.5, radius: 25, height: 9, drift: 0.13, holdS: 22 },
  { name: 'shield-fort', targetX: () => SHIELD_FORT_X - 5, targetLift: 4, radius: 17, height: 9, drift: 0.05, holdS: 20 },
  { name: 'transparent-fort', targetX: () => TRANSPARENT_FORT_X + 5, targetLift: 4, radius: 17, height: 9, drift: 0.05, holdS: 20 },
  { name: 'flank', targetX: (x) => x, targetLift: 2, radius: 20, height: 7, drift: 0.1, holdS: 20 },
  { name: 'wide', targetX: () => 0, targetLift: 2, radius: 44, height: 24, drift: 0.04, holdS: 24 },
];

const scratchTarget = new THREE.Vector3();
const scratchPos = new THREE.Vector3();
const focusTarget = new THREE.Vector3();
const focusPos = new THREE.Vector3();

/**
 * Orbit + free-look camera: mouse/touch drag to orbit, scroll to zoom, WASD
 * to pan, a cycling war-focused shot list when idle (paused on interaction,
 * resumed a few seconds after), reset via uiStore.cameraResetToken, a
 * screen-shake kick (cameraShake.ts) and an event punch-in (cameraFocus.ts).
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
        transitionFrom.current = { pos: camera.position.clone(), target: controls.target.clone() };
        shotIndex.current = (shotIndex.current + 1) % shots.length;
        shotStartMs.current = nowMs;
        shotBaseAzimuth.current = Math.random() * Math.PI * 2;
        heldMs = 0;
      }

      const shot = shots[shotIndex.current];
      const tx = shot.targetX(frontLineRef.current);
      scratchTarget.set(tx, terrainHeight(tx, 0) + shot.targetLift, 0);
      const azimuth = shotBaseAzimuth.current + (heldMs / 1000) * shot.drift;
      scratchPos.set(scratchTarget.x + Math.cos(azimuth) * shot.radius, scratchTarget.y + shot.height, scratchTarget.z + Math.sin(azimuth) * shot.radius);
      // never let the camera dip below the ground it's flying over
      scratchPos.y = Math.max(scratchPos.y, terrainHeight(scratchPos.x, scratchPos.z) + 2.5);

      if (transitionFrom.current) {
        const t = Math.min(1, heldMs / (TRANSITION_S * 1000));
        const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        camera.position.lerpVectors(transitionFrom.current.pos, scratchPos, eased);
        controls.target.lerpVectors(transitionFrom.current.target, scratchTarget, eased);
        if (t >= 1) transitionFrom.current = null;
      } else {
        camera.position.copy(scratchPos);
        controls.target.copy(scratchTarget);
      }

      // Event punch-in: blend toward a tight, low combat framing on the front line.
      const focus = getFocus(nowMs);
      if (focus.active > 0.001) {
        focusTarget.set(focus.x, terrainHeight(focus.x, 0) + 2, 0);
        const fa = nowMs * 0.00012;
        focusPos.set(focus.x + Math.cos(fa) * 13, focusTarget.y + 4.5, Math.sin(fa) * 13 + 6);
        focusPos.y = Math.max(focusPos.y, terrainHeight(focusPos.x, focusPos.z) + 2.5);
        const k = focus.active * 0.85;
        camera.position.lerp(focusPos, k);
        controls.target.lerp(focusTarget, k);
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
      minDistance={7}
      maxDistance={90}
      maxPolarAngle={Math.PI * 0.495}
      minPolarAngle={0.08}
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
