/**
 * Device vibration (mobile) for war impacts — cosmetic tactile feedback,
 * gated by the effect-intensity setting so it's never constant buzzing.
 * A no-op where the Vibration API is unavailable (most desktops).
 */

import { useUIStore } from '../state/uiStore';

export function vibrate(ms: number, opts: { minIntensity?: 'normal' | 'high' } = {}) {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  const intensity = useUIStore.getState().intensity;
  if (intensity === 'low') return; // 'low' disables haptics entirely
  if (opts.minIntensity === 'high' && intensity !== 'high') return;
  try {
    navigator.vibrate(ms);
  } catch {
    // some browsers throw if called outside a user gesture — ignore
  }
}
