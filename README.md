# Shielded Territory War

A live, theatrical, single-page visualization of Zcash's transparent vs.
shielded pool dynamics: a green Shielded Fort and a red Transparent Fort
face off across a live front line, each garrisoned by an army of zebras
whose numbers track the real ZEC on that side — and every courier zebra
that runs between the two forts is a **real, individual on-chain Zcash
transaction**, complete with cannon-flash launch and camera shake for the
big ones, animated the moment it's observed. Built with **Vite + React +
TypeScript + Three.js (`@react-three/fiber`) + Tailwind CSS v4 + Zustand**.

> **This is a theatrical visualization of public on-chain data. Not financial
> advice.** No wallet connection, no trading, no login.

---

## 1. Architecture & data flow

```
┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐
│ CoinMetrics    │  │ Blockchair     │  │ Blockchair              │
│ Community API   │  │ Zcash Stats    │  │ Zcash Transactions       │
│ (REAL, live)      │  │ (REAL, live)     │  │ (REAL, live, per-tx)       │
│ → total ZEC supply │  │ → price/mkt cap/ │  │ → shielded_value_delta on   │
└─────────┬─────────┘  │   block/hashrate │  │   every recent transaction   │
          │             └────────┬─────────┘  └───────────┬───────────────┘
          │                      │                          │
          ▼                      ▼                          ▼
   ┌───────────────────────────────────────────────────────────────┐
   │                 src/data/useZecFeed.ts (orchestrator)          │
   │  backfills ~90min of real transaction history, then polls      │
   │  every 20s; RealFlowEngine sums real deltas into a running      │
   │  shielded %, windowed net flows, momentum, and event feed        │
   └───────────────────────────┬─────────────────────────────────────┘
                                │
                  ┌─────────────┴─────────────┐
                  ▼                            ▼
         ┌──────────────────┐        ┌─────────────────────┐
         │ src/scene/*        │        │ src/ui/*              │
         │ Two forts, zebra    │        │ HUD panels: stats,     │
         │ armies, fog, front  │        │ flows, momentum banner,│
         │ line, courier +     │        │ activity feed (links to │
         │ cannon VFX per tx   │        │ the real tx), controls   │
         └──────────────────┘        └─────────────────────┘
```

`src/data/useZecFeed.ts` is the single place that knows about every data
source. Everything downstream (the 3D scene, the 2D fallback, every HUD
panel) only ever reads the reduced `WarState` type from `src/types.ts`.

### Data provenance — what's live vs. anchored

Every panel carries a small **LIVE / LIVE·ANCHORED / STALE / OFFLINE** badge
so you always know what you're looking at. Nothing pretends to be live when
it isn't, and nothing here is a random-walk simulation.

