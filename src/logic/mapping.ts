/**
 * Pure functions mapping WarState numbers onto visual/scene parameters.
 * Kept separate from data-fetching and from React/Three so the "what does a
 * shielded % actually look like" logic is easy to read, test, and tune in
 * one place.
 *
 * World-space convention: a circular siege map centered on the origin.
 * The Shielded Fort sits at the center; shielded (green) territory is the
 * disc around it, transparent (red) territory is the ring beyond the front
 * line. `frontLine` (0..1, the live shielded fraction) maps onto the radius
 * of that boundary — the more of the supply that's shielded, the further
 * out the green territory (and the red army) gets pushed.
 */

export const FORT_RADIUS = 4.5;
export const FIELD_MIN_RADIUS = FORT_RADIUS + 3; // closest the front line can approach the fort
export const FIELD_MAX_RADIUS = 34; // outer edge of the playable field / fully-transparent extreme
export const FIELD_OUTER_MARGIN = 42; // ground plane extends a bit past the field for a horizon

export function frontLineToRadius(frontLine: number): number {
  const f = clamp(frontLine, 0, 1);
  return FIELD_MIN_RADIUS + f * (FIELD_MAX_RADIUS - FIELD_MIN_RADIUS);
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

/** Fog of war recedes outward from the fort as the shielded fraction grows — it's unmapped/unshielded territory, not literal visibility. */
export function shieldedFractionToFogOpacity(fraction: number): number {
  return clamp(1 - fraction * 1.1, 0.1, 1);
}

export function momentumToCameraDrift(momentum: number): number {
  return momentum * 0.6;
}

/** BattleEvent magnitude (0..1, log-scaled from the real transaction's ZEC size) -> courier/VFX scale. */
export function magnitudeToEffectScale(magnitude: number): { particles: number; scale: number; shake: number } {
  const m = clamp(magnitude, 0, 1);
  return {
    particles: Math.round(16 + m * 110),
    scale: 0.55 + m * 2.2,
    shake: m * 0.3,
  };
}

export const momentumLabels: Record<string, string> = {
  'privacy-surge': 'PRIVACY SURGE — mass shielding underway',
  'privacy-advancing': 'Privacy Advancing',
  stalemate: 'Stalemate at the walls',
  'transparent-counter': 'Transparent Counter-Attack',
  'transparent-surge': 'TRANSPARENT BREAKTHROUGH — mass unshielding',
};
