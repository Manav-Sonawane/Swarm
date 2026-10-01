# CONTEXT.md — Swarm (Multi-Store Edition)

> CSI TSEC 4.0 Hackathon, Problem Statement: **The Last Mile Problem**
> **Swarm**: Deciding when to commit, extend, or reject—not just which rider.

---

## 0. Scope: How We Read the Problem Statement

- **Core deliverable:** the dynamic allocation + routing algorithm (Requirement 3 calls it "the core challenge").
- **Supporting prototype:** just enough simulation and UI to feed it orders, riders, stores, inventory and disruptions, and to *show* its decisions. An algorithm alone (a function or notebook) would under-deliver.
- **Not required:** a customer e-commerce site (login, payments, product browsing, checkout).
- **The decision is coupled:** order → dark store → rider → position in the rider's route. The nearest rider may belong to a store without stock; the nearest store may have a packing queue; the shortest route may overload one rider while another could batch the order. All four are chosen together.
- **Effort split:** ~60% algorithm + simulation, ~25% visualization + dashboard, ~15% data flow. When cutting, protect the algorithm and the comparison first.

**Three screens:**
1. **Setup:** riders per store, demand rate, packing slots, traffic/weather, seed.
2. **Live operations:** map + tables showing assignments, routes, ETAs, batching and reassignment events.
3. **Results:** Swarm vs two baselines on reliability, speed, efficiency and decision time.

---

## 1. The Real Problem (Chembur Reality)

**What the customer sees:**
- Dark store 2 km away
- App shows routing distance: 8 km
- Promised delivery: 10 minutes
- Actual delivery: 15–20 minutes (because Mumbai traffic, building elevator, customer not home)
- Order is late. Rider blamed. System broken.

**What Swarm does:**
- Accepts the reality: 2 km = 15–20 min minimum
- 10-min delivery is **only feasible within ~1.2 km** (straight-line, normal traffic; ~0.95 km at peak)
- Beyond that: offer 20-min delivery (regular) or reject
- Don't promise what you can't keep
- Don't martyr riders with impossible SLAs

**Multi-store difference:**
- Not one store serving everyone
- 15 dark stores spread across Mumbai, ~2.5 km apart (nearest-neighbour 2.2–3.6 km, avg ~2.6 km)
- Each store has its own rider pool (6 riders per store, ~90 total). The comparison worlds keep strict pools; **Swarm may pool**: a rider can pick up at any online store within `SWARM_BORROW_KM` (3.5 km) of its home store, and rests at the nearest such store between trips
- When a customer orders, the system picks the **nearest viable store + most available rider**
- If the nearest store is overloaded, send to the next-nearest
- If all stores would miss the promise, extend the window upfront

---

## 2. The Setup (Chembur-Inspired, Realistic)

**Dark Stores** (15 locations, ~2.5 km apart). The 6 anchor stores are real neighbourhoods; the 9 fill-in stores are fabricated locations placed between them so the 3 km geofences leave no gaps:

| # | Store | Lat, Lng | Type | Nearest store |
|---|---|---|---|---|
| 1 | Andheri W | 19.1364, 72.8296 | anchor | Andheri E (3.6 km) |
| 2 | Bandra W | 19.0596, 72.8295 | anchor | Mahim (2.5 km) |
| 3 | Powai | 19.1176, 72.9060 | anchor | Marol (3.4 km) |
| 4 | Lower Parel | 18.9953, 72.8300 | anchor | Dadar (3.0 km) |
| 5 | Chembur | 19.0449, 72.8842 | anchor | Sion (2.4 km) |
| 6 | Ghatkopar | 19.0860, 72.9081 | anchor | Kurla (2.9 km) |
| 7 | Dadar | 19.0190, 72.8430 | fill-in | Mahim (2.3 km) |
| 8 | Mahim | 19.0400, 72.8410 | fill-in | Sion (2.2 km) |
| 9 | Santacruz | 19.0810, 72.8370 | fill-in | Vile Parle (2.2 km) |
| 10 | Vile Parle | 19.1000, 72.8440 | fill-in | Santacruz (2.2 km) |
| 11 | Andheri E | 19.1190, 72.8580 | fill-in | Vile Parle (2.6 km) |
| 12 | Sion | 19.0410, 72.8620 | fill-in | Mahim (2.2 km) |
| 13 | BKC | 19.0640, 72.8640 | fill-in | Kurla (2.4 km) |
| 14 | Kurla | 19.0726, 72.8845 | fill-in | BKC (2.4 km) |
| 15 | Marol | 19.1000, 72.8800 | fill-in | Kurla (3.1 km) |

