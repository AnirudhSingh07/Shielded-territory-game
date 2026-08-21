# Shielded Territory War

A live, theatrical, single-page visualization of Zcash's transparent vs.
shielded pool dynamics, presented as a real-time territory war on a stylized
battle-map. Built with **Vite + React + TypeScript + Three.js
(`@react-three/fiber`) + Tailwind CSS v4 + Zustand**.

> **This is a theatrical visualization of public on-chain data. Not financial
> advice.** No wallet connection, no trading, no login.

---

## 1. Architecture & data flow

```
┌────────────────────┐   ┌──────────────────────┐
│ CoinMetrics         │   │ Blockchair            │
│ Community API       │   │ Zcash Stats API       │
│ (REAL, live)         │   │ (REAL, live)           │
│ → total ZEC supply   │   │ → price / mkt cap /    │
└─────────┬───────────┘   │   block height / hash  │
          │                └──────────┬─────────────┘
          │                            │
          ▼                            ▼
   ┌─────────────────────────────────────────────┐
   │        src/data/useZecFeed.ts (orchestrator) │
   │  polls every 30s, merges providers, drives    │
   │  the shielded-dynamics simulation, reduces     │
   │  everything into one `WarState` object          │
   └───────────────────┬───────────────────────────┘
                        │
          ┌─────────────┴─────────────┐
          ▼                            ▼
 ┌──────────────────┐        ┌─────────────────────┐
 │ src/scene/*       │        │ src/ui/*              │
 │ Three.js battle-   │        │ HUD panels: stats,     │
 │ field: terrain,    │        │ flows, momentum banner,│
 │ armies, fog of war,│        │ activity feed, controls│
 │ front line, VFX    │        │                        │
 └──────────────────┘        └─────────────────────┘
```

`src/data/useZecFeed.ts` is the single place that knows about every data
source. Everything downstream (the 3D scene, the 2D fallback, every HUD
panel) only ever reads the reduced `WarState` type from `src/types.ts` — it
has no idea which numbers came from a live API vs. the simulation.

### Data provenance — what's real vs. modeled

Every panel in the UI carries a small **LIVE / STALE / SIMULATED** badge so
you always know what you're looking at. Nothing pretends to be live when
it isn't.

