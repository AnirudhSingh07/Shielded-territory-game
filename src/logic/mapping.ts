/**
 * Pure functions mapping WarState numbers onto visual/scene parameters.
 * Kept separate from data-fetching and from React/Three so the "what does a
 * shielded % actually look like" logic is easy to read, test, and tune in
 * one place.
 *
 * World-space convention: a linear battlefield along the X axis, a fort at
 * each end — the green Shielded Fort at +X, the red Transparent Fort at -X
 * — with a live front line between them. `frontLine` (0..1, the live
 * shielded fraction) maps onto the line's X position: 0 pins it at the
 * transparent fort's doorstep (red controls the whole field), 1 pins it at
 * the shielded fort's doorstep (green controls the whole field).
 */

export const FIELD_HALF_WIDTH = 32;
export const FIELD_DEPTH = 30;
export const FORT_MARGIN = 5; // how far each fort sits back from its edge of the field
export const SHIELD_FORT_X = FIELD_HALF_WIDTH - FORT_MARGIN;
export const TRANSPARENT_FORT_X = -FIELD_HALF_WIDTH + FORT_MARGIN;
const LINE_MARGIN = 4; // closest the front line can approach either fort

export function frontLineToWorldX(frontLine: number): number {
  const f = clamp(frontLine, 0, 1);
  const lo = TRANSPARENT_FORT_X + LINE_MARGIN;
  const hi = SHIELD_FORT_X - LINE_MARGIN;
  return lo + f * (hi - lo);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/**
 * Army "strength" -> unit count. We don't literally render one zebra per
 * ZEC (that would be millions of instances); instead each side's absolute
 * ZEC amount is compressed with a square-root scale (so the visual delta
 * between 30% and 35% shielded is noticeable, but a supply outlier doesn't
 * blow up the scene) and clamped to a render-friendly range.
 */
export function zecToUnitCount(zec: number, opts: { min: number; max: number; refZec: number }): number {
  const { min, max, refZec } = opts;
  const ratio = Math.max(0, zec) / refZec;
  const scaled = Math.sqrt(ratio);
  return Math.round(clamp(min + scaled * (max - min), min, max));
}

/** Fog of war thins out over whichever side currently has the upper hand. */
export function shieldedFractionToFogOpacity(fraction: number): number {
  return clamp(1 - fraction * 1.1, 0.1, 1);
}

export function momentumToCameraDrift(momentum: number): number {
  return momentum * 0.6;
}

/** BattleEvent magnitude (0..1, log-scaled from the real transaction's ZEC size) -> courier/VFX/shake scale. */
export function magnitudeToEffectScale(magnitude: number): { particles: number; scale: number; shake: number } {
  const m = clamp(magnitude, 0, 1);
  return {
    particles: Math.round(16 + m * 130),
    scale: 0.55 + m * 2.4,
    shake: m * 0.4,
  };
}

/** Only genuinely large real transactions earn cannon fire + camera shake, so it stays a "big event" cue. */
export function isMajorEvent(magnitude: number): boolean {
  return magnitude > 0.45;
}

export const momentumLabels: Record<string, string> = {
  'privacy-surge': 'PRIVACY SURGE — mass shielding underway',
  'privacy-advancing': 'Privacy Advancing',
  stalemate: 'Stalemate on the front',
  'transparent-counter': 'Transparent Counter-Attack',
  'transparent-surge': 'TRANSPARENT BREAKTHROUGH — mass unshielding',
};