**Per store:**
- Inventory: 40 SKUs (uneven distribution, e.g., Chembur has more instant noodles, Bandra has premium brands)
- Packing capacity: 2–3 orders simultaneously (~2 min per order)
- Packing queue: visible, prioritized by urgency

**Per store, rider pool:**
- 6 gig riders (~90 across all stores)
- Capacity: 3–4 orders per trip
- Status: idle, en route, at store, delivering, returning, offline
- Shift: 6 AM–11 PM (overlapping, busier during peaks)

**Demand:**
- 200–400 orders per peak hour, distributed across 15 stores
- Order density uneven by time and location
- Example: 6–9 AM morning commute in business districts (Bandra, Lower Parel); 6–9 PM in residential (Andheri, Chembur)

---

## 3. The Realistic Travel Model

**The formula (no black-box routing):**

```
road_km      = haversine(store, customer) * 1.3   // 1.3 = road factor (streets aren't straight)
base_eta_min = (road_km / 12) * 60                // 12 km/h = average door-to-door Mumbai bike speed
traffic_multiplier = 1.0 (normal) | 1.3 (peak 8–11, 18–21)
weather_multiplier = 1.0 (clear)  | 1.5 (monsoon)       // stacks: peak + monsoon = 1.95
elevator_delay_sec = 0–60 (if high-rise; not known upfront, so not used for classification)

total_eta_sec = (base_eta_min * 60 * traffic_multiplier * weather_multiplier) + elevator_delay_sec
```

**Why 12 km/h and 1.3:** they are chosen so the express radius is exactly ~1.2 km.
Express = 10 min total − 2 min packing = 8 min of riding. 1.2 km × 1.3 = 1.56 km of road; 1.56 km in 8 min = 11.7 km/h ≈ 12 km/h.

**Examples (Chembur store, travel + 2 min packing):**

| Straight-line | Road | Normal | Peak (×1.3) | Class (normal / peak) |
|---|---|---|---|---|
| 0.5 km | 0.65 km | 5.3 min | 6.2 min | express / express |
| 1.0 km | 1.3 km | 8.5 min | 10.5 min | express / regular |
| 1.2 km | 1.56 km | 9.8 min | 12.1 min | express / regular |
| 2.0 km | 2.6 km | 15 min | 18.9 min | regular / regular (matches the 15–20 min reality) |
| 2.5 km | 3.25 km | 18.3 min | 23.1 min | regular / infeasible |
| 3.0 km | 3.9 km | 21.5 min | 27.4 min | infeasible / infeasible |

**Resulting radii (straight-line from store):**

| Condition | Express (≤10 min) | Regular (≤20 min) |
|---|---|---|
| Normal | 1.23 km | 2.77 km |
| Peak (×1.3) | 0.95 km | 2.13 km |
| Monsoon (×1.5) | 0.82 km | 1.85 km |
| Peak + monsoon (×1.95) | 0.63 km | 1.42 km |

---

## 4. Order Classes & Feasibility

**When order arrives at (lat, lng):**

1. **Geofence:** Find all stores within 3 km
2. **For each candidate store:**
   ```
   store_eta = calculate_eta(store, customer)
   pack_time = 2 min
   total_time = store_eta + pack_time
   
   if total_time <= 10 min → "express" (promise 10 min, green)
   else if total_time <= 20 min → "regular" (promise 20 min, yellow)
   else → "infeasible" (red, offer extended or reject)
   ```
3. **Select store:** Pick the store with:
   - Shortest feasible ETA, OR
   - If tied, lowest packing queue depth, OR
   - If tied, highest active rider count
