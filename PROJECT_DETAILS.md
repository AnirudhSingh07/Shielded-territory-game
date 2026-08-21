# Shielded Territory War — Project Details

A live theatrical visualization of Zcash's transparent vs. shielded pool
dynamics: two forts, two zebra armies, and a front line driven entirely by
real, individually observed on-chain transactions. This file is a plain-text
companion to `README.md` — everything about how the project is built,
exactly as it stands in the repo, for your own research.

Branch: `feat/shielded-territory-war`
Repo: https://github.com/AnirudhSingh07/Shielded-territory-game

---

## 1. Concept

Two forts face each other across a field: the green **Shielded Fort** and
the red **Transparent Fort**. An army of low-poly zebras garrisons each
side, sized by the real ZEC value on that side. A glowing front line sits
between them at a position set by the live shielded fraction of Zcash's
circulating supply.

The core mechanic: every real Zcash transaction that moves value into or
out of the shielded pools is fetched from a public block explorer and
replayed as a **courier zebra** physically running between the two forts —
green-bound for a shielding transaction, red-bound for unshielding. Big
transactions get a cannon-flash launch, a camera shake, and a floating
readout of the real ZEC amount. Clicking any line in the activity feed
opens that exact transaction on Blockchair.

**Design law:** nothing that reads as data may be fabricated. Where a real
live number doesn't exist (the absolute shielded-supply percentage has no
free public API), the app says so explicitly with a distinct badge rather
than quietly simulating it — see section 5.

---

## 2. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Build | Vite 8 | Fast dev server, static output, any host |
| UI | React 19 | Works cleanly with R3F's reconciler |
| 3D | three 0.185, @react-three/fiber 9, @react-three/drei 10 | InstancedMesh for armies, OrbitControls |
| Post-fx | @react-three/postprocessing, postprocessing 6 | Bloom + vignette |
| Styling | Tailwind CSS v4 (`@tailwindcss/vite`) | CSS-first `@theme` tokens, no config file |
| State | Zustand 5 | UI-only prefs; server data stays in plain React state |
| Fonts | @fontsource/rajdhani, @fontsource/orbitron | Self-hosted, latin-only subsets, no CDN `<link>` |
| Lint | oxlint | Catches React-purity/hooks issues R3F code trips easily |

No backend, no database, no environment variables, no API keys. The app is
a static bundle that talks directly to three third-party read-only APIs
from the browser.

---

## 3. Architecture & data flow

```
Blockchair /zcash/transactions ──┐   (real, per-tx shielded_value_delta)
CoinMetrics /asset-metrics ──────┼──► useZecFeed.ts ──► RealFlowEngine ──► WarState
Blockchair /zcash/stats ─────────┘    (orchestrator)     (accounting)        │
                                                                              ├──► Scene.tsx (3D)
                                                                              └──► HUD.tsx (2D panels)
```

`src/data/useZecFeed.ts` is the only place that knows about every data
source. On mount it fetches total supply, market stats, and a bounded
historical backfill of real transactions in parallel. Every 20 seconds
after that it re-polls the newest transactions and market stats, feeding
anything unseen into `RealFlowEngine`. Everything downstream reads only the
single reduced `WarState` object (`src/types.ts`) — nothing else touches
`fetch` directly.

**Poll cadence:**

| What | Interval | Where |
|---|---|---|
| Newest transactions | every 20s | `POLL_MS` in `useZecFeed.ts` |
| Market stats | every 20s | same poll loop |
| Total supply (CoinMetrics) | every ~4min | `SUPPLY_REFRESH_EVERY_N_POLLS = 12` |
| Initial transaction backfill | once, on load | `BACKFILL_TARGET_MS = 90 * 60_000` |

---

## 4. Data layer, endpoint by endpoint

All three sources are free, need no API key, and were confirmed (by hand,
with curl) to return correct CORS headers for direct browser `fetch`.

### CoinMetrics Community API — total supply

```
GET https://community-api.coinmetrics.io/v4/timeseries/asset-metrics
    ?assets=zec&metrics=SplyCur&frequency=1d&page_size={n}
```

`src/data/providers/coinMetrics.ts`. Daily `SplyCur` points, ascending by
default — no sort param needed.

