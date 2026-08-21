/**
 * Turns the real transaction stream (zcashTransactions.ts) into the war
 * state: running shielded fraction, windowed net flows, momentum, and the
 * BattleEvent feed. Every number here is a direct sum/derivation over real,
 * individually-observed on-chain transactions — there is no random-walk or
 * synthetic generator anywhere in this file.
 *
 * THE ONE ANCHOR CONSTANT
 * ------------------------
 * There is no free, CORS-enabled API that publishes the live *absolute*
 * total shielded ZEC supply (only individual transaction deltas, which we
 * do have). So the running shielded fraction is computed as:
 *
 *   fraction(now) = ANCHOR_FRACTION + Σ(real deltas from anchor time to now) / totalSupply
 *
 * `ANCHOR_FRACTION` is a one-time documented public estimate
 * (~30% of supply shielded, consistent with Electric Coin Co. / ZecHub
 * ecosystem reporting), and the anchor time is fixed to the oldest moment
 * our real transaction backfill actually reached — every unit of movement
 * away from that single starting constant is 100% real, observed, on-chain
 * activity. This is fundamentally different from the old simulation: given
 * the same anchor and the same transactions, two sessions converge on the
 * same trajectory, because it's arithmetic over real data, not randomness.
 */

import type { BattleEvent, FlowWindow, MomentumState } from '../../types';
import type { RealFlowTx } from './zcashTransactions';

const ZATOSHI_PER_ZEC = 1e8;
const ANCHOR_FRACTION = 0.3;
const MOMENTUM_WINDOW_MS = 30 * 60_000; // recent half-hour, real net flow
const MOMENTUM_SCALE_ZEC = 25; // "a meaningful 30-minute swing", tunable
const EVENT_LARGE_REF_ZEC = 50; // log-scale reference for "this feels big" VFX sizing

let idCounter = 0;
function eventId(hash: string): string {
  idCounter += 1;
  return `${hash.slice(0, 10)}_${idCounter}`;
}

function shortHash(hash: string): string {
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`;
}

export class RealFlowEngine {
  private history: RealFlowTx[] = []; // ascending by timeMs, deduped by hash
  private seenHashes = new Set<string>();
  private anchorTimeMs: number | null = null;
  private events: BattleEvent[] = [];

  /** Merge in newly observed real transactions (from backfill or a live poll). Returns the genuinely-new ones. */
  ingest(txs: RealFlowTx[]): RealFlowTx[] {
    const fresh: RealFlowTx[] = [];
    for (const tx of txs) {
      if (this.seenHashes.has(tx.hash)) continue;
      this.seenHashes.add(tx.hash);
      this.history.push(tx);
      fresh.push(tx);
    }
    if (fresh.length) this.history.sort((a, b) => a.timeMs - b.timeMs);

    // Trim anything older than 8 days — we never need more than a 7d window.
    const cutoff = Date.now() - 8 * 24 * 3_600_000;
    while (this.history.length && this.history[0].timeMs < cutoff) this.history.shift();

    for (const tx of fresh) {
      const zec = tx.deltaZatoshi / ZATOSHI_PER_ZEC;
      const isShield = zec > 0;
      const absZec = Math.abs(zec);
      const magnitude = clamp(Math.log10(1 + absZec) / Math.log10(1 + EVENT_LARGE_REF_ZEC), 0.04, 1);
      this.events.unshift({
        id: eventId(tx.hash),
        kind: isShield ? 'shield-surge' : 'unshield-attack',
        side: isShield ? 'shield' : 'transparent',
        magnitude,
        netZec: zec,
        message: isShield
          ? `Shielded ${absZec.toFixed(absZec < 1 ? 4 : 2)} ZEC — tx ${shortHash(tx.hash)}`
          : `Unshielded ${absZec.toFixed(absZec < 1 ? 4 : 2)} ZEC — tx ${shortHash(tx.hash)}`,
        timestamp: tx.timeMs,
        txHash: tx.hash,
        blockId: tx.blockId,
      });
    }
    if (fresh.length) this.events = this.events.slice(0, 60);

    return fresh;
  }

  /** Fixes the accounting anchor to the oldest point real history has reached. Call once after the initial backfill. */
  finalizeAnchor() {
    if (this.anchorTimeMs != null) return;
    this.anchorTimeMs = this.history.length ? this.history[0].timeMs : Date.now();
  }

  hasAnchor(): boolean {
    return this.anchorTimeMs != null;
  }

  private sumWindow(nowMs: number, fromMs: number): { netZatoshi: number; txCount: number } {
    let netZatoshi = 0;
    let txCount = 0;
    for (let i = this.history.length - 1; i >= 0; i--) {
      const tx = this.history[i];
      if (tx.timeMs < fromMs) break;
      if (tx.timeMs > nowMs) continue;
      netZatoshi += tx.deltaZatoshi;
      txCount++;
    }
    return { netZatoshi, txCount };
  }

  getFraction(nowMs: number, totalSupplyZec: number): number {
    if (this.anchorTimeMs == null) return ANCHOR_FRACTION;
    const { netZatoshi } = this.sumWindow(nowMs, this.anchorTimeMs);
    return clamp(ANCHOR_FRACTION + netZatoshi / ZATOSHI_PER_ZEC / totalSupplyZec, 0.02, 0.98);
  }

  getMomentum(nowMs: number): number {
    const { netZatoshi } = this.sumWindow(nowMs, nowMs - MOMENTUM_WINDOW_MS);
    const netZec = netZatoshi / ZATOSHI_PER_ZEC;
    return clamp(netZec / MOMENTUM_SCALE_ZEC, -1, 1);
  }

  getMomentumState(nowMs: number): MomentumState {
    const m = this.getMomentum(nowMs);
    if (m > 0.55) return 'privacy-surge';
    if (m > 0.12) return 'privacy-advancing';
    if (m < -0.55) return 'transparent-surge';
    if (m < -0.12) return 'transparent-counter';
    return 'stalemate';
  }

  getFlowWindow(nowMs: number, hours: number): FlowWindow {
    const requestedMs = hours * 3_600_000;
    const fromMs = nowMs - requestedMs;
    const { netZatoshi, txCount } = this.sumWindow(nowMs, fromMs);
    const oldestRealMs = this.history.length ? this.history[0].timeMs : nowMs;
    const coverageMs = clamp(nowMs - Math.max(oldestRealMs, fromMs), 0, requestedMs);
    return {
      hours,
      netZec: netZatoshi / ZATOSHI_PER_ZEC,
      txCount,
      coverageMs,
      partial: coverageMs < requestedMs - 1000,
    };
  }

  getRecentEvents(): BattleEvent[] {
    return this.events;
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