| Value | Source | Status |
|---|---|---|
| Total ZEC circulating supply | [CoinMetrics Community API](https://docs.coinmetrics.io/api/v4) (`SplyCur`, free, no key, CORS-enabled) | **LIVE** |
| Price, market cap, 24h change, block height, hash rate | [Blockchair Zcash Stats](https://blockchair.com/api/docs#link_M) (free, no key, CORS-enabled) | **LIVE** |
| Every shielding/unshielding transaction (the couriers, the activity feed, the 1h/24h/7d net flow) | [Blockchair Zcash Transactions](https://blockchair.com/api/docs#link_301) — the real `shielded_value_delta` field on every recent transaction (free, no key, CORS-enabled) | **LIVE** |
| Shielded-territory % | Real transaction deltas above, added to a one-time documented baseline anchor (see below) | **LIVE·ANCHORED** |

**How the real transaction feed works:** Blockchair's Zcash transactions
endpoint includes `shielded_value_delta` on every transaction — the signed
change to the shielded value pools it caused (positive = shielding,
negative = unshielding, zero = an ordinary transparent tx). On load, the app
backfills real transaction history (`src/data/providers/zcashTransactions.ts`,
paginated, bounded to ~90 real minutes so startup doesn't hang), then polls
for new transactions every 20s and ingests any not already seen (deduped by
hash). `src/data/providers/realFlowEngine.ts` sums these real deltas into
windowed net flows, a momentum figure, and the event feed — no
`Math.random()` anywhere in that file.

**Why the shielded % has one anchored constant:** there is no free,
browser-fetchable API that publishes the live *absolute* total shielded ZEC
supply — only individual transaction deltas (which we do have, live). So the
running shielded fraction is `ANCHOR_FRACTION + Σ(real deltas since the
anchor time) / totalSupply`. The anchor (~30% shielded, a documented public
ballpark) is fixed once, at the oldest point the initial backfill reached —
every unit of movement away from that single starting constant is 100% real,
observed, on-chain activity, which is why it's badged `LIVE·ANCHORED` rather
than `SIMULATED`. Net-flow windows (1h/24h/7d) that aren't yet fully covered
by collected history are honestly labeled "partial" with the real coverage
so far (e.g. "17 real tx · 1.4h so far") instead of being padded out.

### Data mapping logic (on-chain numbers → visuals)

All of this lives in `src/logic/mapping.ts`, fully commented:

- **Front line** — the live shielded fraction (0..1) maps linearly onto an
  X position between the two forts (`frontLineToWorldX`): the green
  Shielded Fort at +X, the red Transparent Fort at -X. More shielded → the
  line pushes toward the transparent fort's doorstep.
- **Army size** — each side's absolute ZEC amount is compressed with a
  square-root scale and clamped to a render-friendly instance count
  (`zecToUnitCount`), so the visual delta between e.g. 30% and 35% shielded
  is legible without rendering millions of zebras or letting a supply
  outlier blow up the scene. Both armies stand between their home fort and
  the front line, facing the enemy across it.
- **Fog of war** — thins out over whichever side currently has the upper
  hand (`shieldedFractionToFogOpacity`); it represents "unmapped/unprotected"
  territory, not literal visibility.
- **Courier zebras** — every real BattleEvent spawns one `TransactionCourier`
  that physically runs the length of the field between the two forts:
  Transparent Fort → Shielded Fort for a shielding transaction, the reverse
  for unshielding. Its scale is a log-scaled function of the real
  transaction's ZEC size (`magnitudeToEffectScale`), so a dust-sized shield
  and a 50+ ZEC shield both register, proportionally.
- **War effects** — transactions above a magnitude threshold
  (`isMajorEvent`) also get a `CannonFlash` muzzle-flash at the launching
  fort and a screen-shake kick (`scene/cameraShake.ts`, read every frame by
  `CameraRig`, written by `EventEffectsManager` — plain module state, not
  React, so a shake never forces a re-render) — the "big real transaction
  just landed" beat.
- **Momentum** — `RealFlowEngine#getMomentum` sums real deltas over the last
  30 real minutes and classifies into `privacy-surge / privacy-advancing /
  stalemate / transparent-counter / transparent-surge`.

### Built to be left on — continuous motion that isn't data

Real transactions are the *events*; the world around them needs to stay
alive on its own so a quiet stretch on-chain never reads as a frozen page.
None of the following represents any data point — it's set dressing, same
as a video game's ambient environment:

- **Cinematic camera** (`CameraRig.tsx`) — five preset shots (wide,
  front-line sweep, a close pass on each fort, high overview), shuffled per
  session, each held ~25–35s with its own slow continuous drift and a smooth
  eased transition into the next. Paused the moment you drag, resumes a few
  seconds after you let go.
- **AmbientDust.tsx** — a couple hundred GPU-animated drifting motes across
  the field, entirely shader-driven (one `uTime` uniform bump per frame, no
  CPU work).
- **Fort torches** (`Fort.tsx`) — flickering flame + point light per gate,
  driven by summed off-frequency sines so it never looks like a clean loop;
  banners sway continuously too.
- **FrontLineSkirmish.tsx** — small, quiet spark clashes at random points
  along the line every couple of seconds. Deliberately much smaller/quieter
  than a real `TransactionCourier` arrival (no banner, no sound, no
  activity-feed entry) so the two are never visually confused — this is
  the one place in the codebase that's allowed to just make something up,
  and it's fenced off accordingly.
- **Horizon.tsx** — a static distant mountain-ridge silhouette so the sky
  has somewhere to meet the ground.
- **Post-processing** (`@react-three/postprocessing`) — bloom (so the
  fort cores, army glow, and front line actually glow instead of just
  being flat-colored emissive shapes) + a vignette for cinematic framing.

---

## 2. Project structure

```
src/
  types.ts                    Shared domain types (WarState, BattleEvent, ...)
  data/
    providers/
      coinMetrics.ts            REAL: total supply
      blockchair.ts              REAL: market/network stats
      zcashTransactions.ts        REAL: per-transaction shielded pool deltas
      realFlowEngine.ts             Sums real deltas into fraction/flows/momentum/events
    useZecFeed.ts                   Orchestrator hook (backfill, polling, reduction)
  logic/
    mapping.ts                    Pure data → visual mapping functions
  state/
    uiStore.ts                    Zustand: sound/camera/intensity/disclaimer prefs
  scene/                          Three.js / @react-three/fiber
    Scene.tsx, Fort.tsx (x2, one per side), Battlefield.tsx, FogOfWar.tsx,
    FrontLine.tsx, Army.tsx, CameraRig.tsx, cameraShake.ts
    geometry/zebraGeometry.ts     Merged low-poly "cute zebra" BufferGeometry (instanced)
    materials/                    Custom GLSL shaders (terrain, fog)
    effects/                      TransactionCourier, CannonFlash, Explosion, event manager
    fallback/Canvas2DBattlefield.tsx   2D canvas fallback if WebGL is unavailable
  ui/                             HUD panels (stats, flows, momentum, feed, controls...)
  audio/soundManager.ts           Fully synthesized Web Audio SFX: ambient drone + distant
                                    rumble, shield chime, unshield alert, cannon boom
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
  same two-fort/front-line data with plain 2D canvas instead of a blank screen.
- **Provider fallback:** if CoinMetrics is unreachable, total supply falls
  back to the last known good value, then to a documented hardcoded
  baseline; if the transaction backfill is slow or a page fails, the engine
  just starts with whatever real history it collected and keeps growing it
  live — the app never hard-fails to a loading spinner.
- **Code-split:** the Three.js scene is lazy-loaded (`React.lazy`) so the
  HUD shell paints immediately while the (unavoidably large) Three.js chunk
  streams in behind it.
- **No external runtime assets:** all sound is synthesized live via the Web
  Audio API, the fort/zebras are procedural geometry (no downloaded 3D
  models), display fonts (Rajdhani + Orbitron) are self-hosted via
  `@fontsource` rather than a Google Fonts `<link>`, and lighting is
  procedural — nothing depends on a CDN being reachable at runtime beyond
  the three data APIs above (which degrade gracefully if blocked, e.g. by
  an ad-blocker or offline use).

---

## 6. Controls

- **Drag** to orbit, **scroll** to zoom, **W A S D** to pan.
- Camera slowly auto-orbits when idle; any drag pauses it for a few seconds.
- Top-right panel: sound toggle (ambient battlefield drone + shield chimes/
  unshield alerts/cannon booms on real events), camera reset, and
  effect-intensity (low/normal/high).
- Click any line in the Live Activity feed to open that real transaction on
  a block explorer.
