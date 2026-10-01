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
│   │   │   ├── stores.ts         # 15 stores, inventory, packing queues
│   │   │   └── riders.ts         # 6 riders per store (total ~90)
│   │   ├── sim/
│   │   │   ├── clock.ts          # tick loop, speed, pause/reset
│   │   │   ├── world.ts          # World class: state + step()
│   │   │   ├── orderGenerator.ts # seeded Poisson arrivals
│   │   │   ├── movement.ts       # move riders, detect arrivals/deliveries
│   │   │   ├── travel.ts         # travel_time(), traffic_multiplier()
│   │   │   └── store-select.ts   # geofence + select nearest viable store
│   │   ├── alloc/
│   │   │   ├── naive.ts          # comparison: nearest available rider, ignores stock + queue
│   │   │   ├── baseline.ts       # comparison: nearest stocked store + nearest idle rider, solo
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
socket.on('tick', (payload: TickPayload) => {
  {
    simTime: number;              // sim seconds
    speed: number;                // 1x, 2x, 10x, etc.
    running: boolean;
    seed: number;
    
    activeScenario: string;

    worlds: {
      baseline: WorldSnapshot;
      swarm: WorldSnapshot;
      naive: WorldSnapshot;     // metrics only: stores/riders/orders sent as []
    }
  }
})

interface WorldSnapshot {
  stores: StoreSnapshot[];
  riders: RiderSnapshot[];
  orders: OrderSnapshot[];
  metrics: Metrics;
}

interface StoreSnapshot {
  id: string; name: string;
  lat: number; lng: number;
  packingQueue: { orderId: string; status: 'waiting'|'packing'|'ready' }[];
  inventory: Record<string, number>; // sku → qty
}

interface RiderSnapshot {
  id: string; storeId: string;
  lat: number; lng: number;
  status: RiderStatus;
  load: number; // 0–1, fraction of capacity
  route: Stop[]; // remaining stops in order
  deliveries: number; // count this shift
}

interface Stop {
  type: 'pickup' | 'drop';
  orderId?: string;
  storeId?: string;
  lat: number; lng: number;
  eta: number; // sim seconds until this stop
}

interface OrderSnapshot {
  id: string;
  lat: number; lng: number;
  status: OrderStatus; // 'placed'|'assigned'|'packing'|'packed'|'picked'|'delivered'|'late'|'rejected'
  priority: 'express' | 'regular';
  class: 'express' | 'regular' | 'infeasible'; // feasibility
  assignedStoreId?: string;
  assignedRiderId?: string;
  createdAt: number;
  promisedBy: number;
  deliveredAt?: number;
  isLate: boolean;
  decision?: DecisionRecord; // for explainability
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
- [x] `store-select.ts`: 3 km geofence + stock + packing delay, top `CANDIDATE_STORES`
- [x] `insertion.ts` / `swarm.ts`: hard deadline filter (every order on the trip), score feasible only, regret ordering (CONTEXT §5 steps 1–7)
- [x] Time every allocator call → `decisionMs` on decisions, `decisionMsAvg/Max` in metrics
- [x] `naive.ts` + third headless world sharing the same order stream
- [x] `BUGS.md` P1 #7–#9 (cross-store batch, erased route, stale ETA)

**Person B:**
- [ ] `SetupPanel.tsx`: riders/store, demand, packing slots, traffic, seed → `control: reset` with `setup`
- [ ] Live operations: Baseline | Swarm maps with synced zoom/pan, order colours by class + risk, routes
- [ ] Assignment table: order, store, rider, ETA vs promise, batched with
- [ ] Headline metrics: on-time %, P90/max lateness, failed, decision ms

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
- [ ] `ResultsView.tsx`: Naive vs Baseline vs Swarm table (reliability first) + on-time and lateness charts
- [ ] `OrderDrawer.tsx`: store options, options removed by the deadline filter, batch saving, decision ms
- [ ] `EventLog.tsx`: placed, assigned, batched, reassigned, at-risk, delivered late

**Checkpoint 3 (4h):** **CRITICAL QUALITY GATE.** Normal + monsoon: Swarm beats **both** baselines on on-time % and worst-case lateness; max decision time < 200 ms. If not, A tunes `config.ts` before moving on. **Do NOT proceed without this.**

> **Result (2026-10-01):** ✅ passed on the average of seeds 1–8 (`ORDERS_PER_HOUR` 300, `MAX_HOLD` 0): on-time Baseline → Swarm 66.2 → **72.8%** normal, 48.6 → **52.1%** monsoon (Swarm ahead on 8/8 seeds each); P90 lateness 500 → 304 s and 631 → 544 s; max lateness 1331 → 1170 s and 1596 → 1463 s; Swarm decision max ≈ 11–13 ms. Naive is far behind (60.5% / 46.0%). **Seed 42 is the exception** (Swarm loses the monsoon 51.0 vs 53.8% and max lateness); seed 4 is a representative demo seed. Re-run: `cd server && npm run bench -- 60 "20:monsoon" <seed>`.

---

### **Phase 4: Polish (4–5h)**

**Person A:**
- [ ] Tune constants from Checkpoint 3; run all scenarios on seed 42 in sequence
- [ ] Stretch: `packing.ts` (slack + zone order), demand forecasting, fatigue routing
- [ ] `BUGS.md` P2; `/api/export` with all three worlds

**Person B:**
- [ ] `ScenarioBar.tsx` final buttons + "clear"
- [ ] Final scoreboard / results polish
- [ ] Pitch deck (6 slides: problem, the coupled decision, algorithm, demo, results incl. decision time, future work)

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
- **"How do you handle store inventory?"** Geofence first (which stores are close?), then check stock (which can fulfill this order?). We show it in DecisionRecord.
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

- [ ] Multi-store routing working (customers assigned to nearest viable store)
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
