import { lazy, Suspense } from 'react';
import { useZecFeed } from './data/useZecFeed';
import { useWebGLSupport } from './hooks/useWebGLSupport';
import HUD from './ui/HUD';
import LoadingScreen from './ui/LoadingScreen';

// Three.js is the bulk of the bundle — split it into its own chunk so the
// HUD/loading shell paints immediately while the 3D scene streams in behind it.
const Scene = lazy(() => import('./scene/Scene'));
const Canvas2DBattlefield = lazy(() => import('./scene/fallback/Canvas2DBattlefield'));

export default function App() {
  const { state, ready } = useZecFeed();
  const webglSupported = useWebGLSupport();

  if (!ready || !state) {
    return <LoadingScreen />;
  }

  return (
    <div className="relative h-full w-full bg-void">
      <Suspense fallback={<LoadingScreen />}>{webglSupported ? <Scene state={state} /> : <Canvas2DBattlefield state={state} />}</Suspense>
      <HUD state={state} />
    </div>
  );
}
