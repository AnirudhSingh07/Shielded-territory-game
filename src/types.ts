/**
 * Shared domain types for the Shielded Territory War visualization.
 *
 * Naming mirrors the real-world concept it represents (on-chain Zcash
 * supply/flow data) even where the concrete number is produced by the
 * simulation fallback — see src/data/README.md for the full provenance
 * breakdown of every field.
 */

/** Where a piece of data actually came from, surfaced in the UI as a badge. */
export type SourceStatus = 'live' | 'stale' | 'simulated' | 'loading' | 'error';

export interface SourcedValue<T> {
  value: T;
  status: SourceStatus;
  /** Human-readable origin, e.g. "CoinMetrics Community API" */
  source: string;
  /** ms epoch of when this value was last refreshed */
  updatedAt: number;
}

/** Net ZEC flow into (+) or out of (-) shielded pools over a window. */
export interface FlowWindow {
  hours: number;
  netZec: number;
  /** 0..1 confidence / provenance weight, used to soften simulated noise in the UI */
  estimated: boolean;
}

export interface SupplySnapshot {
  /** Total circulating ZEC supply (live, from CoinMetrics). */
  totalSupply: number;
  /** Fraction of totalSupply currently shielded, 0..1. */
  shieldedFraction: number;
  shieldedZec: number;
  transparentZec: number;
  /** Optional pool breakdown, fractions of shieldedZec that sum to ~1. */
  pools: {
    sprout: number;
    sapling: number;
    orchard: number;
  };
  timestamp: number;
}

export interface MarketSnapshot {
  priceUsd: number | null;
  marketCapUsd: number | null;
  change24hPct: number | null;
  blockHeight: number | null;
  hashRate: number | null;
}

export type MomentumState = 'privacy-surge' | 'privacy-advancing' | 'stalemate' | 'transparent-counter' | 'transparent-surge';

export interface BattleEvent {
  id: string;
  kind: 'shield-surge' | 'unshield-attack' | 'skirmish' | 'milestone';
  side: 'shield' | 'transparent' | 'neutral';
  magnitude: number; // normalized 0..1 severity, drives VFX scale
  netZec: number;
  message: string;
  timestamp: number;
}

/** The full derived war state consumed by the scene + HUD. */
export interface WarState {
  supply: SupplySnapshot;
  market: MarketSnapshot;
  flows: {
    h1: FlowWindow;
    h24: FlowWindow;
    d7: FlowWindow;
  };
  /** -1 (fully transparent) .. +1 (fully shielded) front line position. */
  frontLine: number;
  /** Smoothed momentum used for camera/army animation, -1..1 */
  momentum: number;
  momentumState: MomentumState;
  events: BattleEvent[];
  sources: {
    supply: SourceStatus;
    market: SourceStatus;
    flows: SourceStatus;
  };
}
