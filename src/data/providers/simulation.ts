/**
 * Shielded/Transparent split dynamics engine — SIMULATED fallback layer.
 *
 * WHY THIS EXISTS
 * ----------------
 * The app's total-supply number (src/data/providers/coinMetrics.ts) is real,
 * live, on-chain data. But as of writing there is no free, browser-fetchable
 * (CORS-enabled, no-signup) API that publishes the live Sprout/Sapling/
 * Orchard value-pool breakdown at sub-daily resolution — the only sources for
 * that split are full-node RPCs (`z_gettotalbalance` / `getblockchain info`
 * .valuePools) or paid indexer products, neither of which can be called
 * directly from a static browser app. Rather than fabricate a fake "live" API
 * response, we're explicit about it: this engine drives the shielded % and
 * flow numbers with a bounded stochastic model, seeded from a documented,
 * publicly-reported ballpark (~30% of supply shielded, per Electric Coin Co /
 * ZecHub ecosystem reporting), and every value it produces is tagged
 * `status: 'simulated'` end to end so the UI can badge it honestly.
 *
 * If you have access to a real shielded-supply feed (e.g. you run your own
 * zcashd/zebrad + indexer), swap this module out: implement the same
 * `ShieldedDynamicsEngine` interface (tick/backfill/getFlowWindow) against
 * real values and nothing else in the app needs to change.
 *
 * THE MODEL
 * ---------
 * - `fraction` (0..1 shielded share) does a mean-reverting random walk
 *   around a slowly drifting `regimeTarget`, so it wanders realistically
 *   instead of trending to 0 or 1.
 * - Every tick has a small chance of an "event": a heavier-tailed jump in
 *   either direction, representing a large real-world shielding/unshielding
 *   transaction. These are what trigger battlefield cinematics.
 * - A rolling history buffer lets us compute genuine windowed deltas (1h/24h/
 *   7d) the same way we would from real data, and backfill() seeds 7 days of
 *   plausible history up front so the app feels alive on first load instead
 *   of needing a week to warm up.
 */

import type { BattleEvent, FlowWindow, MomentumState } from '../../types';

export interface DynamicsSnapshot {
  fraction: number; // 0..1 shielded share of supply
  pools: { sprout: number; sapling: number; orchard: number };
  momentum: number; // -1..1, smoothed recent rate of change
  momentumState: MomentumState;
}

interface HistoryPoint {
  t: number;
  fraction: number;
}

const MS_HOUR = 3_600_000;
const MS_DAY = 24 * MS_HOUR;
const BACKFILL_SPAN_MS = 7 * MS_DAY;
const BACKFILL_STEP_MS = MS_HOUR; // hourly resolution for history
const HISTORY_RETENTION_MS = 7 * MS_DAY + 2 * MS_HOUR;

const BASELINE_FRACTION = 0.3; // documented public ballpark, see header
const REGIME_DRIFT_PER_MS = 0.02 / MS_DAY; // regime target wanders slowly
const REVERSION_STRENGTH = 0.015; // pull of fraction toward regime target per tick
const NOISE_STD = 0.0016; // per-tick gaussian step std-dev
const EVENT_CHANCE_PER_TICK = 0.055;
const EVENT_MAGNITUDE_MIN = 0.006;
const EVENT_MAGNITUDE_MAX = 0.028;

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard-normal-ish sample via Box-Muller, driven by a supplied RNG. */
function gaussian(rng: () => number): number {
  const u1 = Math.max(rng(), 1e-9);
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `evt_${Date.now().toString(36)}_${idCounter}`;
}

export class ShieldedDynamicsEngine {
  private rng: () => number;
  private history: HistoryPoint[] = [];
  private regimeTarget = BASELINE_FRACTION;
  private events: BattleEvent[] = [];
  private momentumEma = 0;

  constructor(seed = Date.now()) {
    this.rng = mulberry32(seed);
  }

  /** Seed 7 days of plausible hourly history ending at `nowMs`, so the UI has flow context immediately. */
  backfill(nowMs: number, totalSupply: number) {
    const start = nowMs - BACKFILL_SPAN_MS;
    let fraction = BASELINE_FRACTION - 0.01 + this.rng() * 0.02;
    let target = fraction;
    const points: HistoryPoint[] = [];
    for (let t = start; t <= nowMs; t += BACKFILL_STEP_MS) {
      target += (this.rng() - 0.5) * REGIME_DRIFT_PER_MS * BACKFILL_STEP_MS * 6;
      target = clamp(target, 0.18, 0.55);
      fraction += (target - fraction) * REVERSION_STRENGTH + gaussian(this.rng) * NOISE_STD * 2.2;
      if (this.rng() < EVENT_CHANCE_PER_TICK * 1.4) {
        const sign = this.rng() > 0.46 ? 1 : -1;
        fraction += sign * (EVENT_MAGNITUDE_MIN + this.rng() * (EVENT_MAGNITUDE_MAX - EVENT_MAGNITUDE_MIN));
      }
      fraction = clamp(fraction, 0.12, 0.62);
      points.push({ t, fraction });
    }
    this.history = points;
    this.regimeTarget = target;
    void totalSupply; // reserved: history stores fraction only, ZEC amounts derived at read-time
  }