> **Bug found & fixed during dev:** the original code appended
> `&sort=time&order=descending`. CoinMetrics rejects the `order` parameter
> outright with an HTTP 400 — every request was silently failing and
> falling back to a hardcoded constant, invisible until inspected via the
> network tab. Removing both params fixed it.

### Blockchair Zcash Stats — market & network flavor

```
GET https://api.blockchair.com/zcash/stats
```

`src/data/providers/blockchair.ts`. Price, market cap, 24h change, block
height, hash rate. Purely decorative for the ticker — nothing in the war
logic depends on it.

### Blockchair Zcash Transactions — the whole game

```
GET https://api.blockchair.com/zcash/transactions?s=time(desc)&limit={n}&offset={n}
```

`src/data/providers/zcashTransactions.ts`. Every transaction row includes
`shielded_value_delta` — the true signed zatoshi change to the shielded
pools that transaction caused. Positive = shielding, negative =
unshielding, zero = an ordinary transparent transfer. No other free,
CORS-enabled endpoint gives this at the individual-transaction level.

> **Query-syntax quirks found by hand:** `q=shielded_value_delta(1..)` (an
> open-ended positive range) works as a real server-side filter.
> `q=shielded_value_delta(..-1)` — any range containing a literal minus
> sign — returns `"input value should be numeric"` regardless of
> URL-encoding; their parser appears to mishandle `-` inside a range
> specifically. Exact negative *equality* (`q=shielded_value_delta(-773880)`)
> works fine, just not ranges. Net effect: the app doesn't rely on
> server-side filtering — it pages through the unfiltered recent list and
> filters client-side for `!== 0`, which sidesteps this entirely.

**Backfill:** on load, `backfillShieldedFlows()` walks backward through
pages of 100 (default `maxPages = 6`, up to 600 raw transactions) until
either 90 minutes of real coverage is reached or the page budget runs out.
Coverage that falls short is reported honestly via `FlowWindow.partial`
rather than padded.

**Dedup:** every ingested transaction hash is kept in a `Set<string>`
inside `RealFlowEngine`; the same tx arriving in two overlapping poll pages
is a no-op the second time.

---

## 5. The anchor accounting model

There is no free, browser-callable API that publishes the live *absolute*
total shielded ZEC supply — only individual transaction deltas, which the
app does have, live. `src/data/providers/realFlowEngine.ts` resolves this
with one deliberate approximation, applied exactly once:

```
fraction(now) = ANCHOR_FRACTION + Σ(real deltas from anchor time to now) / totalSupply
```

`ANCHOR_FRACTION = 0.3` — a documented public ballpark (Electric Coin Co. /
ZecHub ecosystem reporting) — is fixed once, at the oldest timestamp the
initial backfill reached. From that single starting constant onward, every
unit of movement is a real, observed transaction. Two sessions with the
same anchor and transaction history converge on the same trajectory — it's
arithmetic over real data, not a random walk.

**Status badges, precisely:**

| Badge | Means | Applies to |
|---|---|---|
| `LIVE` | Fetched fresh this poll, no derivation | Total supply, market stats |
| `LIVE·ANCHORED` | Anchor constant + running sum of real transactions | Shielded %, net flow windows |
| `STALE` | Reusing last good fetch; a new one just failed | Total supply, transient errors |
| `OFFLINE` | No successful fetch this session | Any source, worst case |

**Momentum:** `getMomentum()` sums real deltas over the trailing 30 real
minutes, normalizes against `MOMENTUM_SCALE_ZEC = 25`, and buckets into
`privacy-surge / privacy-advancing / stalemate / transparent-counter /
transparent-surge`.

**Event magnitude:** log-scaled —
`clamp(log10(1+zec) / log10(1+50), 0.04, 1)` — so a dust transaction still
registers a small courier while a 50+ ZEC shield saturates near 1.
`isMajorEvent()` gates cannon flash / camera shake / the big banner at
`magnitude > 0.45`.

**Flow windows:** 1h/24h/7d net-flow figures sum real deltas in that
window and report `coverageMs` (how much of the window is actually backed
by collected history) plus a `partial` flag when it isn't fully covered
(e.g. "17 real tx · 1.4h so far" instead of pretending a full figure).

---

## 6. The 3D scene

