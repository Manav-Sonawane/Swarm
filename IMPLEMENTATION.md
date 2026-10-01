# IMPLEMENTATION.md — Swarm (5-Hour Hackathon, 2-Person Team)

> Read `CONTEXT.md` first (§0 scope, §5 algorithm). This file covers *who builds what, in what order, and the sync contract*.
> Fix `BUGS.md` P0 items before anything else: the code imported from the prototype doesn't produce meaningful metrics until they are fixed.
> **Effort split:** ~60% algorithm + simulation (Person A), ~25% visualization (Person B), ~15% data flow (shared).
> **Platform:** Web app (Vite + React), not mobile.

---

## Roles

| | **Person A — Engine** | **Person B — Experience** |
|---|---|---|
| **Owns** | Simulator, allocators (Naive + Baseline + Swarm), multi-store logic, disruptions, metrics | Web UI (Setup, Live operations, Results screens), map, explainability, pitch deck |
| **Core skill** | Backend, algorithms, multi-store coordination | Frontend, UX, visualization |
| **Deploys** | Server on `localhost:5000` | Client on `localhost:3000` (Vite dev server; port set in `vite.config.ts`, Vite's default is 5173) |

**Golden Rule:** The socket contract (§2) is frozen at **hour 1**. Either person can add fields, but nobody renames or removes one without notifying the other.

---

## Repo Structure

```
Swarm/
├── CONTEXT.md
├── IMPLEMENTATION.md
├── BUGS.md                       # fix P0 before Phase 2
├── server/
│   ├── src/
│   │   ├── index.ts              # express + socket.io bootstrap
│   │   ├── config.ts             # all constants (stores, speeds, etc.)
│   │   ├── types.ts              # shared domain types (MUST match contract)
│   │   ├── seed/
│   │   │   ├── stores.ts         # 15 stores, shared inventory catalog, packing queues
│   │   │   └── riders.ts         # 6 riders per store (total ~90)
│   │   ├── sim/
│   │   │   ├── clock.ts          # tick loop, speed, pause/reset
│   │   │   ├── world.ts          # World class: state + step()
│   │   │   ├── orderGenerator.ts # seeded Poisson arrivals
│   │   │   ├── movement.ts       # move riders, detect arrivals/deliveries
│   │   │   ├── travel.ts         # travel_time(), traffic_multiplier()
│   │   │   └── store-select.ts   # serving store = nearest online dark store within the service radius
│   │   ├── alloc/
│   │   │   ├── naive.ts          # comparison: nearest free rider in the whole city, pools ignored
│   │   │   ├── baseline.ts       # comparison: serving store + its nearest free rider, solo
│   │   │   ├── swarm.ts          # rolling-horizon insertion (CONTEXT §5)
│   │   │   ├── insertion.ts      # insert order into a trip, try drop sequences, hard deadline check
│   │   │   ├── rebalance.ts      # periodic rebalance with freeze window
│   │   │   ├── packing.ts        # queue re-ordering (priority + zone)
│   │   │   └── feasibility.ts    # order class + risk-padded ETA
│   │   ├── scenarios.ts          # monsoon, store-offline, rider-offline, surge
│   │   └── metrics.ts            # on-time %, lateness, km, reassignments, decision ms, …
│   └── package.json
└── client/
    ├── src/
    │   ├── App.tsx               # screen switcher: Setup | Live operations | Results
    │   ├── socket.ts             # socket connection + mock mode
    │   ├── mock/
    │   │   └── mockStream.ts     # fake snapshots for offline dev
    │   ├── components/
    │   │   ├── SetupPanel.tsx    # screen 1: riders/store, demand, packing slots, traffic, seed
    │   │   ├── MapView.tsx       # screen 2: one map per world (Baseline | Swarm), synced
    │   │   ├── MetricsPanel.tsx  # screen 2: live headline metrics
    │   │   ├── ResultsView.tsx   # screen 3: Naive vs Baseline vs Swarm table + charts
    │   │   ├── Header.tsx        # clock, seed, active scenario, connection
    │   │   ├── FinalScoreboardModal.tsx # end-of-run summary
    │   │   ├── ScenarioBar.tsx   # buttons: monsoon, offline, surge, etc.
    │   │   ├── SimControls.tsx   # play/pause/speed/seed
    │   │   ├── OrderDrawer.tsx   # explainability: why this store? why this rider?
    │   │   └── EventLog.tsx      # real-time events
    │   ├── lib/
    │   │   ├── format.ts         # time & number formatting
    │   │   └── colors.ts         # store colors, status colors
    │   └── index.css
    └── package.json
```

---

## The Contract (Freeze by Hour 1)

### From Server → Client (every real tick, ~1/sec)

```typescript
// Exactly what server/src/types.ts sends and client/src/types.ts expects (checked by tsc: the server types
// must be assignable to the client types).
socket.on('tick', (payload: TickPayload) => { /* ~1/sec */ })

interface TickPayload {
  simTime: number;              // sim seconds
  speed: number;                // 1x … 30x
  running: boolean;
  seed: number;
  activeScenario: string;       // 'normal' | 'monsoon' | 'spike' | 'store_offline'
  weatherMult: number;          // 1 clear, 0.67 monsoon (speed factor)
  worlds: {
    baseline: WorldSnapshot;
    swarm: WorldSnapshot;
    naive: WorldSnapshot;       // full snapshot too
  };
  forecast: { ordersPerHourLast5Min: number; surge: boolean }; // demand forecaster
}

interface WorldSnapshot {
  stores: StoreSnapshot[];      // 15
  riders: RiderSnapshot[];      // 90
  orders: OrderSnapshot[];      // active orders + the last 30 delivered
  metrics: Metrics;
}

interface StoreSnapshot {
  id: string; name: string;
  lat: number; lng: number;
  queue: number;                // orders waiting or being packed
  offline: boolean;             // store_offline scenario
}

interface RiderSnapshot {
  id: string;
  lat: number; lng: number;
  status: 'idle'|'to_store'|'at_store'|'delivering'|'returning'|'offline';
  load: number;                 // orders on the rider's trip (capacity 3)
  routeLine: [number, number][]; // current position, then the remaining stops
  homeStoreId: string;          // the one dark store this rider belongs to
  deliveries: number;           // completed this run
}

interface Stop {                // inside DecisionRecord.chosen.tripStops
  type: 'pickup' | 'drop';
  orderId?: string;
  storeId?: string;
  loc: { lat: number; lng: number };
  eta: number;                  // projected sim time of arrival
}

interface OrderSnapshot {
  id: string;
  lat: number; lng: number;
  status: 'placed'|'assigned'|'packing'|'packed'|'picked'|'delivered'|'cancelled'|'failed'|'rejected';
  priority: 'express' | 'regular';
  class: 'express' | 'regular' | 'infeasible';
  servingStoreId?: string;      // nearest online dark store, fixed at checkout
  storeId?: string;             // store it is being packed at (= servingStoreId)
  riderId?: string;
  riderHomeStoreId?: string;    // differs from the serving store only for Naive
  createdAt: number;
  assignedAt?: number;          // real event times
  packedAt?: number;
  pickedAt?: number;
  deliveredAt?: number;
  tripSize?: number;            // orders on the rider's trip at pickup (1 = solo)
  promisedBy: number;
  projectedEta?: number;
  isLate: boolean;
  items?: { sku: string; qty: number }[];  // the real basket
  failReason?: string;
  zoneId?: string;
  // The explanation (DecisionRecord) is NOT embedded: GET /api/decision/:world/:orderId
}

interface DecisionRecord {
  decidedAt: number;
  chosenStore: string;
  chosenRider: string;
  reason: string; // human-readable, e.g. "Nearest feasible store with lowest queue"
  storeOptions: { storeId: string; eta: number; queueDepth: number; feasible: boolean }[];
  riderOptions: { riderId: string; insertionTime: number; tripEta: number; feasible: boolean }[];
  batchSavingSec: number;    // vs a solo trip
  rejectedInfeasible: number; // options removed by the hard deadline filter
  decisionMs: number;        // wall-clock time of the allocator call
}

interface Metrics {
  // headline: reliability first
  onTimeRate: number;       // 0–1
  p90LatenessSec: number;
  maxLatenessSec: number;
  ordersFailed: number;     // cancelled by the system, stock-outs, stranded
  // speed & efficiency
  avgDeliverySec: number;
  p90DeliverySec: number;
  kmTotal: number;
  kmPerOrder: number;
  // stability & compute
  reassignments: number;
  decisionMsAvg: number;
  decisionMsMax: number;
  // operations
  ordersByClass: { express: number; regular: number; infeasible: number };
  ordersPerZone: Record<string, number>; // storeId → orders
  ordersPacked: number;
  ordersDelivered: number;
  ordersPending: number;
  ordersLate: number;
  ordersAtRisk: number;
  packingQueueDepth: number;
  maxPackingQueueAcrossStores: number;
  ordersPerTrip: number;    // batching rate
  riderUtilization: number; // 0–1, average
  fairnessStdDev: number;   // std-dev of deliveries per rider
  history: MetricsHistoryPoint[];
}

interface MetricsHistoryPoint {
  t: number; // sim seconds
  onTimeRate: number;
  avgDeliverySec: number;
  packingQueueDepth: number;
}
```

### From Client → Server

```typescript
socket.emit('control', { action: 'play'|'pause'|'reset', speed?: number, seed?: number,
  setup?: { ridersPerStore?: number; ordersPerHour?: number; packingSlots?: number; traffic?: 'normal'|'peak' } }); // setup applies on reset
socket.emit('scenario', { name: 'monsoon'|'store_offline'|'rider_offline'|'surge'|'cancel_burst'|'stockout'|'clear' });
```

### REST Endpoints

```
GET /api/decision/:world/:orderId  → DecisionRecord | 404
GET /api/stores                    → StoreSnapshot[]
GET /api/export                    → { naive, baseline, swarm, seed, setup, timestamp }
```

---

## Timeline & Tasks (5 Hours)

The prototype import already covers the old "foundation" and "moving riders" phases, so the timeline starts from stabilising it.

### **Phase 1: Stabilise (0–1h)**

**Person A:**
- [x] `BUGS.md` P0 #1–#6 (departure slack, distance-based promises, metrics clock, real packing queue, at-risk estimate, rider-offline order loss)

**Person B:**
- [ ] Align client types and components to the contract above (`worlds.naive`, new `Metrics` fields, `DecisionRecord`)
- [ ] `mockStream.ts`: 15 stores, all three worlds, so the UI can be built without the server

**Checkpoint 1 (1h):** `BUGS.md` "Done when" passes for the P0 items. Real server drives the UI.

---

### **Phase 2: Swarm Core + Comparisons (1–2.5h)**

**Person A:**
- [x] `feasibility.ts`: classes (express / regular / infeasible), promises from the risk-padded ETA
- [x] `store-select.ts`: serving store = nearest online dark store inside the 3 km service radius (Zepto/Blinkit style: the cart only offers in-stock items, so no stock-based store choice)
- [x] `insertion.ts` / `swarm.ts`: hard deadline filter (every order on the trip), score feasible only, regret ordering (CONTEXT §5 steps 1–7)
- [x] Time every allocator call → `decisionMs` on decisions, `decisionMsAvg/Max` in metrics
- [x] `naive.ts` + third headless world sharing the same order stream
- [x] `BUGS.md` P1 #7–#9 (cross-store batch, erased route, stale ETA)

**Person B:**
- [x] `SetupPanel.tsx`: riders/store, demand, packing slots, traffic, seed → `control: reset` with `setup`
- [x] Live operations: Baseline | Swarm maps with synced zoom/pan, order colours by class + risk, routes
- [x] Assignment table: order, store, rider, ETA vs promise, batched with
- [x] Headline metrics: on-time %, P90/max lateness, failed, decision ms

**Checkpoint 2 (2.5h):** On seed 42, normal mode, Swarm on-time % ≥ Baseline; decision time visible and < 200 ms. Check with `cd server && npm run bench` (headless, all three worlds; add events like `-- 60 "20:monsoon"`).

---

### **Phase 3: Adaptation + Results (2.5–4h)** — Hardest block

**Person A:**
- [x] `rebalance.ts`: every `REBALANCE_SEC` and on every disruption, freeze window, `REASSIGN_MIN_GAIN_SEC`, reassignment count + `ORDER_REASSIGNED` events
- [x] `scenarios.ts`: monsoon, store offline, rider offline, surge, cancellation, stock-out, clear; same targets in every world (seeded). Contract names accepted; prototype names (`spike`, `riders_offline`, `clear_weather`) kept as aliases for the current buttons
  - Monsoon: weather multiplier 1.5× (stacks with peak traffic 1.3×)
  - Store offline: seeded pick of an online store; unpicked orders released and re-allocated; its riders join the nearest online store until `clear`
  - Rider offline: release orders, re-allocate
  - Surge: 3× order rate for 10 min
- [x] `metrics.ts`: lateness P90/max, failed, km total/per order, orders per zone, by class (on-time % and lateness count every *decided* order, incl. undelivered ones past their promise)

**Person B:**
- [x] `ResultsView.tsx`: Naive vs Baseline vs Swarm table (reliability first) + on-time and lateness charts
- [x] `OrderDrawer.tsx`: store options, options removed by the deadline filter, batch saving, decision ms
- [x] `EventLog.tsx`: placed, assigned, batched, reassigned, at-risk, delivered late

**Checkpoint 3 (4h):** **CRITICAL QUALITY GATE.** Normal + monsoon: Swarm beats **both** baselines on on-time % and worst-case lateness; max decision time < 200 ms. If not, A tunes `config.ts` before moving on. **Do NOT proceed without this.**

> **Result (2026-10-01):** ✅ passed on the average of seeds 1–8 (`ORDERS_PER_HOUR` 300, `MAX_HOLD` 0): on-time Baseline → Swarm 66.2 → **72.8%** normal, 48.6 → **52.1%** monsoon (Swarm ahead on 8/8 seeds each); P90 lateness 500 → 304 s and 631 → 544 s; max lateness 1331 → 1170 s and 1596 → 1463 s; Swarm decision max ≈ 11–13 ms. Naive is far behind (60.5% / 46.0%). Seed 42 was the exception at that point (Swarm lost the monsoon 51.0 vs 53.8%). Re-run: `cd server && npm run bench -- 60 "20:monsoon" <seed>`.

> **Tuning round (2026-10-01, later) — Swarm stats boost.** Found with a 12-core in-process sweep (16 train seeds × 5 scenarios per config), then validated on 40 held-out seeds (101–140). Held-out on-time Baseline vs Swarm, average of normal / monsoon / surge / store-offline / rider-offline: **57.2 vs 63.0% before → 57.2 vs 69.7% after**; Swarm wins 200/200 runs (was 197/200); P90 lateness (Baseline → Swarm before → Swarm after) 640 → 480 → **376 s**, max lateness 1434 → 1378 → **1261 s**. Gains hold at finer ticks (dt 10 s: 60.9 → 66.5%; dt 3 s: 69.6 → 75.1%) and over 120 min (34.0 → 45.3%). Seed 42 now: normal **91.3 vs 80.2%**, monsoon **58.5 vs 53.8%**, full 45-min demo sequence **65.6 vs 60.6%**. What drove it: (1) **rider-time cost** `W_RIDE` (+3.5 pts, the big one), (2) tighter feasibility pad 1.05 (+1.2), (3) rider pooling + resting at the nearest store (+0.8), (4) savable-first triage (+0.3), (5) fairness term (+0.2, fairness 0.89 → 0.85). **Tried and rejected:** ready-rider reserve for express orders (every variant worse), alternative assignment orders (EDF / FIFO / regret: worse), batch-partner holds and CAPACITY 4–5 (worse or noise), rebalance timing/threshold knobs (no effect), a heavier rider-time weight on unsavable orders (+1.5 pts on-time but +25% max lateness, a trade against the worst-off customers). **Ablation:** letting Baseline pool riders too makes it *worse* (57.8 → 52.2%), so pooling is not what carries the result; the cost-aware assignment is.

> **Zepto/Blinkit-style serving (2026-10-01, later).** The store is now fixed by the address: each customer is served by their nearest online dark store, the cart only offers items that store has in stock (out-of-stock items just aren't there), and riders belong to one store and never fetch from another. Removed: stock-based store choice and store hopping, the "no stocked store nearby" rejections (only addresses outside the 3 km service radius are rejected now), the rider-pooling code (it stopped helping once orders can't hop between stores), and `CANDIDATE_STORES`. Added: one shared inventory catalog owned by the order stream (every world sees the same orders), `servingStoreId` on orders, and offline-store handling that re-serves unpicked orders from the next-nearest store that has the items (else they fail). Naive is now "nearest free rider in the whole city, pools ignored". Because the old model silently rejected ~15% of orders for stock, `ORDERS_PER_HOUR` was recalibrated 300 → **255** so the accepted load is unchanged. Held-out seeds 101–140, same five scenarios, Baseline vs Swarm on-time: **57.2 / 69.7% before → 70.8 / 77.0% after** (Swarm wins 198/200); finer ticks dt 10 s 54.9 / 66.5 → 67.7 / 74.0, dt 3 s 62.5 / 75.1 → 76.9 / 82.6; 120 min 25.1 / 45.3 → 47.3 / 60.9. P90 lateness (Baseline → Swarm) 445 → 291 s, max lateness 1248 → 1160 s. Seed 42: steady **89.5 vs 81.2%**, monsoon **73.1 vs 62.9%**, full 45-min sequence 73.3 vs 71.9%. **Absolute numbers rose for every world** (shorter trips: Baseline 2.99 km/order, Swarm 2.61), but Swarm's *lead* over Baseline narrowed from about +12 to +6 points: choosing among stores was part of what Swarm did better than a greedy rule, and that decision no longer exists. The allocator settings from the earlier tuning round were re-swept and stay within noise of optimal (W_RIDE 0.5 to 1.5, pad 1.0 to 1.1, triage, fairness term all within ±0.3).

---

### **Phase 4: Polish (4–5h)**

**Person A:**
- [x] Tune constants from Checkpoint 3; run all scenarios on seed 42 in sequence (monsoon → store offline → rider offline → surge → cancel → stock-out → clear in 45 sim-min: no crash, no stuck orders, reproducible; Swarm 62.8% vs Baseline 60.6% on time, max lateness 473 vs 503 s)
- [x] Stretch: `packing.ts` (slack + zone order), demand forecasting, fatigue routing. Each measured over 8 seeds; see CONTEXT §6 "Stretch" for what each one does and doesn't buy
- [x] `BUGS.md` P2; `/api/export` with all three worlds

**Person B:**
- [x] `ScenarioBar.tsx` final buttons + "clear" (Monsoon, IPL Spike, Store Offline, Riders Offline, Stockout, Cancel Burst, Clear All)
- [x] `OrderLedger.tsx`: Side-by-side Blinkit-style live delivery ticker with deterministic Indian customer names (Ankit, Priya, Rohit...), items basket, delivery timeline stages, and on-time ✓ vs late ❌ comparison
- [x] Final scoreboard / results polish (3-way ResultsView modal with summary tabs, charts, breakdown, winner highlights)
- [x] Pitch deck (6 interactive slides: problem, the coupled decision, algorithm architecture, live digital twin, empirical results with <15ms latency, future roadmap + judge notes toggle)

**Checkpoint 4 (5h):** Demo script (§9 in CONTEXT.md) runs end-to-end without restart. Pitch deck ready. Code is clean enough to explain.

---

## What to Cut If Behind

1. Stretch USPs: demand forecasting, fatigue routing
2. `packing.ts` slack + zone ordering (keep the real FIFO queue)
3. Per-store metrics (show only global)
4. Event log (keep scenario buttons)
5. Setup screen (run with fixed defaults + seed input)
6. Explainability drawer
7. **Never cut:** coupled store + rider + route allocation with hard deadlines, comparison against at least Baseline, on-time % + worst lateness, decision time metric, side-by-side map

---

## Sync Rituals

- **Start of each phase:** 2-min huddle on what's about to happen
- **Checkpoint:** 5-min check-in. What's working? What's blocked? Are we cutting anything?
- **Git:** `main` only, short-lived feature branches. Merge at checkpoints, not mid-phase.
- **Contract violations:** If A needs to rename a socket field, tell B immediately before pushing.

---

## Judge Questions (Prepare Answers)

- **"Why multi-store instead of one?"** Real quick-commerce operates with multiple fulfillment centers. One store doesn't show routing complexity or the geo-selection problem.
- **"How do you handle store inventory?"** Like Zepto/Blinkit: you are served by your nearest dark store and the app only shows what it has in stock, so an item that is out of stock is simply unavailable. We never send a rider to a far-off store to fetch it. If a store goes offline, its orders are re-served from the next-nearest store that has the items, or fail.
- **"Why not use Google Maps API?"** Consistency across both worlds, no latency, and it's a hackathon (WiFi may fail). Pre-computed distance matrix is more reliable.
- **"Isn't 12 km/h too slow?"** It's door-to-door average, not cruising speed: signals, lanes, parking, finding the building. At peak it drops to ~9 km/h effective. It's also what makes the ~1.2 km express radius honest.
- **"Why extend the promise window instead of assigning a solo rider?"** Because a solo rider 2.5 km away still takes ~23 minutes at peak. We'd be lying to the customer either way. Better to extend upfront.
- **"Why not Dijkstra / A* / the Hungarian algorithm?"** Shortest-path gives travel time between two points; it doesn't choose the store, rider, batch or drop order. Hungarian matches one order to one rider and can't batch. We use rolling-horizon insertion with deadlines as hard constraints.
- **"Is it fast enough for real time?"** Every allocator call is timed and shown live; the budget is 200 ms, and "decisions within seconds" is the requirement.
- **"Why not re-optimize on every event?"** Constant reshuffling confuses riders. Assigned orders are only moved during a periodic rebalance, outside a freeze window, and only for a ≥60 s gain or to rescue an at-risk order. The reassignment count is on the dashboard.
- **"Why should we trust the comparison?"** Same seed, same orders, same disruptions for all three allocators, including a naive nearest-rider baseline.
- **"How does Swarm beat Baseline?"** Swarm picks store, rider and drop order together, never takes an option that breaks a promise, counts packing delay, and re-plans on disruptions without churning riders. Baseline is greedy and brittle.

---

## Success Criteria (At 5h)

- [ ] Multi-store routing working (customers served by their nearest online dark store)
- [ ] Naive + Baseline allocators running on the same order stream
- [ ] Swarm allocator visibly batching and beating both on on-time % and worst lateness
- [ ] Web UI: Setup, Live operations (side-by-side map), Results; scenario buttons
- [ ] Decision time per call shown, < 200 ms
- [ ] At least monsoon scenario works (and Swarm adapts)
- [ ] Demo runs for 90 seconds without crash
- [ ] Pitch deck ready
- [ ] Code is explainable (comments on complex logic)

---

## Tech Stack (Solid for 5h)

| Layer | Tech |
|---|---|
| **Server** | Node.js, Express, TypeScript, Socket.io, seedrandom |
| **Client** | Vite, React, TypeScript, react-leaflet, Recharts |
| **Maps** | Leaflet + OpenStreetMap (free, no API key) |
| **Distance** | Pre-computed JSON matrix (no routing API) |
| **State** | In-memory (no database) |

---

## Deploy & Demo

**Local:**
```bash
cd server && npm install && npm run dev     # localhost:5000
cd client && npm install && npm run dev     # localhost:3000
```

**For venue WiFi issues:**
- Both run on localhost, so no internet needed
- Map tiles: OSM tiles need internet. Pre-cache **before** the event while online (open the demo once and pan/zoom over all 15 stores so the browser caches the tiles), or use an offline tile package (nice-to-have, not critical)
- If WiFi still fails: tile fallback is gray, but data still works

---

## Post-Hackathon Improvements (Mention in Pitch)

- Real-time GPS tracking from rider app
- ML-based demand forecasting (not moving average)
- Multi-zone allocation (split city into regions, allocate per region)
- Rider incentive optimization (dynamic surge pricing for high-demand zones)
- Customer rerouting (suggest alternative delivery windows in real-time)
