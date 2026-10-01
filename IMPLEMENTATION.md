# IMPLEMENTATION.md — Swarm (5-Hour Hackathon, 2-Person Team)

> Read `CONTEXT.md` first. This file covers *who builds what, in what order, and the sync contract*.
> **Platform:** Web app (Vite + React), not mobile.

---

## Roles

| | **Person A — Engine** | **Person B — Experience** |
|---|---|---|
| **Owns** | Simulator, allocators (baseline + Swarm), multi-store logic, disruptions, metrics | Web UI, map, metrics dashboard, controls, explainability, pitch deck |
| **Core skill** | Backend, algorithms, multi-store coordination | Frontend, UX, visualization |
| **Deploys** | Server on `localhost:5000` | Client on `localhost:3000` (Vite dev server; port set in `vite.config.ts`, Vite's default is 5173) |

**Golden Rule:** The socket contract (§2) is frozen at **hour 1**. Either person can add fields, but nobody renames or removes one without notifying the other.

---

## Repo Structure

```
Swarm/
├── CONTEXT.md
├── IMPLEMENTATION.md
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
│   │   │   ├── baseline.ts       # per-store greedy allocator
│   │   │   ├── swarm.ts         # per-store smart allocator (global matching)
│   │   │   ├── matching.ts       # bipartite matching / Hungarian
│   │   │   ├── packing.ts        # queue re-ordering (priority + zone)
│   │   │   └── feasibility.ts    # order class + ETA calc
│   │   ├── scenarios.ts          # monsoon, store-offline, rider-offline, surge
│   │   └── metrics.ts            # on-time %, queue depth, utilization, fairness
│   └── package.json
└── client/
    ├── src/
    │   ├── App.tsx               # top-level layout
    │   ├── socket.ts             # socket connection + mock mode
    │   ├── mock/
    │   │   └── mockStream.ts     # fake snapshots for offline dev
    │   ├── components/
    │   │   ├── MapView.tsx       # one map (both worlds overlaid or split?)
    │   │   ├── MetricsPanel.tsx  # per-store cards + global comparison
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
    
    worlds: {
      baseline: WorldSnapshot;
      swarm: WorldSnapshot;
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
  riderOptions: { riderId: string; insertionTime: number; tripEta: number }[];
}

interface Metrics {
  onTimeRate: number;       // 0–1
  avgDeliverySec: number;
  p90DeliverySec: number;
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
socket.emit('control', { action: 'play'|'pause'|'reset', speed?: number, seed?: number });
socket.emit('scenario', { name: 'monsoon'|'store_offline'|'rider_offline'|'surge'|'clear' });
```

### REST Endpoints

```
GET /api/decision/:world/:orderId  → DecisionRecord | 404
GET /api/stores                    → StoreSnapshot[]
GET /api/export                    → { baseline, swarm, timestamp }
```

---

## Timeline & Tasks (5 Hours)

### **Phase 1: Foundation (0–1h)** — Together

- [ ] Both: repo setup, install deps, agree on contract §2
- [ ] A: express + socket.io bootstrap, emit dummy `tick` every 1 sec
- [ ] B: Vite app, socket connection, `MOCK=true` mode replays mockStream.ts

**Checkpoint 1 (1h):** B's UI shows fake orders/riders arriving from A's server.

---

### **Phase 2: One Store, Moving (1–2.5h)**

**Person A:**
- [ ] `travel.ts`: haversine, `travelTime(from, to, now)` with traffic multiplier
- [ ] `seed/stores.ts`: 15 stores (6 anchors + 9 fill-ins, see CONTEXT §2), locations, inventory (uneven)
- [ ] `seed/riders.ts`: 6 riders per store (name, location, status)
- [ ] `orderGenerator.ts`: seeded Poisson arrivals, zone-weighted distribution
- [ ] `world.ts`: state machine, movement loop, delivery detection
- [ ] `store-select.ts`: geofence (3 km), feasibility check, select nearest viable store
- [ ] `feasibility.ts`: order class (express / regular / infeasible)

**Person B:**
- [ ] `MapView.tsx`: Leaflet map, 15 store icons, rider dots, order dots
- [ ] Split layout: Baseline (left), Swarm (right), synced zoom/pan
- [ ] `SimControls.tsx`: play, pause, speed slider, seed input
- [ ] Basic metric numbers (on-time %, queue depth) in text, not charts yet

**Checkpoint 2 (2.5h):** Real server drives real UI. Both worlds are alive, orders spawn and get assigned (using baseline allocator for both for now). Riders move on map.

---

### **Phase 3: The Brains (2.5–4h)** — Hardest block

**Person A:**
- [ ] `baseline.ts`: greedy per-store allocator (nearest store, nearest idle rider, solo trip)
- [ ] `packing.ts`: queue re-ordering by slack + zone
- [ ] `matching.ts`: bipartite matching (Hungarian or greedy-with-lookahead)
- [ ] `swarm.ts`: smart allocator (store selection, global matching, drop re-ordering)
- [ ] `scenarios.ts`: monsoon, store offline, rider offline, surge
  - Monsoon: weather multiplier 1.5× (stacks with peak traffic 1.3×)
  - Store offline: release orders, re-allocate to next-nearest
  - Rider offline: release orders, re-allocate
  - Surge: 3× order rate for 5 min
- [ ] `metrics.ts`: on-time rate, queue depth, fairness std-dev, utilization

**Person B:**
- [ ] `MetricsPanel.tsx`: Recharts line charts (on-time %, queue depth over time)
- [ ] Per-store metric cards (queue, utilization, fairness)
- [ ] Global comparison: Baseline vs Swarm side-by-side numbers
- [ ] `OrderDrawer.tsx`: click order → show decision record (store options, rider options, reason)
- [ ] `EventLog.tsx`: real-time event feed (order placed, assigned, delivered, late, etc.)

**Checkpoint 3 (4h):** **CRITICAL QUALITY GATE.** Swarm must visibly beat Baseline on seed 42 in normal mode (no disruptions) on: on-time %, at-risk count, queue depth. If Swarm is not winning, A tunes `config.ts` before moving forward. **Do NOT proceed without this.**

---

### **Phase 4: Polish & Scenarios (4–5h)**

**Person A:**
- [ ] Fine-tune allocator constants if needed (from Checkpoint 3)
- [ ] Test all 4 scenarios on seed 42 in sequence
- [ ] REST endpoint for decision records
- [ ] Export metrics as JSON

**Person B:**
- [ ] `ScenarioBar.tsx`: big buttons for each scenario + "clear" reset
- [ ] Modal: final scoreboard (on-time %, at-risk, queue, fairness, orders delivered)
- [ ] "Baseline vs Swarm" headline metric
- [ ] Pitch deck (6 slides: problem, insight, algorithm, demo, results, future work)

**Checkpoint 4 (5h):** Demo script (§9 in CONTEXT.md) runs end-to-end without restart. Pitch deck ready. Code is clean enough to explain.

---

## What to Cut If Behind

1. Per-store metrics (show only global)
2. Fairness std-dev metric
3. Scenario: surge, stockout (keep monsoon + offline)
4. Event log (keep scenario buttons)
5. Explainability drawer
6. **Never cut:** multi-store logic, Swarm vs Baseline comparison, side-by-side map, on-time % metric

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
- **"How does Swarm beat Baseline?"** Swarm batches intelligently, respects feasibility, and re-optimizes on disruptions. Baseline is greedy and brittle.

---

## Success Criteria (At 5h)

- [ ] Multi-store routing working (customers assigned to nearest viable store)
- [ ] Baseline allocator working and visible on map
- [ ] Swarm allocator visibly batching and beating Baseline
- [ ] Web UI: side-by-side map, metrics, scenario buttons
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
