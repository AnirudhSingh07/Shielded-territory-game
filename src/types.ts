/**
 * Shared domain types for the Shielded Territory War visualization.
 *
 * See src/data/providers/README.md (and the header comments in each
 * provider file) for exactly where every field comes from. Short version:
 * total supply, market stats, AND every shielding/unshielding transaction
 * are real on-chain data pulled live from public block-explorer APIs. The
 * one non-live number is the *starting* absolute shielded-supply anchor
 * (`anchored` status) — there is no free API for the live absolute total,
 * so it's seeded once from a documented public estimate and, from that
 * instant on, moved only by real observed transaction deltas.
 */

/** Where a piece of data actually came from, surfaced in the UI as a badge. */
export type SourceStatus = 'live' | 'anchored' | 'stale' | 'loading' | 'error';

/**
 * A REAL pending (unconfirmed) shielding/unshielding transaction currently
 * sitting in the mempool. Same provenance rules as confirmed transactions —
 * this is real on-chain data — but it is explicitly *not yet final*, so it's
 * rendered as a ghostly "scout" that only becomes a full confirmed courier
 * once it actually confirms.
 */
export interface MempoolScout {
  txHash: string;
  side: 'shield' | 'transparent';
  netZec: number;
  /** 0..1 size weight, log-scaled like confirmed events. */
  magnitude: number;
  /** ms epoch we first observed this pending tx (drives how far it has advanced). */
  firstSeenMs: number;
}

export interface SourcedValue<T> {
  value: T;
  status: SourceStatus;
  /** Human-readable origin, e.g. "CoinMetrics Community API" */
  source: string;
  /** ms epoch of when this value was last refreshed */
  updatedAt: number;
}

/** Net real ZEC flow into (+) or out of (-) shielded pools over a window, from observed transactions. */
export interface FlowWindow {
  hours: number;
  netZec: number;
  /** Count of real on-chain shielding/unshielding transactions summed into this window. */
  txCount: number;
  /** How much of the requested window is actually backed by collected real transaction history. */
  coverageMs: number;
  /** true when coverageMs < the full requested window — i.e. this is a real but partial-history figure. */
  partial: boolean;
}

export interface SupplySnapshot {
  /** Total circulating ZEC supply (live, from CoinMetrics). */
  totalSupply: number;
  /** Fraction of totalSupply currently shielded, 0..1 — anchored baseline + live real deltas. */
  shieldedFraction: number;
  shieldedZec: number;
  transparentZec: number;
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

/** A real, individual on-chain Zcash transaction that moved value into or out of the shielded pools. */
export interface BattleEvent {
  id: string;
  kind: 'shield-surge' | 'unshield-attack';
  side: 'shield' | 'transparent';
  /** normalized 0..1 severity relative to recently-seen transaction sizes, drives VFX/courier scale */
  magnitude: number;
  netZec: number;
  message: string;
  timestamp: number;
  /** Real Zcash transaction hash — click-through provenance, not present on legacy/synthetic entries. */
  txHash: string;
  blockId: number;
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
  /** 0 (all transparent) .. 1 (all shielded) — drives the fort's territory radius. */
  frontLine: number;
  /** Smoothed momentum used for camera/army animation, -1..1, derived from recent real transaction flow */
  momentum: number;
  momentumState: MomentumState;
  /** Real transactions, newest first — the live activity feed and the source of every courier VFX. */
  events: BattleEvent[];
  /** Real pending shielded-pool transactions currently in the mempool (the Mempool Scouts). */
  scouts: MempoolScout[];
  /**
   * Net shielded ZEC observed LIVE since this session loaded (starts at 0,
   * moves only with real confirmed deltas). Drives the visible growth of the
   * Shielded Growth Monument; the honest absolute total stays in supply.shieldedZec.
   */
  sessionNetShieldedZec: number;
  sources: {
    supply: SourceStatus;
    market: SourceStatus;
    flows: SourceStatus;
    mempool: SourceStatus;
  };
}