4. **Handle infeasible orders:**
   - Option A: Reject ("outside service area")
   - Option B: Offer extended (20–30 min) and let customer choose
   - Option C: Add to waitlist for next-generation inventory (future)

**Key:** Honesty upfront beats apologies later.

---

## 5. Allocation Algorithm: Rolling-Horizon Insertion

One allocator decides **store + rider + route position** for each order. Shortest-path methods (A*, Dijkstra) only give travel time between two points; they don't choose the store, rider, batch or drop order. The Hungarian algorithm is not used: it matches one order to one rider and can't express batching.

### When it runs
- On every **new order** and every **disruption** (monsoon, store/rider offline, cancellation, stock-out).
- On every **epoch** (`EPOCH_SEC` = 10 sim-s) for held orders.
- A broader **rebalance** every `REBALANCE_SEC` (60 sim-s), see Step 8.

### The ETA model
```
ETA = packing delay       (orders ahead in queue / packing slots × pack time + own pack time)
    + rider arrival       (rider → store, or 0 if already there)
    + delivery travel     (store → drops in sequence, up to this order)
    + expected disruption (traffic × weather multipliers, §3)
```
**Feasibility uses a risk-padded ETA:** travel legs × `ETA_RISK_PAD` (1.05). Riders still move at the expected speed; the pad is a small safety margin. (It was 1.15; the simulator has no random travel noise, so a larger pad only shrank the feasible set and cost ~2 pts of on-time. New orders are *classified* with a separate fixed `CLASSIFY_PAD` of 1.15 so every world gets the same promise.) Packing delay counts as much as distance: a store 500 m away with a 6-min queue loses to one 2 km away that can dispatch now.

### Steps
1. **Candidate stores:** within the 3 km geofence and holding stock for every item. Keep the best `CANDIDATE_STORES` (3) by packing delay + travel.
2. **Candidate riders:** not offline, below capacity, not yet departed, and allowed to serve that store (home store, or within the pooling radius). Any orders they already hold must be from the same store.
3. **Insertion:** for each (store, rider) pair, insert the order into the rider's trip and try every drop sequence (≤4 drops → ≤24 permutations).
4. **Hard deadline filter:** discard any option where **any** order on the trip, new or existing, misses its promise under the padded ETA. Deadlines are constraints, not score weights; otherwise a cheap but already-late option can win.
5. **Score the feasible options:** `cost = customer wait + delay imposed on orders already on the trip + W_LOAD × load + W_FAIR × (deliveries above the fleet average) + W_RIDE × rider time consumed`; ties go to the option with more minimum slack. "Rider time" is the marginal ride legs plus the leg back to the store: riders, not packing, are the bottleneck under load, so batching and nearby riders are preferred. A batch is only possible here if every affected order stays feasible.
6. **Assignment order (triage):** orders that can still be on time go first, most urgent first and then highest *regret* (2nd-best cost − best cost), so scarce riders go to orders with the fewest alternatives; orders that cannot be saved get the leftover riders. Rider state is updated after each assignment before the next order is evaluated.
7. **No feasible option:**
   - New order → the promise is extended upfront (§4, USP 0).
   - Already-promised order → assign the option that minimizes the worst lateness, and flag it **at-risk**.
8. **Rebalance with a freeze window:** every `REBALANCE_SEC`, reconsider orders that are assigned but not picked up.
   - **Frozen** (never moved): rider at the store or departed, or within `FREEZE_DIST_KM` (0.3 km) of the store.
   - **Move** only if the new option saves ≥ `REASSIGN_MIN_GAIN_SEC` (60 s) or turns an at-risk order feasible; a late order may also move to a still-late but ≥60 s sooner option, and an on-time order is never moved somewhere it would be late. This prevents churn: re-planning on every event makes operations unstable.
   - Also runs immediately on every disruption. Orders that started packing keep their store.
   - Every move counts as a **reassignment** (metric).
9. **Hold for batching:** an order may wait one epoch for a batch partner only if its slack after the best solo option > `HOLD_SLACK` (240 s) and it is younger than `MAX_HOLD` (60 s). Waiting has an opportunity cost.
10. **Rider departure:** leave when all orders are packed AND (capacity full OR min over the trip of `promisedBy − projected drop ETA` < `DEPART_SLACK`, 120 s). Slack is measured against the projected *drop* time, not "now".
11. **Decision time:** time every allocator call (wall-clock ms). Budget: < `DECISION_BUDGET_MS` (200 ms) per call, well within "decisions within seconds". Reported as a metric.