**Layout:** linear field along the X axis. Shielded Fort at
`+X (FIELD_HALF_WIDTH − FORT_MARGIN)`, Transparent Fort at the mirrored
`−X`. The front line sits between them at an X derived from the shielded
fraction. `FIELD_HALF_WIDTH = 32`, `FIELD_DEPTH = 30`, `FORT_MARGIN = 5`.

**Zebra armies:** `scene/geometry/zebraGeometry.ts` builds one low-poly
zebra (capsule body, sphere head, cone ears, cylinder legs/muzzle/tail, box
mane) as a single merged `BufferGeometry`, stripes/eyes/mane baked in as
near-black vertex colors against a near-white body. `Army.tsx` drives one
shared `InstancedMesh` per side (max 320 units); each instance's
`setColorAt` team tint *multiplies* the baked vertex colors, so white body
→ full green/red while dark stripes stay dark either way. Unit count is
`zecToUnitCount()` — real ZEC, square-root-compressed into a 30–300
instance range, idle slots sink below the field rather than despawning.

**Camera (`CameraRig.tsx`):** five preset cinematic shots, shuffled once
per session, each drifting continuously while held and eased into the
next:

| Shot | Target | Radius / height | Hold |
|---|---|---|---|
| wide | origin | 44 / 25 | 34s |
| front-line-sweep | live front-line X | 20 / 6.5 | 22s |
| shield-fort-close | near shield fort | 15 / 8.5 | 26s |
| transparent-fort-close | near transparent fort | 15 / 8.5 | 26s |
| high-overview | origin | 58 / 46 | 24s |

Dragging pauses the cycle; it resumes 4s after release, transitioning
smoothly from wherever the camera was left. `cameraShake.ts` is a shared,
non-React module supplying a per-frame offset on top of OrbitControls, so a
shake never forces a re-render.

**Shaders:** `materials/TerrainMaterial.ts` and `FogMaterial.ts` are
hand-written GLSL via drei's `shaderMaterial` — value-noise terrain
coloring that blends green/red across the front line with a pulsing glow
band, and an fbm-noise fog layer that thins as the shielded fraction grows.

---

## 7. Effects: real vs. cosmetic

This is the most structurally important part of the codebase for anyone
extending the visuals — two effect families exist, built to never be
confused with each other.

**Real — one per actual transaction:**
- `TransactionCourier.tsx` — a zebra physically runs the field between
  forts, dissolving into an `Explosion` burst on arrival.
- `CannonFlash.tsx` + camera shake — only for `isMajorEvent` transactions.
- `CinematicBanner.tsx` — a big in-scene Orbitron readout of the real ZEC
  amount, clickable through to the transaction.
- All orchestrated by `EventEffectsManager.tsx`, which watches
  `WarState.events` and spawns exactly one visual set per newly-seen
  transaction id.

**Cosmetic — never data, never confusable with the above:**
- `AmbientDust.tsx` — GPU-shader-driven drifting motes.
- `FrontLineSkirmish.tsx` — small spark clashes along the line every
  1.8–5s, self-triggered on a plain `setTimeout` loop. Deliberately much
  smaller/quieter than a real courier arrival: no banner, no sound, no
  activity-feed entry.
- Fort torches and banner sway (`Fort.tsx`), `Horizon.tsx`'s static
  mountain silhouette.

The rule: if a cosmetic effect could be mistaken for a real event, it
doesn't ship. This discipline exists because an earlier iteration of this
project used a synthetic random-walk for the war state — the whole rebuild
was about eliminating that.

---

## 8. Audio system

`src/audio/soundManager.ts` is 100% synthesized via the Web Audio API — no
`.mp3`/`.wav` files anywhere.

| Function | Sound | Trigger |
|---|---|---|
| `startAmbient` / `stopAmbient` | Brown-noise bed + 55Hz drone + random distant rumble every 18–38s | Sound toggle |
| `playShieldChime` | Rising 4-note triangle chord | Real minor shielding tx |
| `playAlertHit` | Descending sawtooth + lowpass | Real minor unshielding tx |
| `playCannonBoom` | Low sine thump + noise crack | Major real transaction |
| `playUiTick` | Short square blip | Defined, currently unused |

---

## 9. UI / HUD

All panels live in `src/ui/`, composed by `HUD.tsx` as a
`pointer-events-none` overlay with individual panels opting back into
`pointer-events-auto`.

