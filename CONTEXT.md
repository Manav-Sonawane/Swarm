# CONTEXT.md — Kairos (Multi-Store Edition)

> CSI TSEC 4.0 Hackathon, Problem Statement: **The Last Mile Problem**
> **Kairos** = "the right moment" (Greek). Deciding when to commit, extend, or reject—not just which rider.

---

## 1. The Real Problem (Chembur Reality)

**What the customer sees:**
- Dark store 2 km away
- App shows routing distance: 8 km
- Promised delivery: 10 minutes
- Actual delivery: 15–20 minutes (because Mumbai traffic, building elevator, customer not home)
- Order is late. Rider blamed. System broken.

**What Kairos does:**
- Accepts the reality: 2 km = 15–20 min minimum
- 10-min delivery is **only feasible within ~1.2 km**
- Beyond that: offer 20-min delivery (regular) or reject
- Don't promise what you can't keep
- Don't martyr riders with impossible SLAs

**Multi-store difference:**
- Not one store serving everyone
- 5–6 dark stores spread across Mumbai, 2.5 km apart
- Each store has its own rider pool (12–15 riders per store)
- When a customer orders, the system picks the **nearest viable store + most available rider**
- If the nearest store is overloaded, send to the next-nearest
- If all stores would miss the promise, extend the window upfront

---

## 2. The Setup (Chembur-Inspired, Realistic)

**Dark Stores** (5–6 locations, 2.5 km apart):
1. Andheri W (19.1364, 72.8296)
2. Bandra W (19.0596, 72.8295)
3. Powai (19.1176, 72.9060)
4. Lower Parel (18.9953, 72.8300)
5. Chembur (19.0449, 72.8842)
6. Ghatkopar (19.0860, 72.9081)

**Per store:**
- Inventory: 40 SKUs (uneven distribution, e.g., Chembur has more instant noodles, Bandra has premium brands)
- Packing capacity: 2–3 orders simultaneously (~2 min per order)
- Packing queue: visible, prioritized by urgency

**Per store, rider pool:**
- 12–15 gig riders
- Capacity: 3–4 orders per trip
- Status: idle, en route, at store, delivering, returning, offline
- Shift: 6 AM–11 PM (overlapping, busier during peaks)

**Demand:**
- 200–400 orders per peak hour, distributed across 6 stores
- Order density uneven by time and location
- Example: 6–9 AM morning commute in business districts (Bandra, Lower Parel); 6–9 PM in residential (Andheri, Chembur)

---

## 3. The Realistic Travel Model

**The formula (no black-box routing):**

```
distance_km = haversine(store, customer)  // straight line × 1.4 (road factor)
base_eta_min = (distance_km / 6) * 60    // 6 km/h = realistic Mumbai speed
traffic_multiplier = 1.0 (normal) → 1.3 (peak 8–11, 18–21) → 1.5 (monsoon)
elevator_delay_sec = 0–60 (if high-rise)

total_eta_sec = (base_eta_min * 60 * traffic_multiplier) + elevator_delay_sec
```

**Examples (Chembur store):**
- 0.5 km away → 5 min base, 6–7 min with traffic
- 1 km away → 10 min base, 13 min with traffic
- 2 km away → 20 min base, 26 min with traffic (matches your reality)
- 2.5 km away → 25 min base, 33 min with traffic

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

## 5. Allocation Algorithm (Per Store)

### **Input:** Orders to allocate, riders available

### **Step 1: Order Triage**
- Separate into express (tight slack) and regular (relaxed slack)
- Express: process first, dispatch aggressively (solo if needed)
- Regular: buffer and batch (max 4 per batch)

### **Step 2: Packing Queue Prioritization**
Orders waiting to be packed are re-ordered:
- **Primary:** By slack (urgent first)
- **Secondary:** By zone (batch nearby drops together)

Packers see a queue like: `[Versova_Urgent, Versova_Relaxed, Juhu_Urgent, ...]`

### **Step 3: Allocation**