### Packing queue order (stretch)
Within a store, pack by slack (most urgent first), then group by zone so orders for the same trip finish together.

### Comparison allocators (same orders, same disruptions)
| Allocator | Rule |
|---|---|
| **Naive** | Nearest available rider to the customer; the order is packed at that rider's home store. Ignores stock and packing queue: a missing item = failed delivery. Solo trips. |
| **Baseline** | Nearest *stocked* store + nearest free rider, FIFO, solo trips. |

All three get the **same promise** per order by default (classified once on the shared stream), so the comparison measures allocation, not promise-setting. `BASELINE_PROMISES_10_MIN=true` makes Naive + Baseline promise 10 min to everyone, for the over-promising contrast in §9.
| **Swarm** | The algorithm above. |

---

## 6. USPs (in priority order)

### **USP 0: Feasibility Honesty** (Foundation)
- Don't promise 10 min if it's actually 20 min
- Classify orders upfront as express/regular/infeasible
- Show it on the UI: green (promise-able), yellow (extended), red (rejected)
- **Why:** Judges see product thinking. You're not blaming riders; you're being honest with customers.

### **USP 1: Coupled Decision with Hard Deadlines**
- Store, rider and drop sequence are chosen together (§5), not one after another
- Infeasible options are removed *before* scoring, so a cheap-but-late option can never win
- Batches only form when every order on the trip stays on time

### **USP 2: Packing-Aware Routing**
- Packing delay is part of every ETA, so a busy nearby store can lose to a free farther one
- Live metric: packing queue depth per store
- Stretch: pack in slack + zone order (§5)

### **USP 3: Stable Real-Time Adaptation**
- Monsoon? ETAs jump 50% → re-check feasibility, extend new promises
- Store offline? Release its unpacked orders, re-assign to the next-nearest store
- Rider offline? Re-allocate their orders to available riders
- Cancellation / stock-out? Remove from trips and queues, re-plan affected riders
- Rebalance uses a **freeze window** so riders aren't reshuffled constantly; the reassignment count is shown

### **USP 4: Measured, Not Claimed**
- Three-way comparison: Naive vs Baseline vs Swarm on the same seed
- Decision time per allocator call shown live (ms)
- Reliability first: on-time % and worst-case lateness lead the dashboard, average speed comes after

### **Stretch (implemented; measured over seeds 1–8)**
- **Packing queue order** (`packing.ts`, `SMART_PACKING`, on): Swarm stores pack savable trips first (tightest slack first) and keep a trip's orders together; already-late trips go after. Small but consistent: surge on-time 43.1 → 43.8%, P90 lateness slightly lower everywhere.
- **Demand forecasting** (`SURGE_FORECAST`, on): 5-min moving average of the order rate; at ≥2× normal it raises a `FORECAST_SURGE` alert and sets `forecast.surge` in the tick payload. The optional surge *policy* (`SURGE_MODE`: hold 60 s for batch partners, 4 orders per trip) moved on-time by <0.5 pt and made tail lateness slightly worse, so it is off by default: under a surge riders, not batch size, are the bottleneck.
- **Rider fatigue routing** (`W_FATIGUE`, on): riders with 7+ deliveries in the last 2 hours pay extra for long trips. Riders start with 0–5 deliveries of shift history (same in every world). At the calibrated load riders make 2–3 deliveries/hour, so it rarely fires: a safety valve, not a measurable gain.

---

## 7. Seed Data (Realistic)

**15 dark stores** in Mumbai area, ~2.5 km apart (6 anchors + 9 fill-ins, see §2):
- Each has 40 SKUs
- Inventory is uneven (some stores have surplus, others low)
- Packing rate: 2 min per order

**Rider pool per store:** 6 riders
- Total: ~90 riders across all stores
- Shifts: overlapping (peak hours have more riders)
- Capacity: 3–4 orders per trip