| Component | Shows |
|---|---|
| StatsPanel | Shielded/transparent %, absolute ZEC, total supply, each with its own SourceBadge |
| FlowPanel | 1h/24h/7d net flow, real tx count, coverage caveat when partial |
| MomentumBanner | The five momentum-state labels |
| ActivityFeed | Last 12 real transactions (linked to Blockchair) + "watching the chain live · synced Xs ago" heartbeat |
| MarketTicker | Price, 24h change, market cap, block height |
| Controls | Sound toggle, camera reset, effect intensity (low/normal/high) |
| Disclaimer | First-visit modal explaining the anchor model; permanent footer line after |
| EventToast | Small 2D pill toast, lighter sibling to the in-scene CinematicBanner |
| LoadingScreen | Shown until the first backfill + first fetch resolve |

---

## 10. State management

Deliberately minimal. Zustand (`state/uiStore.ts`) holds only
user-facing preferences that don't come from the network: `soundOn`,
`intensity`, `autoOrbit`, `cameraResetToken`, `showDisclaimer`.
Server-derived data (the whole `WarState`) lives in a single `useState`
inside `useZecFeed` — no need for a global store since exactly one
component tree consumes it. `scene/cameraShake.ts` is the one deliberate
exception: plain module-level variables, not React state, because a shake
needs to be read every frame without ever triggering a re-render.

---

## 11. File-by-file reference

```
src/
  types.ts                        # WarState, BattleEvent, FlowWindow, SourceStatus...
  App.tsx                         # wires useZecFeed + WebGL detection + Scene/2D fallback + HUD
  main.tsx                        # font imports, React root

  data/
    providers/
      coinMetrics.ts              # REAL — total supply
      blockchair.ts               # REAL — market/network stats
      zcashTransactions.ts        # REAL — per-tx shielded_value_delta, backfill+poll
      realFlowEngine.ts           # accounting: anchor + real deltas -> fraction/flows/momentum/events
    useZecFeed.ts                 # orchestrator hook — the only thing that calls fetch()

  logic/
    mapping.ts                    # pure data->visual math: field geometry, unit counts, magnitude scale

  state/
    uiStore.ts                    # Zustand — UI prefs only

  scene/                          # Three.js / @react-three/fiber
    Scene.tsx                     # root Canvas, lights, postprocessing, composes everything below
    Fort.tsx                      # parameterized by side+x — both forts are one component
    Army.tsx                      # instanced zebra formations
    Battlefield.tsx / FogOfWar.tsx / FrontLine.tsx
    CameraRig.tsx                 # cinematic shot cycling + WASD + shake
    cameraShake.ts                # non-React shared module state
    AmbientDust.tsx / Horizon.tsx # cosmetic-only atmosphere
    geometry/zebraGeometry.ts     # merged BufferGeometry builder
    materials/                    # hand-written GLSL: Terrain, Fog, Dust
    effects/
      TransactionCourier.tsx      # REAL per-tx
      CannonFlash.tsx             # REAL, major events only
      CinematicBanner.tsx         # REAL, major events only
      Explosion.tsx               # shared particle-burst primitive
      EventEffectsManager.tsx     # watches real events, spawns the above
      FrontLineSkirmish.tsx       # COSMETIC ONLY — self-triggered, fenced off
    fallback/Canvas2DBattlefield.tsx  # plain-canvas fallback if WebGL is unavailable

  ui/                             # StatsPanel, FlowPanel, MomentumBanner, ActivityFeed,
                                   # MarketTicker, Controls, Disclaimer, EventToast, SourceBadge, HUD, LoadingScreen

  audio/soundManager.ts           # fully synthesized Web Audio, no asset files
  hooks/  useNowTick.ts, useWebGLSupport.ts
  utils/  format.ts               # number/currency/time formatting
```

---

## 12. Running & deploying

```bash
npm install
npm run dev        # http://localhost:5173

npm run build       # tsc -b && vite build -> dist/
npm run preview      # serve the production build locally
npm run lint           # oxlint
```

Fully static bundle — no server, no env vars, no secrets. Any static host
works: Cloudflare Pages (`npx wrangler pages deploy dist`), Vercel,
Netlify, GitHub Pages, or a plain S3 bucket. Build command is always
`npm run build`, output directory `dist`.

