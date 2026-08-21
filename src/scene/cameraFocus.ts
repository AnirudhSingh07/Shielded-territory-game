/**
 * A tiny non-React signal (sibling to cameraShake.ts): a major CONFIRMED
 * real transaction asks the camera to punch in on the front line for a few
 * seconds so the viewer's eye is on the action when it lands. Plain module
 * state so requesting focus never triggers a React re-render — only the
 * imperative camera loop reads it.
 */

let focusUntilMs = 0;
let focusX = 0;
let focusStrength = 0;

export function requestFrontLineFocus(worldX: number, strength = 1, durationMs = 4200) {
  const now = performance.now();
  focusUntilMs = Math.max(focusUntilMs, now + durationMs);
  focusX = worldX;
  focusStrength = Math.max(focusStrength, strength);
}

/** 0 = no focus, up to 1 = full punch-in. Eases in then out around the focus window. */
export function getFocus(nowMs: number): { active: number; x: number } {
  if (nowMs >= focusUntilMs) {
    focusStrength = 0;
    return { active: 0, x: focusX };
  }
  const remaining = focusUntilMs - nowMs;
  const ramp = Math.min(1, remaining / 900); // ease out over the last ~0.9s
  return { active: ramp * focusStrength, x: focusX };
}
