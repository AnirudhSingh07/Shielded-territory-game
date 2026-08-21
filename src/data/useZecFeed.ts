/**
 * Orchestrates the live feed: real total supply + real market stats + a real
 * transaction-by-transaction shielding/unshielding stream, reduced into one
 * `WarState`. This is the single place that knows about every data source —
 * see the individual provider files for exactly what's live vs. anchored.
 *
 * Startup sequence:
 *   1. Kick off total-supply + market fetches AND a bounded real-transaction
 *      backfill (up to ~90 real minutes of on-chain history) in parallel.
 *   2. Once the backfill settles, fix the accounting anchor
 *      (RealFlowEngine#finalizeAnchor) and start rendering.
 *   3. Every 20s afterward, pull the newest transactions, ingest any not
 *      already seen (dedup by hash), and refresh market stats. Total supply
 *      (daily-resolution upstream) is only re-polled every few minutes.
 */

import { useEffect, useRef, useState } from 'react';
import { fetchLatestZecSupply } from './providers/coinMetrics';
import { fetchBlockchairStats } from './providers/blockchair';
import { backfillShieldedFlows, fetchLatestShieldedFlows } from './providers/zcashTransactions';
import { RealFlowEngine } from './providers/realFlowEngine';
import type { MarketSnapshot, SourceStatus, WarState } from '../types';

const POLL_MS = 20_000; // within the requested 15-60s cadence
const SUPPLY_REFRESH_EVERY_N_POLLS = 12; // ~4 minutes; CoinMetrics is daily-resolution anyway
const BACKFILL_TARGET_MS = 90 * 60_000;
const FALLBACK_TOTAL_SUPPLY = 16_830_000; // documented ballpark, used only if CoinMetrics is unreachable

function buildState(
  totalSupply: number,
  supplyStatus: SourceStatus,
  market: MarketSnapshot,
  marketStatus: SourceStatus,
  engine: RealFlowEngine,
  nowMs: number,
): WarState {
  const fraction = engine.getFraction(nowMs, totalSupply);
  const shieldedZec = fraction * totalSupply;
  const transparentZec = totalSupply - shieldedZec;

  return {
    supply: { totalSupply, shieldedFraction: fraction, shieldedZec, transparentZec, timestamp: nowMs },
    market,
    flows: {
      h1: engine.getFlowWindow(nowMs, 1),
      h24: engine.getFlowWindow(nowMs, 24),
      d7: engine.getFlowWindow(nowMs, 24 * 7),
    },
    frontLine: fraction,
    momentum: engine.getMomentum(nowMs),
    momentumState: engine.getMomentumState(nowMs),
    events: engine.getRecentEvents(),
    sources: {
      supply: supplyStatus,
      market: marketStatus,
      flows: engine.hasAnchor() ? 'anchored' : 'loading',
    },
  };
}

export interface ZecFeed {
  state: WarState | null;
  ready: boolean;
}

export function useZecFeed(): ZecFeed {
  const [state, setState] = useState<WarState | null>(null);
  const engineRef = useRef<RealFlowEngine | null>(null);
  const lastGoodSupplyRef = useRef<number>(FALLBACK_TOTAL_SUPPLY);
  const pollCountRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const engine = new RealFlowEngine();
    engineRef.current = engine;

    async function fetchSupply(): Promise<SourceStatus> {
      try {
        const point = await fetchLatestZecSupply();
        lastGoodSupplyRef.current = point.totalSupply;
        return 'live';
      } catch {
        return lastGoodSupplyRef.current === FALLBACK_TOTAL_SUPPLY ? 'error' : 'stale';
      }
    }

    async function fetchMarket(): Promise<{ market: MarketSnapshot; status: SourceStatus }> {
      try {
        return { market: await fetchBlockchairStats(), status: 'live' };
      } catch {
        return { market: { priceUsd: null, marketCapUsd: null, change24hPct: null, blockHeight: null, hashRate: null }, status: 'error' };
      }
    }

    async function bootstrap() {
      const [supplyStatus, marketResult] = await Promise.all([
        fetchSupply(),
        fetchMarket(),
        backfillShieldedFlows(BACKFILL_TARGET_MS).then(({ events }) => {
          engine.ingest(events);
        }),
      ]);
      engine.finalizeAnchor();
      if (cancelled) return;
      setState(buildState(lastGoodSupplyRef.current, supplyStatus, marketResult.market, marketResult.status, engine, Date.now()));
      scheduleNext();
    }

    function scheduleNext() {
      timer = setTimeout(() => void pollOnce(), POLL_MS);
    }

    async function pollOnce() {
      pollCountRef.current += 1;
      const shouldRefreshSupply = pollCountRef.current % SUPPLY_REFRESH_EVERY_N_POLLS === 0;

      const [supplyStatus, marketResult, freshTxs] = await Promise.all([
        shouldRefreshSupply ? fetchSupply() : Promise.resolve<SourceStatus>('live'),
        fetchMarket(),
        fetchLatestShieldedFlows().catch(() => []),
      ]);
      if (cancelled) return;

      engine.ingest(freshTxs);
      setState((prev) =>
        buildState(lastGoodSupplyRef.current, shouldRefreshSupply ? supplyStatus : (prev?.sources.supply ?? 'live'), marketResult.market, marketResult.status, engine, Date.now()),
      );
      scheduleNext();
    }

    void bootstrap();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  return { state, ready: state != null };
}