---

## 13. Known limitations

- **No live absolute shielded-supply API.** `ANCHOR_FRACTION = 0.3` is a
  one-time documented estimate, not a fetched value. Honestly badged, but
  could drift from ground truth over a very long session if the true
  baseline differed meaningfully from 30% at anchor time.
- **Blockchair is a single point of failure for the entire war mechanic.**
  Total supply and market stats degrade gracefully (stale/offline badges,
  cached fallback). But *every* transaction comes from one provider, no
  documented rate limits, no fallback provider.
- **Real shielding transactions are infrequent and bursty.** Observed
  stretches of 15+ real minutes with zero shielding/unshielding
  transactions network-wide. The activity-feed heartbeat addresses the
  perception; the underlying quiet-stretch experience is real and will
  recur.
- **No automated tests anywhere.** `RealFlowEngine`'s windowed-sum and
  anchor math is exactly the kind of logic that's easy to silently break
  during a refactor and hard to catch visually.
- **No color-blind mode.** The whole concept is green-vs-red; a real
  accessibility gap for red-green color-blind viewers even with the
  fort/line layout as a secondary cue.
- **Bundle size & performance headroom.** The lazy Scene chunk is ~1MB /
  ~270KB gzip. Never profiled on a low-end device or a large monitor at
  high DPR. Bloom + shadows + up to 640 instanced zebras + dust + skirmish
  particles is untested for sustained 60fps outside dev machines.
- **Small loose ends.** `playUiTick()` is defined and exported but never
  called. Camera reset resets position but not the cinematic shot index.
  No error boundary around the Canvas — a Three.js runtime exception can
  currently blank the 3D view with only React's dev-mode overlay to show
  for it.

---

## 14. Open research questions

- **A second real data source for confirmed transactions.** Is there a
  comparably free, CORS-enabled Zcash explorer with the same per-tx
  shielded-pool-delta granularity as Blockchair, usable as fallback or
  cross-check? Worth surveying Zcha.in successors, Zecrocks tooling, or
  running a self-hosted lightwalletd-fronted indexer.
- **Mempool (pending, unconfirmed) transactions as a faster real signal.**
  Blockchair exposes `/zcash/mempool/transactions` separately. Polling
  that more aggressively (~5s) could show incoming, not-yet-final
  shielding activity as a distinct "pending" pulse ahead of confirmation —
  genuinely faster than the ~75s block time allows, if designed carefully
  so it's never confused with a confirmed event.
- **A real, verifiable current anchor.** Is there a periodically-published,
  citable figure for absolute shielded supply (an ECC/ZecHub report, a
  research dashboard) that could replace the static `0.3` constant with
  something refreshed daily/weekly, keeping the real-transaction delta
  mechanic exactly as-is?
- **Visual/perf profiling pass.** Instrument actual frame time under load;
  consider dropping shadow-casting on the zebra armies specifically (640
  instances × shadow cast is likely the heaviest single line item).
- **Color-blind-safe palette toggle.** A second accent pairing (e.g.
  blue/orange) swapped in via the existing Tailwind theme tokens, toggled
  from Controls.
- **Automated regression coverage.** `RealFlowEngine`'s pure functions
  (`getFraction`, `getFlowWindow`, `getMomentum`) have no React/Three
  dependency — the cheapest, highest-value place to start unit testing.

---

## 15. External references

- [CoinMetrics API v4 docs](https://docs.coinmetrics.io/api/v4) — total-supply source
- [Blockchair API docs](https://blockchair.com/api/docs) — stats + transactions, the whole real-data backbone
- [Zcash Protocol Specification](https://zips.z.cash/protocol/protocol.pdf) — Sprout/Sapling/Orchard shielded pool mechanics
- [React Three Fiber docs](https://r3f.docs.pmnd.rs/)
- [drei](https://github.com/pmndrs/drei) — OrbitControls, Html, shaderMaterial, Stars
- [@react-three/postprocessing](https://github.com/pmndrs/react-postprocessing) — Bloom/Vignette
- [Tailwind v4 `@theme` docs](https://tailwindcss.com/docs/theme) — how `index.css`'s color/font tokens work

---

*Not financial advice. Theatrical visualization of public on-chain data.*