**Order stream** (seeded for reproducibility):
- Poisson arrivals, 200–400 orders/hour during peak
- Spatially distributed: weighted by zone population; customers are kept on land (`seed/land.ts` outline of the service area)
- Item mix varies by store and time
- Some orders are express, some regular
- 5% of orders are infeasible for express window

**Disruptions** (on button press):
- Monsoon: weather multiplier 1.5×, ETAs jump 50%
- Store offline: one store goes down, orders reroute
- Rider offline: random rider goes down mid-trip
- Power outage in zone: some customers unreachable
- Demand spike: 3× order rate for 5 minutes

---

## 8. Metrics (Global + Per Store), for all three allocators

**Headline (reliability first):**
- On-time delivery rate (%)
- Worst-case lateness: P90 and max lateness (min)
- Delayed / failed deliveries (count)

On-time % and lateness are computed over every **decided** order: delivered, failed, or undelivered and already past its promise (counted at its lateness so far). Counting only deliveries would reward an allocator for leaving its worst orders undelivered.

**Speed & efficiency:**
- Avg and P90 delivery time (min)
- Km travelled: total and per order
- Orders per trip (batching rate)
- Rider utilization (active time / shift time)

**Stability & compute:**
- Reassignment count
- Decision time per allocator call: avg and max (ms)

**Operations:**
- Packing queue depth (per store, and peak across stores)
- Orders by class: express / regular / infeasible
- Order density per zone (orders per store zone)
- Fairness std-dev (deliveries per rider)

**Comparison:** Naive vs Baseline vs Swarm, same seed and disruptions. The live view shows Baseline | Swarm maps; Naive runs headless and appears in the Results screen.

---

## 9. The Demo (Web App, 90 seconds)

### **Setup:**
- Map showing 15 stores + ~90 riders + live orders
- Baseline allocator (left side), Swarm allocator (right side)
- Same seed, same orders, same disruptions

### **Flow:**
1. **Normal evening:** Orders arrive, both worlds allocate. Swarm batches more, has lower queue.
2. **Customer places order 2 km away:**
   - Baseline: "10-min delivery!"
   - Swarm: "This is a 20-min order. Accept?" (shows feasibility upfront)
3. **Press monsoon button:**
   - Both worlds' ETAs jump
   - Baseline: on-time rate drops from 95% → 80%
   - Swarm: recalculates, extends promises, batches more, stays at 92%
4. **Press "store offline":**
   - Baseline: that store's orders pile up
   - Swarm: immediately reroutes orders to nearest store, re-allocates riders
5. **Results screen:** Naive vs Baseline vs Swarm: on-time %, worst lateness, failed deliveries, km per order, reassignments, decision time (ms)

### **Key moment:** Click a late order in Baseline, then the same order in Swarm. Show the explainability: why Baseline sent a solo rider (greedy), why Swarm batched it (both orders stayed feasible, and the batch saved X seconds).

---

## 10. Architecture

```
┌─────────── Server (Node + Express + Socket.io, TypeScript) ───────────┐
│                                                                        │
│  SimClock ──tick──► World (multi-store state)                         │
│      │              OrderGenerator (seeded Poisson, shared)           │
│      │              NaiveAllocator (headless, metrics only)           │
│      │              BaselineAllocator (greedy, solo trips)            │
│      │              SwarmAllocator (rolling-horizon insertion)        │
│      └──► ScenarioEngine (monsoon, offline, surge, etc.)             │
│                MetricsEngine (per-store + global metrics)             │
│                emits: tick snapshots, events, decisions               │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
                           │ socket.io
┌──────────── Client (React + Vite, TypeScript) ──────────────────────┐
│  Map (Leaflet + OpenStreetMap):                                       │
│    - 15 store icons (colored by load)                                 │
│    - Rider dots (colored by store + status)                           │
│    - Order dots (green=on-time, yellow=at-risk, red=late)            │
│    - Rider routes (polylines, re-drawn on re-allocation)             │
│  Screens: Setup | Live operations (Baseline | Swarm maps) | Results │
│  Results: Naive vs Baseline vs Swarm comparison table + charts      │
│  Scenario buttons + SimControls (play/pause/speed/seed)              │
│  Order drawer → explainability (why this rider? why this store?)    │
└───────────────────────────────────────────────────────────────────┘
```

