import type { WarState } from '../types';
import StatsPanel from './StatsPanel';
import FlowPanel from './FlowPanel';
import MomentumBanner from './MomentumBanner';
import ActivityFeed from './ActivityFeed';
import Controls from './Controls';
import MarketTicker from './MarketTicker';
import EventToast from './EventToast';
import Disclaimer from './Disclaimer';

export default function HUD({ state }: { state: WarState }) {
  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-3 sm:p-5">
      {/* top row */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="pointer-events-auto flex flex-col gap-2">
          <div className="panel hud-clip flex items-center gap-2 px-3 py-1.5">
            <span className="h-2 w-2 animate-pulse-soft rounded-full bg-shield" />
            <h1 className="font-display text-xs font-bold tracking-[0.25em] text-ink uppercase sm:text-sm">Shielded Territory War</h1>
          </div>
          <div className="hidden sm:block">
            <StatsPanel state={state} />
          </div>
        </div>

        <div className="pointer-events-auto order-3 w-full sm:order-2 sm:w-auto sm:flex-1 sm:flex sm:justify-center">
          <MomentumBanner state={state.momentumState} />
        </div>

        <div className="order-2 flex flex-col items-end gap-2 sm:order-3">
          <MarketTicker market={state.market} status={state.sources.market} />
          <Controls />
        </div>
      </div>

      {/* mobile stats (compact, shown under top row on small screens) */}
      <div className="pointer-events-auto mt-2 sm:hidden">
        <StatsPanel state={state} />
      </div>

      {/* bottom row */}
      <div className="mt-auto flex max-h-[38vh] flex-wrap items-end justify-between gap-3 overflow-y-auto pt-3 sm:max-h-none">
        <div className="pointer-events-auto">
          <FlowPanel state={state} />
        </div>
        <div className="pointer-events-auto ml-auto">
          <ActivityFeed events={state.events} lastSyncedAt={state.supply.timestamp} />
        </div>
      </div>

      <EventToast events={state.events} />
      <Disclaimer />
    </div>
  );
}
