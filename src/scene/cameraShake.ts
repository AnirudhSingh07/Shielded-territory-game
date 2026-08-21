/**
 * A tiny, deliberately non-React shared value: war effects call
 * `triggerShake` when a major real transaction lands, and CameraRig reads
 * `getShakeOffset` once per frame inside its own useFrame loop. Plain module
 * state (not a Zustand store) so a shake trigger never causes a React
 * re-render — only the imperative camera loop needs to know about it.
 */

let shakeUntilMs = 0;
let shakeAmount = 0;

export function triggerShake(amount: number, durationMs = 450) {
  shakeAmount = Math.max(shakeAmount, amount);
  shakeUntilMs = Math.max(shakeUntilMs, performance.now() + durationMs);
}

export function getShakeOffset(nowMs: number): { x: number; y: number; z: number } {
  if (nowMs >= shakeUntilMs) return { x: 0, y: 0, z: 0 };
  const remaining = (shakeUntilMs - nowMs) / 1000;
  const falloff = Math.min(1, remaining * 2.4);
  const mag = shakeAmount * falloff;
  return {
    x: (Math.random() - 0.5) * mag,
    y: (Math.random() - 0.5) * mag * 0.6,
    z: (Math.random() - 0.5) * mag,
  };
}