| Value | Source | Status |
|---|---|---|
| Total ZEC circulating supply | [CoinMetrics Community API](https://docs.coinmetrics.io/api/v4) (`SplyCur`, free, no key, CORS-enabled) | **LIVE** |
| Price, market cap, 24h change, block height, hash rate | [Blockchair Zcash Stats](https://blockchair.com/api/docs#link_M) (free, no key, CORS-enabled) | **LIVE** |
| Shielded vs. transparent split, pool breakdown, 1h/24h/7d net flows, battle events | `src/data/providers/simulation.ts` — a seeded, mean-reverting stochastic model | **SIMULATED** |

**Why the split is simulated:** as of writing there is no free,
browser-fetchable (CORS-enabled, no-signup) API that publishes the live
Sprout/Sapling/Orchard value-pool breakdown at sub-daily resolution — that
data only exists via full-node RPCs (`z_gettotalbalance`,
`getblockchaininfo().valuePools`) or paid indexer products, neither of which
a static browser app can call directly. Rather than fabricate a fake "live"
endpoint, `simulation.ts` is explicit about it (see the long comment at the
top of that file) and seeds from a documented, publicly-reported ballpark
(~30% of supply shielded). If you wire up a real feed (e.g. your own
zebrad/zcashd + indexer), swap that one module out — nothing else needs to
change, since it's consumed through the same `WarState` shape.

### Data mapping logic (on-chain numbers → visuals)

All of this lives in `src/logic/mapping.ts`, fully commented:

- **Front line position** — `shieldedFraction * 2 - 1` maps the 0–100%
  shielded share onto a −1..+1 axis, which `frontLineToWorldX` turns into an
  X coordinate on the 3D battlefield. Positive X = shielded (green)
  territory, negative X = transparent (red).
- **Army size** — each side's absolute ZEC amount is compressed with a
  square-root scale and clamped to a render-friendly instance count
  (`zecToUnitCount`), so the visual delta between e.g. 30% and 35% shielded
  is legible without rendering millions of instances or letting a supply
  outlier blow up the scene.
- **Fog of war** — recedes as `shieldedFraction` grows
  (`shieldedFractionToFogOpacity`); it represents "unshielded/unmapped"
  territory, not literal visibility.
- **Momentum & battle events** — the simulation engine's smoothed rate of
  change classifies into `privacy-surge / privacy-advancing / stalemate /
  transparent-counter / transparent-surge`, and any single large simulated
  flow (`magnitude > threshold`) spawns a cinematic event (airstrike beam +
  explosion + toast banner + activity-feed entry + optional sound).

---

## 2. Project structure

```
src/
  types.ts                    Shared domain types (WarState, BattleEvent, ...)
  data/
    providers/
      coinMetrics.ts            REAL: total supply
      blockchair.ts              REAL: market/network stats
      simulation.ts                SIMULATED: shielded dynamics engine
    useZecFeed.ts                 Orchestrator hook (polling, fallback, reduction)
  logic/
    mapping.ts                    Pure data → visual mapping functions
  state/
    uiStore.ts                    Zustand: sound/camera/intensity/disclaimer prefs
  scene/                          Three.js / @react-three/fiber
    Scene.tsx, Battlefield.tsx, FogOfWar.tsx, FrontLine.tsx, Army.tsx, CameraRig.tsx
    materials/                    Custom GLSL shaders (terrain, fog)
    effects/                      Explosions, airstrike beams, event manager
    fallback/Canvas2DBattlefield.tsx   2D canvas fallback if WebGL is unavailable
  ui/                             HUD panels (stats, flows, momentum, feed, controls...)
  audio/soundManager.ts           Fully synthesized Web Audio SFX (no audio files)
  hooks/, utils/                  Small shared helpers
```

---

## 3. Run locally

Requires Node 20+.

```bash
npm install
npm run dev       # http://localhost:5173
```

Other scripts:

```bash
npm run build      # type-check + production build to dist/
npm run preview     # serve the production build locally
npm run lint          # oxlint
```

---

## 4. Deploy

The app is a fully static bundle (`dist/`) after `npm run build` — no server,
no environment variables, no secrets. Any static host works.

### Cloudflare Pages
```bash
npm run build
npx wrangler pages deploy dist --project-name shielded-territory-war
```
Or connect the repo in the Cloudflare dashboard with build command
`npm run build` and output directory `dist`.

### Vercel
```bash
npm i -g vercel
vercel --prod
```
(Framework preset: Vite. Build command `npm run build`, output `dist`.)

### Any static host (Netlify, GitHub Pages, S3, etc.)
Upload the contents of `dist/` after running `npm run build`.

---

## 5. Notes on robustness / progressive enhancement

- **WebGL fallback:** `src/hooks/useWebGLSupport.ts` feature-detects WebGL;
  if unavailable, `src/scene/fallback/Canvas2DBattlefield.tsx` renders the
  same front-line/army data with plain 2D canvas instead of a blank screen.
- **Provider fallback:** if CoinMetrics is unreachable, total supply falls
  back to the last known good value, then to a documented hardcoded
  baseline — the app never hard-fails to a loading spinner.
- **Code-split:** the Three.js scene is lazy-loaded (`React.lazy`) so the
  HUD shell paints immediately while the (unavoidably large) Three.js chunk
  streams in behind it.
- **No external runtime assets:** all sound is synthesized live via the Web
  Audio API and the sky/lighting is procedural — nothing depends on a CDN
  being reachable at runtime beyond the two data APIs above (which degrade
  gracefully if blocked, e.g. by an ad-blocker or offline use).

---

## 6. Controls

- **Drag** to orbit, **scroll** to zoom, **W A S D** to pan.
- Camera slowly auto-orbits toward the front line when idle; any drag
  pauses it for a few seconds.
- Top-right panel: sound toggle, camera reset, and effect-intensity
  (low/normal/high).