**Platform: Web app (Vite + React)** for:
- Side-by-side comparison visible on one screen
- Better for showing multi-store map
- Easier to build metrics dashboard in 5 hours
- Responsive to mouse clicks for scenario buttons

---

## 11. Stack

- **Server:** Node.js, Express, TypeScript, Socket.io, `seedrandom` for reproducible RNG
- **Client:** React (Vite), plain `fetch` + `useState`, `react-leaflet` (Leaflet.js), OpenStreetMap tiles, Recharts for metrics
- **Distance/travel:** Pre-computed distance matrix (cached JSON), no live routing API
- **No database:** All state in memory. Optional export to JSON for post-demo analysis.

---

## 12. Tunable Constants

All in `config.ts`:
- `STORES` (locations, inventory)
- `RIDERS_PER_STORE` (6)
- `RIDER_BORROW_KM` (0 = comparison worlds: riders pick up only at their home store)
- `SWARM_BORROW_KM` (3.5) / `SWARM_REPOSITION` (true) — Swarm-only rider pooling
- `W_RIDE` (0.75) / `W_FAIR` (600) / `SAVABLE_FIRST` (true) — cost terms and triage, see §5
- `ORDERS_PER_HOUR` (300; spike = 3×. Calibrated so Baseline isn't saturated: ~66–80% on time)
- `PACK_TIME_SEC` (120)
- `CAPACITY_PER_TRIP` (3–4 orders)
- `GEOFENCE_KM` (3)
- `CANDIDATE_STORES` (3)
- `EPOCH_SEC` (10)
- `REBALANCE_SEC` (60)
- `FREEZE_DIST_KM` (0.3)
- `REASSIGN_MIN_GAIN_SEC` (60)
- `HOLD_SLACK` (240 sec) / `MAX_HOLD` (0 sec: batch-partner holds disabled after Checkpoint 3 tuning; at this order density they cost more than they saved)
- `REBALANCE_MAX_ORDERS` (40)
- `SMART_PACKING` (true) / `SURGE_FORECAST` (true) / `SURGE_MODE` (false) / `SURGE_RATIO` (2) / `SURGE_WINDOW_SEC` (300)
- `FATIGUE_DELIVERIES` (7) / `FATIGUE_WINDOW_SEC` (7200) / `W_FATIGUE` (0.5)
- `RIDER_CANDIDATES_PER_STORE` (10)
- `DEPART_SLACK` (120 sec, measured against projected drop ETA)
- `ETA_RISK_PAD` (1.05) / `CLASSIFY_PAD` (1.15)
- `DECISION_BUDGET_MS` (200)
- `TRAFFIC_MULTIPLIER_PEAK` (1.3)
- `TRAFFIC_MULTIPLIER_MONSOON` (1.5)
- `BASE_SPEED_KMH` (12)
- `ROAD_FACTOR` (1.3)
- `EXPRESS_RADIUS_KM` (~1.2, derived from the above)

---

## 13. Non-Goals

- Real routing engines (OSRM, Google Maps API)
- Customer e-commerce site: login, payments, product browsing, checkout
- Real GPS, inventory-system or live traffic integrations (the simulator generates these events)
- Exact solvers (MILP / exhaustive search) that can't decide within seconds
- ML-based demand forecasting (simple moving average is enough)
- Mobile-first design (web is the medium)

---

## 14. Success Criteria

At the end of 5 hours:
- [ ] Multi-store setup working (orders routed to nearest viable store, stock checked)
- [ ] Naive and Baseline allocators working as comparisons
- [ ] Swarm allocator working (coupled store + rider + route, hard deadlines, freeze-window rebalance)
- [ ] Three screens: Setup, Live operations (side-by-side maps), Results
- [ ] At least 3 scenarios work (monsoon, store offline, surge)
- [ ] Swarm beats both baselines on on-time % and worst-case lateness
- [ ] Decision time per call shown and under 200 ms
- [ ] Demo runs for 90 seconds without restart