**For express orders (tight):**
- Slack < 1 min? Dispatch immediately to nearest available rider. Solo trip.
- Slack >= 1 min? Hold in buffer.

**For regular orders (relaxed):**
- Buffer up to 4 orders
- When buffer fills or oldest order's slack hits 1 min:
  - **Global bipartite matching:** find the assignment of (orders, riders) that minimizes max delivery time
  - Simplest: greedy with lookahead (sort by slack + regret, assign best first)
  - Optimal: Hungarian algorithm (if time permits)

**For each (order, rider) assignment:**
- Build the rider's new trip: store → pickup → [drop sequence] → return to store
- Optimize drop order: try all permutations (3–4 drops = 6–24 combos), pick fastest
- Check feasibility: every order in the trip still meets its deadline?
  - Feasible → assign
  - Infeasible → pull the order back, mark as at-risk

### **Step 4: Rider Departure**
A rider leaves the store when:
- All orders in their trip are packed, AND
- (Capacity is full OR min slack on the trip < 120 seconds)

---

## 6. Five Core USPs

### **USP 0: Feasibility Honesty** (Foundation)
- Don't promise 10 min if it's actually 20 min
- Classify orders upfront as express/regular/infeasible
- Show it on the UI: green (promise-able), yellow (extended), red (rejected)
- **Why:** Judges see product thinking. You're not blaming riders; you're being honest with customers.

### **USP 1: Packing Queue Intelligence**
- Orders in queue are prioritized by slack (urgency) + zone (batching)
- Packers batch by destination so nearby drops go together
- Live metric: queue depth (Baseline explodes to 20+, Kairos stays at 5–8)

### **USP 2: Multi-Rider Global Matching** (Per Store)
- Don't assign orders one-by-one to riders
- Instead: match multiple orders to multiple riders simultaneously
- Minimize max delivery time (no rider martyred)
- Ensures fairness and on-time delivery

### **USP 3: Demand Forecasting**
- If last 5 minutes had 3× normal order rate, predict next 5 minutes will too
- Alert packers: "Surge incoming, increase batch size"
- Proactively size rider dispatch (send 4 orders instead of 3)

### **USP 4: Rider Fatigue Routing** (Per Store)
- Track deliveries per rider (per shift)
- As a rider approaches fatigue (7+ deliveries in 2 hours), assign shorter trips or nearby zones
- Live fairness metric: std-dev of deliveries per rider (lower = fairer)

### **USP 5: Real-Time Adaptation on Disruption**
- Monsoon? ETAs jump 50% → extend promise windows, re-calculate feasibility
- Store goes offline? Release all its pending orders, re-assign to next-nearest store
- Rider offline? Re-allocate their orders to available riders
- Traffic surge? Re-route remaining drops, notify customers of new ETAs

---

## 7. Seed Data (Realistic)

**6 dark stores** in Mumbai area, 2.5 km apart:
- Each has 40 SKUs
- Inventory is uneven (some stores have surplus, others low)
- Packing rate: 2 min per order

**Rider pool per store:** 12–15 riders
- Total: ~80 riders across all stores
- Shifts: overlapping (peak hours have more riders)
- Capacity: 3–4 orders per trip

**Order stream** (seeded for reproducibility):
- Poisson arrivals, 200–400 orders/hour during peak
- Spatially distributed: weighted by zone population
- Item mix varies by store and time
- Some orders are express, some regular
- 5% of orders are infeasible for express window

**Disruptions** (on button press):
- Monsoon: traffic multiplier 1.5×, ETAs jump 50%
- Store offline: one store goes down, orders reroute
- Rider offline: random rider goes down mid-trip
- Power outage in zone: some customers unreachable
- Demand spike: 3× order rate for 5 minutes

---

## 8. Metrics (Per Store + Global)

**Per-store:**
- On-time rate (%)
- Avg delivery time (min)
- P90 delivery time (min)
- Packing queue depth (orders)
- Orders per trip (batching rate)
- Rider utilization (active time / shift time)
- Fairness std-dev (std-dev of deliveries per rider)
- Orders feasible / regular / infeasible