  /** Advance the simulation by one poll tick at real time `nowMs`. Returns any new battle events. */
  tick(nowMs: number, totalSupply: number): BattleEvent[] {
    const last = this.history[this.history.length - 1];
    const prevFraction = last ? last.fraction : BASELINE_FRACTION;

    this.regimeTarget += (this.rng() - 0.5) * REGIME_DRIFT_PER_MS * (nowMs - (last?.t ?? nowMs) || MS_HOUR);
    this.regimeTarget = clamp(this.regimeTarget, 0.18, 0.55);

    let fraction = prevFraction + (this.regimeTarget - prevFraction) * REVERSION_STRENGTH + gaussian(this.rng) * NOISE_STD;

    const newEvents: BattleEvent[] = [];
    if (this.rng() < EVENT_CHANCE_PER_TICK) {
      const isShield = this.rng() > 0.47; // slight bias toward shielding, matching long-run adoption trend
      const magnitude = EVENT_MAGNITUDE_MIN + this.rng() * (EVENT_MAGNITUDE_MAX - EVENT_MAGNITUDE_MIN);
      fraction += isShield ? magnitude : -magnitude;
      const netZec = magnitude * totalSupply * (isShield ? 1 : -1);
      const severity = clamp(magnitude / EVENT_MAGNITUDE_MAX, 0, 1);
      newEvents.push({
        id: nextId(),
        kind: isShield ? 'shield-surge' : 'unshield-attack',
        side: isShield ? 'shield' : 'transparent',
        magnitude: severity,
        netZec,
        message: isShield
          ? `Large shielding operation: ~${Math.round(Math.abs(netZec)).toLocaleString()} ZEC moved into cover`
          : `Unshielding counter-attack: ~${Math.round(Math.abs(netZec)).toLocaleString()} ZEC exposed`,
        timestamp: nowMs,
      });
    }

    fraction = clamp(fraction, 0.12, 0.62);
    this.history.push({ t: nowMs, fraction });
    this.history = this.history.filter((p) => nowMs - p.t <= HISTORY_RETENTION_MS);

    if (newEvents.length) {
      this.events = [...newEvents, ...this.events].slice(0, 40);
    }

    // Smooth momentum: rate of change over the last ~15 min of sim history, EMA-damped for camera/army stability.
    const shortWindow = this.lookback(nowMs, 15 * 60_000);
    const instantMomentum = shortWindow != null ? clamp((fraction - shortWindow) * 40, -1, 1) : 0;
    this.momentumEma = this.momentumEma * 0.85 + instantMomentum * 0.15;

    return newEvents;
  }

  private lookback(nowMs: number, spanMs: number): number | null {
    if (this.history.length === 0) return null;
    const targetT = nowMs - spanMs;
    let best = this.history[0];
    for (const p of this.history) {
      if (p.t <= targetT) best = p;
      else break;
    }
    return best.fraction;
  }

  getFraction(): number {
    const last = this.history[this.history.length - 1];
    return last ? last.fraction : BASELINE_FRACTION;
  }

  getMomentum(): number {
    return this.momentumEma;
  }

  getMomentumState(): MomentumState {
    const m = this.momentumEma;
    if (m > 0.55) return 'privacy-surge';
    if (m > 0.12) return 'privacy-advancing';
    if (m < -0.55) return 'transparent-surge';
    if (m < -0.12) return 'transparent-counter';
    return 'stalemate';
  }

  /** Fractions of the shielded pool by protocol generation — decorative, slowly drifting toward Orchard dominance. */
  getPools(): { sprout: number; sapling: number; orchard: number } {
    const t = (this.history[this.history.length - 1]?.t ?? Date.now()) - (this.history[0]?.t ?? Date.now());
    const orchardShare = clamp(0.55 + (t / BACKFILL_SPAN_MS) * 0.25, 0.55, 0.85);
    const sproutShare = 0.01;
    const saplingShare = 1 - orchardShare - sproutShare;
    return { sprout: sproutShare, sapling: saplingShare, orchard: orchardShare };
  }

  getFlowWindow(nowMs: number, totalSupply: number, hours: number): FlowWindow {
    const past = this.lookback(nowMs, hours * MS_HOUR);
    const current = this.getFraction();
    if (past == null) return { hours, netZec: 0, estimated: true };
    const netZec = (current - past) * totalSupply;
    return { hours, netZec, estimated: true };
  }

  getRecentEvents(sinceMs?: number): BattleEvent[] {
    if (sinceMs == null) return this.events;
    return this.events.filter((e) => e.timestamp >= sinceMs);
  }

  getHistorySeries(): HistoryPoint[] {
    return this.history;
  }
}
