/**
 * Orchestrates the live feed: polls real providers, drives the shielded-
 * dynamics simulation, and reduces everything into a single WarState that
 * the scene and HUD consume. This is the one place that knows about every
 * data source and how they combine — see individual provider files for the
 * provenance of each number.
 *
 * Fallback chain per requirement ("fall back gracefully if one source fails"):
 *   totalSupply:  CoinMetrics (live) -> last known good value -> hardcoded
 *                 documented baseline (~16.8M ZEC, mid-2026 ballpark)
 *   market stats: Blockchair (live) -> omitted from the HUD (non-critical)
 *   shielded %:   always the simulation engine (see providers/simulation.ts
 *                 for why), applied on top of whichever totalSupply above)
 */

import { useEffect, useRef, useState } from 'react';
import { fetchLatestZecSupply } from './providers/coinMetrics';
import { fetchBlockchairStats } from './providers/blockchair';
import { ShieldedDynamicsEngine } from './providers/simulation';
import type { MarketSnapshot, SourceStatus, WarState } from '../types';

const POLL_MS = 30_000; // within the requested 15-60s cadence
const FALLBACK_TOTAL_SUPPLY = 16_830_000; // documented ballpark, used only if CoinMetrics is unreachable

function classifyMomentum(m: number) {
  if (m > 0.55) return 'privacy-surge' as const;
  if (m > 0.12) return 'privacy-advancing' as const;
  if (m < -0.55) return 'transparent-surge' as const;
  if (m < -0.12) return 'transparent-counter' as const;
  return 'stalemate' as const;
}

function buildState(
  totalSupply: number,
  supplyStatus: SourceStatus,
  market: MarketSnapshot,
  marketStatus: SourceStatus,
  engine: ShieldedDynamicsEngine,
  nowMs: number,
): WarState {
  const fraction = engine.getFraction();
  const shieldedZec = fraction * totalSupply;
  const transparentZec = totalSupply - shieldedZec;
  const momentum = engine.getMomentum();

  return {
    supply: {
      totalSupply,
      shieldedFraction: fraction,
      shieldedZec,
      transparentZec,
      pools: engine.getPools(),
      timestamp: nowMs,
    },
    market,
    flows: {
      h1: engine.getFlowWindow(nowMs, totalSupply, 1),
      h24: engine.getFlowWindow(nowMs, totalSupply, 24),
      d7: engine.getFlowWindow(nowMs, totalSupply, 24 * 7),
    },
    frontLine: fraction * 2 - 1,
    momentum,
    momentumState: classifyMomentum(momentum),
    events: engine.getRecentEvents(),
    sources: {
      supply: supplyStatus,
      market: marketStatus,
      flows: 'simulated',
    },
  };
}

export interface ZecFeed {
  state: WarState | null;
  ready: boolean;
  newEvents: WarState['events'];
}

export function useZecFeed(): ZecFeed {
  const [state, setState] = useState<WarState | null>(null);
  const engineRef = useRef<ShieldedDynamicsEngine | null>(null);
  const lastGoodSupplyRef = useRef<number>(FALLBACK_TOTAL_SUPPLY);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function pollOnce(isFirst: boolean) {
      const nowMs = Date.now();
      let totalSupply = lastGoodSupplyRef.current;
      let supplyStatus: SourceStatus = 'stale';
      try {
        const point = await fetchLatestZecSupply();
        totalSupply = point.totalSupply;
        lastGoodSupplyRef.current = totalSupply;
        supplyStatus = 'live';
      } catch {
        supplyStatus = lastGoodSupplyRef.current === FALLBACK_TOTAL_SUPPLY ? 'simulated' : 'stale';
      }

      let market: MarketSnapshot = {
        priceUsd: null,
        marketCapUsd: null,
        change24hPct: null,
        blockHeight: null,
        hashRate: null,
      };
      let marketStatus: SourceStatus = 'error';
      try {
        market = await fetchBlockchairStats();
        marketStatus = 'live';
      } catch {
        marketStatus = 'error';
      }

      if (cancelled) return;

      if (!engineRef.current) {
        engineRef.current = new ShieldedDynamicsEngine(nowMs);
        engineRef.current.backfill(nowMs, totalSupply);
      }
      const engine = engineRef.current;
      if (!isFirst) engine.tick(nowMs, totalSupply);

      setState(buildState(totalSupply, supplyStatus, market, marketStatus, engine, nowMs));

      timer = setTimeout(() => void pollOnce(false), POLL_MS);
    }

    void pollOnce(true);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  return { state, ready: state != null, newEvents: state?.events ?? [] };
}
