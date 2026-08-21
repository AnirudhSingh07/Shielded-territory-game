import { Canvas } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import Terrain from './env/Terrain';
import River from './env/River';
import Vegetation from './env/Vegetation';
import Structures from './env/Structures';
import Fort from './Fort';
import Army from './Army';
import GrowthMonument from './GrowthMonument';
import MempoolScouts from './MempoolScouts';
import AmbientDust from './AmbientDust';
import Horizon from './Horizon';
import CameraRig from './CameraRig';
import EventEffectsManager from './effects/EventEffectsManager';
import FrontLineSkirmish from './effects/FrontLineSkirmish';
import Firefight from './effects/Firefight';
import type { WarState } from '../types';
import { frontLineToWorldX, SHIELD_FORT_X, TRANSPARENT_FORT_X, zecToUnitCount } from '../logic/mapping';

const SHIELD_GLOW = new THREE.Color('#7dffce');
const TRANSPARENT_GLOW = new THREE.Color('#ff8f7a');

export default function Scene({ state }: { state: WarState }) {
  const frontLineWorldX = frontLineToWorldX(state.frontLine);

  const shieldUnits = zecToUnitCount(state.supply.shieldedZec, { min: 30, max: 300, refZec: state.supply.totalSupply * 0.55 });
  const transparentUnits = zecToUnitCount(state.supply.transparentZec, { min: 30, max: 300, refZec: state.supply.totalSupply * 0.55 });

  // signed war fortune per side, from real momentum: shield gains on positive momentum, transparent on negative
  const shieldAdvance = state.momentum;
  const transparentAdvance = -state.momentum;

  return (
    <Canvas
      shadows="soft"
      dpr={[1, 1.75]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      camera={{ fov: 45, near: 0.1, far: 260, position: [0, 26, 46] }}
    >
      {/* dusk battlefield — grounded, not near-black */}
      <color attach="background" args={['#242f3a']} />
      <fog attach="fog" args={['#26313c', 72, 165]} />

      <ambientLight intensity={0.68} color="#9fb0c2" />
      <hemisphereLight color="#6b7889" groundColor="#2a271f" intensity={0.9} />
      {/* low warm sun */}
      <directionalLight
        position={[-34, 24, 16]}
        intensity={2.15}
        color="#ffdca6"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-46}
        shadow-camera-right={46}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
        shadow-camera-far={120}
        shadow-bias={-0.0004}
      />

      <Stars radius={140} depth={50} count={900} factor={2.6} saturation={0} fade speed={0.3} />
      <Horizon />

      <Terrain />
      <River />
      <Vegetation />
      <Structures />

      <Fort side="shield" x={SHIELD_FORT_X} />
      <Fort side="transparent" x={TRANSPARENT_FORT_X} />

      <Army side="shield" count={shieldUnits} frontLineWorldX={frontLineWorldX} advance={shieldAdvance} />
      <Army side="transparent" count={transparentUnits} frontLineWorldX={frontLineWorldX} advance={transparentAdvance} />

      <GrowthMonument
        sessionNetShieldedZec={state.sessionNetShieldedZec}
        absoluteShieldedZec={state.supply.shieldedZec}
        shieldedFraction={state.supply.shieldedFraction}
      />

      <MempoolScouts scouts={state.scouts} frontLineWorldX={frontLineWorldX} />
      <EventEffectsManager events={state.events} frontLineWorldX={frontLineWorldX} shieldColor={SHIELD_GLOW} transparentColor={TRANSPARENT_GLOW} />
      <FrontLineSkirmish worldX={frontLineWorldX} />
      <Firefight worldX={frontLineWorldX} />

      <AmbientDust />
      <CameraRig frontLineWorldX={frontLineWorldX} />

      <EffectComposer multisampling={0}>
        {/* toned-down bloom: only genuine highlights (muzzle flashes, the monument, flags) glow */}
        <Bloom mipmapBlur luminanceThreshold={0.62} luminanceSmoothing={0.3} intensity={0.5} radius={0.6} />
        <Vignette eskil={false} offset={0.3} darkness={0.62} />
      </EffectComposer>
    </Canvas>
  );
}
