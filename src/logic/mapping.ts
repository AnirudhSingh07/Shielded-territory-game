/**
 * Pure functions mapping WarState numbers onto visual/scene parameters.
 * Kept separate from data-fetching and from React/Three so the "what does a
 * shielded % actually look like" logic is easy to read, test, and tune in
 * one place.
 *
 * World-space convention: the battlefield spans X in [-FIELD_HALF_WIDTH, +FIELD_HALF_WIDTH].
 * Negative X = transparent (red) territory, positive X = shielded (green) territory.
 * frontLine (-1..1) maps linearly onto that range.
 */

export const FIELD_HALF_WIDTH = 30;
export const FIELD_DEPTH = 36;

export function frontLineToWorldX(frontLine: number): number {
  return clamp(frontLine, -1, 1) * FIELD_HALF_WIDTH;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/**
 * Army "strength" -> unit count. We don't literally render one soldier per
 * ZEC (that would be millions of instances); instead each side's absolute
 * ZEC amount is compressed with a square-root scale (so the visual delta
 * between 30% and 35% shielded is noticeable, but a 10x supply outlier
 * wouldn't render 10x the geometry) and clamped to a render-friendly range.
 */
export function zecToUnitCount(zec: number, opts: { min: number; max: number; refZec: number }): number {
  const { min, max, refZec } = opts;
  const ratio = Math.max(0, zec) / refZec;
  const scaled = Math.sqrt(ratio);
  return Math.round(clamp(min + scaled * (max - min), min, max));
}

/** Fog of war recedes as shielded fraction grows — it's the "unmapped" territory not yet under privacy control. */
export function shieldedFractionToFogOpacity(fraction: number): number {
  // Fog is thickest on the transparent side; near-zero deep in shielded territory.
  return clamp(1 - fraction * 1.15, 0.08, 1);
}

export function momentumToCameraDrift(momentum: number): number {
  return momentum * 0.6; // subtle auto-pan toward the advancing side
}

/** BattleEvent magnitude (0..1) -> particle count / explosion scale for effects. */
export function magnitudeToEffectScale(magnitude: number): { particles: number; scale: number; shake: number } {
  const m = clamp(magnitude, 0, 1);
  return {
    particles: Math.round(24 + m * 120),
    scale: 0.8 + m * 2.6,
    shake: m * 0.35,
  };
}

export const momentumLabels: Record<string, string> = {
  'privacy-surge': 'PRIVACY SURGE — mass shielding underway',
  'privacy-advancing': 'Privacy Advancing',
  stalemate: 'Stalemate on the front',
  'transparent-counter': 'Transparent Counter-Attack',
  'transparent-surge': 'TRANSPARENT BREAKTHROUGH — mass unshielding',
};
