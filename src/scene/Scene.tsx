import { Canvas } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import * as THREE from 'three';
import Battlefield from './Battlefield';
import FogOfWar from './FogOfWar';
import FrontLine from './FrontLine';
import Fort from './Fort';
import Army from './Army';
import CameraRig from './CameraRig';
import EventEffectsManager from './effects/EventEffectsManager';
import type { WarState } from '../types';
import { frontLineToWorldX, SHIELD_FORT_X, shieldedFractionToFogOpacity, TRANSPARENT_FORT_X, zecToUnitCount } from '../logic/mapping';

const SHIELD_COLOR = new THREE.Color('#00e5a0');
const SHIELD_GLOW = new THREE.Color('#5dffce');
const TRANSPARENT_COLOR = new THREE.Color('#ff3b5c');
const TRANSPARENT_GLOW = new THREE.Color('#ff8fa3');

export default function Scene({ state }: { state: WarState }) {
  const frontLineWorldX = frontLineToWorldX(state.frontLine);
  const fogOpacity = shieldedFractionToFogOpacity(state.supply.shieldedFraction);

  const shieldUnits = zecToUnitCount(state.supply.shieldedZec, { min: 30, max: 300, refZec: state.supply.totalSupply * 0.55 });
  const transparentUnits = zecToUnitCount(state.supply.transparentZec, { min: 30, max: 300, refZec: state.supply.totalSupply * 0.55 });

  const shieldPush = Math.max(0, state.momentum);
  const transparentPush = Math.max(0, -state.momentum);
  const frontColor = state.momentum >= 0 ? SHIELD_COLOR : TRANSPARENT_COLOR;

  return (
    <Canvas
      shadows="soft"
      dpr={[1, 1.75]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      camera={{ fov: 45, near: 0.1, far: 200, position: [0, 26, 42] }}
    >
      <color attach="background" args={['#05070a']} />
      <fog attach="fog" args={['#05070a', 46, 105]} />

      <ambientLight intensity={0.35} />
      <hemisphereLight color="#274b52" groundColor="#050505" intensity={0.6} />
      <directionalLight
        position={[18, 24, 10]}
        intensity={1.1}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-40}
        shadow-camera-right={40}
        shadow-camera-top={40}
        shadow-camera-bottom={-40}
      />
      <pointLight position={[frontLineWorldX, 6, 0]} intensity={2} color={frontColor} distance={32} decay={2} />

      <Stars radius={100} depth={40} count={2200} factor={2.4} saturation={0} fade speed={0.4} />

      <Battlefield frontLineWorldX={frontLineWorldX} />
      <FogOfWar frontLineWorldX={frontLineWorldX} opacity={fogOpacity} />
      <FrontLine worldX={frontLineWorldX} color={frontColor} />

      <Fort side="shield" x={SHIELD_FORT_X} />
      <Fort side="transparent" x={TRANSPARENT_FORT_X} />

      <Army side="shield" count={shieldUnits} frontLineWorldX={frontLineWorldX} color={SHIELD_COLOR} emissiveColor={SHIELD_GLOW} push={shieldPush} />
      <Army side="transparent" count={transparentUnits} frontLineWorldX={frontLineWorldX} color={TRANSPARENT_COLOR} emissiveColor={TRANSPARENT_GLOW} push={transparentPush} />

      <EventEffectsManager events={state.events} shieldColor={SHIELD_GLOW} transparentColor={TRANSPARENT_GLOW} />

      <CameraRig />
    </Canvas>
  );
}