**Global:**
- Total on-time rate (weighted across stores)
- Total riders active
- Total orders delivered
- Peak queue depth (across all stores)

**Comparison:** Baseline vs Kairos side by side

---

## 9. The Demo (Web App, 90 seconds)

### **Setup:**
- Map showing 6 stores + 80 riders + live orders
- Baseline allocator (left side), Kairos allocator (right side)
- Same seed, same orders, same disruptions

### **Flow:**
1. **Normal evening:** Orders arrive, both worlds allocate. Kairos batches more, has lower queue.
2. **Customer places order 2 km away:**
   - Baseline: "10-min delivery!"
   - Kairos: "This is a 20-min order. Accept?" (shows feasibility upfront)
3. **Press monsoon button:**
   - Both worlds' ETAs jump
   - Baseline: on-time rate drops from 95% → 80%
   - Kairos: recalculates, extends promises, batches more, stays at 92%
4. **Press "store offline":**
   - Baseline: that store's orders pile up
   - Kairos: immediately reroutes orders to nearest store, re-allocates riders
5. **Final scoreboard:** Kairos wins on on-time %, on-at-risk count, queue depth, fairness

### **Key moment:** Click a late order in Baseline, then the same order in Kairos. Show the explainability: why Baseline sent a solo rider (greedy), why Kairos batched it (global matching).

---

## 10. Architecture

```
┌─────────── Server (Node + Express + Socket.io, TypeScript) ───────────┐
│                                                                        │
│  SimClock ──tick──► World (multi-store state)                         │
│      │              OrderGenerator (seeded Poisson, shared)           │
│      │              BaselineAllocator (per store)                     │
│      │              KairosAllocator (per store + global coordination) │
│      └──► ScenarioEngine (monsoon, offline, surge, etc.)             │
│                MetricsEngine (per-store + global metrics)             │
│                emits: tick snapshots, events, decisions               │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
                           │ socket.io
┌──────────── Client (React + Vite, TypeScript) ──────────────────────┐
│  Map (Leaflet + OpenStreetMap):                                       │
│    - 6 store icons (colored by load)                                  │
│    - Rider dots (colored by store + status)                           │
│    - Order dots (green=on-time, yellow=at-risk, red=late)            │
│    - Rider routes (polylines, re-drawn on re-allocation)             │
│  Split layout: Baseline | Kairos                                      │
│  Metrics panel: per-store cards + global comparison                  │
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
- `RIDERS_PER_STORE` (12–15)
- `PACK_TIME_SEC` (120)
- `CAPACITY_PER_TRIP` (3–4 orders)
- `SLACK_THRESHOLD_EXPRESS` (60 sec)
- `SLACK_THRESHOLD_REGULAR` (120 sec)
- `BUFFER_SIZE_MAX` (4 orders)
- `DEPOT_RETURN_THRESHOLD` (min slack to leave store = 120 sec)
- `TRAFFIC_MULTIPLIER_PEAK` (1.3)
- `TRAFFIC_MULTIPLIER_MONSOON` (1.5)
- `BASE_SPEED_KMH` (6)

---

## 13. Non-Goals

- Real routing engines (OSRM, Google Maps API)
- Customer-facing app, payments, auth
- ML-based demand forecasting (simple moving average is enough)
- Mobile-first design (web is the medium)

---

## 14. Success Criteria

At the end of 5 hours:
- [ ] Multi-store setup working (orders routed to nearest viable store)
- [ ] Baseline allocator working (greedy, no optimization)
- [ ] Kairos allocator working (global matching, packing queue smarts)
- [ ] Web UI shows both side by side, map visible, metrics live
- [ ] At least 3 scenarios work (monsoon, store offline, surge)
- [ ] Kairos visibly beats Baseline on on-time % and queue depth
- [ ] Demo runs for 90 seconds without restart
