/**
 * The single source of truth for ground elevation. The terrain mesh, every
 * soldier/tank, every tree/rock, and the fort pads all sample this same
 * function so nothing floats or sinks. Deterministic (no time, no random at
 * call time) so it's stable frame to frame and identical across sessions.
 *
 * Convention matches logic/mapping.ts: field spans X in
 * [-FIELD_HALF_WIDTH, +FIELD_HALF_WIDTH], depth is the Z axis. A shallow
 * river runs the length of the field (along Z) near the middle, gently
 * meandering; the two armies stage on either side of it.
 */

import { FIELD_HALF_WIDTH } from '../../logic/mapping';

export const RIVER_HALF_WIDTH = 2.4;
export const RIVER_DEPTH = 1.5;
export const RIVER_BANK = 0.9; // extra margin units/props keep clear of the water

function hash2(x: number, z: number): number {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

function valueNoise(x: number, z: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz);
  const b = hash2(ix + 1, iz);
  const c = hash2(ix, iz + 1);
  const d = hash2(ix + 1, iz + 1);
  return a * (1 - ux) * (1 - uz) + b * ux * (1 - uz) + c * (1 - ux) * uz + d * ux * uz;
}

/** X of the river's center at a given Z — a slow meander down the field. */
export function riverCenterX(z: number): number {
  return Math.sin(z * 0.07) * 3.2 + Math.cos(z * 0.021) * 1.6;
}

/** Signed-ish distance from the river center (0 = mid-channel). */
export function distanceToRiver(x: number, z: number): number {
  return Math.abs(x - riverCenterX(z));
}

export function isInRiver(x: number, z: number, margin = RIVER_BANK): boolean {
  return distanceToRiver(x, z) < RIVER_HALF_WIDTH + margin;
}

/** Ground elevation at a world (x, z). */
export function terrainHeight(x: number, z: number): number {
  let h = 0;
  // broad rolling hills
  h += Math.sin(x * 0.11 + 1.3) * Math.cos(z * 0.08) * 1.2;
  h += valueNoise(x * 0.05 + 10, z * 0.05 - 4) * 2.0 - 1.0;
  // finer undulation
  h += Math.sin(x * 0.29) * 0.35 + Math.cos(z * 0.24 + 2) * 0.35;
  h += valueNoise(x * 0.18, z * 0.18) * 0.6;

  // slight rise toward the two forts so they command the field
  const edge = Math.max(0, Math.abs(x) - FIELD_HALF_WIDTH * 0.55) / (FIELD_HALF_WIDTH * 0.45);
  h += edge * edge * 2.2;

  // carve the river channel
  const d = distanceToRiver(x, z);
  const channel = Math.exp(-(d * d) / (2 * RIVER_HALF_WIDTH * RIVER_HALF_WIDTH));
  h -= channel * RIVER_DEPTH;

  return h;
}

/** Water surface height (flat-ish, sits just below the channel lip). */
export function waterLevel(): number {
  return -RIVER_DEPTH * 0.55;
}

/**
 * If (x,z) is inside the river, return an x nudged out to the near bank;
 * otherwise return x unchanged. Used so staged units never stand in the water.
 */
export function pushOutOfRiver(x: number, z: number, margin = RIVER_BANK): number {
  const center = riverCenterX(z);
  const d = x - center;
  const clearance = RIVER_HALF_WIDTH + margin;
  if (Math.abs(d) >= clearance) return x;
  return center + (d >= 0 ? clearance : -clearance);
}
