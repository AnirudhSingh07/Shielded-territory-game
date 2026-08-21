/**
 * Orchestrates the live feed: real total supply + real market stats + a real
 * transaction-by-transaction shielding/unshielding stream (confirmed) + a
 * faster real mempool stream (pending scouts), reduced into one `WarState`.
 * This is the single place that knows about every data source.
 *
 * Two independent loops:
 *   - Confirmed loop (20s): total supply, market stats, newest confirmed
 *     shielded transactions. Drives couriers, flows, momentum, the monument.
 *   - Mempool loop (6s): pending shielded transactions. Drives the ghostly
 *     scouts so the field stays busy between confirmations. Still real data,
 *     explicitly flagged pending.
 */

import { useEffect, useState } from 'react';
import { fetchLatestZecSupply } from './providers/coinMetrics';
import { fetchBlockchairStats } from './providers/blockchair';
import { backfillShieldedFlows, fetchLatestShieldedFlows } from './providers/zcashTransactions';
import { fetchPendingShieldedFlows } from './providers/zcashMempool';
import { RealFlowEngine } from './providers/realFlowEngine';
import type { MarketSnapshot, SourceStatus, WarState } from '../types';

const POLL_MS = 20_000; // confirmed loop base
const POLL_MAX_MS = 120_000; // confirmed loop cap under backoff
const MEMPOOL_POLL_MS = 8_000; // pending/scout loop base — toward the slow end to respect Blockchair rate limits
const MEMPOOL_MAX_MS = 90_000; // mempool loop cap under backoff
const SUPPLY_REFRESH_EVERY_N_POLLS = 12; // ~4 minutes; CoinMetrics is daily-resolution anyway
const MARKET_REFRESH_EVERY_N_POLLS = 3; // market stats are decorative — fetch them less to spare the shared provider
const BACKFILL_TARGET_MS = 90 * 60_000;
const FALLBACK_TOTAL_SUPPLY = 16_830_000; // documented ballpark, used only if CoinMetrics is unreachable

/** Exponential backoff so a rate-limited (HTTP 430) provider isn't hammered and can recover. */
function backoff(base: number, fails: number, cap: number): number {
  return Math.min(cap, Math.round(base * Math.pow(1.8, Math.min(fails, 6))));
}

const EMPTY_MARKET: MarketSnapshot = { priceUsd: null, marketCapUsd: null, change24hPct: null, blockHeight: null, hashRate: null };

export interface ZecFeed {
  state: WarState | null;
  ready: boolean;
}

export function useZecFeed(): ZecFeed {
  const [state, setState] = useState<WarState | null>(null);

  useEffect(() => {
    let cancelled = false;
    let confirmedTimer: ReturnType<typeof setTimeout>;
    let mempoolTimer: ReturnType<typeof setTimeout>;
    const engine = new RealFlowEngine();

    // last-good snapshots shared by both loops
    let totalSupply = FALLBACK_TOTAL_SUPPLY;
    let supplyStatus: SourceStatus = 'loading';
    let market: MarketSnapshot = EMPTY_MARKET;
    let marketStatus: SourceStatus = 'loading';
    let mempoolStatus: SourceStatus = 'loading';
    let pollCount = 0;
    let confirmedFails = 0;
    let mempoolFails = 0;

    function rebuild() {
      if (cancelled) return;
      const nowMs = Date.now();
      const fraction = engine.getFraction(nowMs, totalSupply);
      const shieldedZec = fraction * totalSupply;
      setState({
        supply: { totalSupply, shieldedFraction: fraction, shieldedZec, transparentZec: totalSupply - shieldedZec, timestamp: nowMs },
        market,
        flows: { h1: engine.getFlowWindow(nowMs, 1), h24: engine.getFlowWindow(nowMs, 24), d7: engine.getFlowWindow(nowMs, 24 * 7) },
        frontLine: fraction,
        momentum: engine.getMomentum(nowMs),
        momentumState: engine.getMomentumState(nowMs),
        events: engine.getRecentEvents(),
        scouts: engine.getScouts(),
        sessionNetShieldedZec: engine.getSessionNetShieldedZec(),
        sources: {
          supply: supplyStatus,
          market: marketStatus,
          flows: engine.hasAnchor() ? 'anchored' : 'loading',
          mempool: mempoolStatus,
        },
      });
    }

    async function fetchSupply() {
      try {
        totalSupply = (await fetchLatestZecSupply()).totalSupply;
        supplyStatus = 'live';
      } catch {
        supplyStatus = totalSupply === FALLBACK_TOTAL_SUPPLY ? 'error' : 'stale';
      }
    }
    async function fetchMarket() {
      try {
        market = await fetchBlockchairStats();
        marketStatus = 'live';
      } catch {
        marketStatus = 'error';
      }
    }

    async function bootstrap() {
      await Promise.all([
        fetchSupply(),
        fetchMarket(),
        backfillShieldedFlows(BACKFILL_TARGET_MS).then(({ events }) => engine.ingest(events)),
      ]);
      engine.finalizeAnchor();
      if (cancelled) return;
      rebuild();
      confirmedTimer = setTimeout(() => void confirmedPoll(), POLL_MS);
      void mempoolPoll(); // start the fast loop immediately
    }

    async function confirmedPoll() {
      pollCount += 1;
      let txOk = true;
      const jobs: Promise<unknown>[] = [fetchLatestShieldedFlows().then((txs) => engine.ingest(txs)).catch(() => { txOk = false; })];
      if (pollCount % MARKET_REFRESH_EVERY_N_POLLS === 0) jobs.push(fetchMarket());
      if (pollCount % SUPPLY_REFRESH_EVERY_N_POLLS === 0) jobs.push(fetchSupply());
      await Promise.all(jobs);
      if (cancelled) return;
      confirmedFails = txOk ? 0 : confirmedFails + 1;
      rebuild();
      confirmedTimer = setTimeout(() => void confirmedPoll(), backoff(POLL_MS, confirmedFails, POLL_MAX_MS));
    }

    async function mempoolPoll() {
      try {
        const pending = await fetchPendingShieldedFlows();
        engine.updateScouts(pending, Date.now());
        mempoolStatus = 'live';
        mempoolFails = 0;
      } catch {
        mempoolStatus = 'error';
        mempoolFails += 1;
      }
      if (cancelled) return;
      rebuild();
      mempoolTimer = setTimeout(() => void mempoolPoll(), backoff(MEMPOOL_POLL_MS, mempoolFails, MEMPOOL_MAX_MS));
    }

    void bootstrap();
    return () => {
      cancelled = true;
      clearTimeout(confirmedTimer);
      clearTimeout(mempoolTimer);
    };
  }, []);

  return { state, ready: state != null };
}
