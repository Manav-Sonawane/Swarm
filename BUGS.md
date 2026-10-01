# BUGS.md — Fix before continuing the implementation plan

> These are bugs in the code we took from the prototype. Fix the **P0** items (IMPLEMENTATION.md Phase 1) before starting Phase 2: until they are fixed, the Baseline vs Swarm comparison isn't meaningful.
> Found by reading the code and by running the server headless (seed 42, 30× speed, ~20–25 sim-minutes from 19:00).

**Evidence run (before any fixes):**

| World | Delivered | On-time | Pending | Late now | Metric history points | Utilization |
|---|---|---|---|---|---|---|
| Baseline | 22 | 77.3% | 49 | 36 | 1 | 100% |
| Swarm | 4 | **0%** | 67 | 48 | 1 | 100% |

Swarm, the "smart" allocator, currently loses badly to Baseline. Bugs 1–2 and 5 are the main causes.

## Status (2026-10-01, after Phase 1 + Phase 2 Person A)

Line numbers below refer to the code *before* the fixes. Several fixes started in commit `4307167` (Aryan) and were folded into the Phase 2 rewrite.

| # | Status | Where it's fixed now |
|---|---|---|
| 1 | ✅ Fixed | `world.ts` `shouldDepart`: slack vs projected drop ETA (risk-padded), plus a `MAX_HOLD` cap on waiting at the store |
| 2 | ✅ Fixed | `feasibility.ts` `classifyOrder`: class + promise from the best stocked store in the geofence, once on the shared stream |
| 3 | ✅ Fixed | `getSnapshot(now)`; history grows, utilization < 100% |
| 4 | ✅ Fixed | `world.ts` packing loop with `packStartedAt`; `forecastQueue` models the queue for ETAs |
| 5 | ✅ Fixed | `world.ts` `refreshProjections`: unassigned = packing delay + travel from best stocked store |
| 6 | ✅ Fixed | `scenarios.ts`: seeded, same riders in every world; released orders leave every queue; picked orders → `failed` |
| 7 | ✅ Fixed | `insertion.ts` / `swarm.ts`: `tripStoreId` on the working rider state |
| 8 | ✅ Fixed | Routes and decision stops are copied, never shared |
| 9 | ✅ Fixed | ETAs and `isLate` refreshed every tick; delivered orders get final `isLate` |
| 10 | ✅ Fixed | `ScenarioEngine.reset(seed)`; active scenario derived from weather + spike end time; `seed ?? current` |
| 11 | ✅ Fixed | Seeded pick of order IDs unpicked in every world |
| 12 | ✅ Fixed | Returning riders use the road factor |
| 13 | ✅ Fixed | Stock reserved on assignment, restored if released before pickup |
| 14 | ✅ Fixed | Scoreboard sign + "Equal" (commit `4307167`) |
| 15 | ✅ Fixed | Mock data has 15 stores (commit `4307167`) |

Also fixed while verifying: **orders per trip** counted in-progress trips (it read < 1); **on-time %** now counts every order whose outcome is decided (delivered, failed, or undelivered past its promise). Counting only deliveries rewarded leaving late orders undelivered.

**After fixes** (`npm run bench`, seed 42, 60 sim-min from 19:00):

| Scenario | Naive | Baseline | Swarm | Swarm max lateness vs Baseline |
|---|---|---|---|---|
| No disruptions | 64.6% | 75.2% | **84.1%** | 566 s vs 966 s |
| Spike @35m | 50.5% | 59.6% | **63.0%** | 689 s vs 966 s |
| Riders offline @30m + cancel @40m | 63.3% | 74.8% | **83.2%** | 566 s vs 966 s |
| Monsoon @20m | 53.9% | **53.9%** | 50.0% | 1256 s vs 1536 s |
| All four | 40.3% | **45.6%** | 43.5% | 1286 s vs 1566 s |

Decision time: Swarm avg ~0.5 ms, max ~8–10 ms headless (~19 ms first call live, JIT warm-up), against a 200 ms budget. Same seed twice gives identical results.

**Open:** under the monsoon Swarm is ~3–4 points behind Baseline on on-time %, though better on worst lateness. Late orders are mostly ones already planned or in flight when travel times jump 50%. Re-planning undeparted trips on a disruption is the Phase 3 rebalance (`rebalance.ts`), so this is left for Checkpoint 3.

---

## P0 — Breaks the demo or makes the metrics wrong

### 1. Swarm riders wait at the store until orders are guaranteed late
- **Where:** `server/src/sim/world.ts:177-182`
- **What:** The departure rule computes slack as `promisedBy - now`. It ignores the ride still ahead. A rider holding for a batch leaves only when an order has <120 s left, but the drop is several minutes away, so every held order is late. In the run, 31 riders were sitting `at_store` with 34 orders already `packed`.
- **Fix:** Use `slack = promisedBy - projectedDropEta`. Walk the rider's remaining route from the store, using `travelTimeSec`, to get each drop's ETA. Depart when `min(slack) < DEPART_SLACK`. Also depart if any order's slack is already negative.

### 2. Promises ignore distance, so most express orders are impossible from the moment they're placed
- **Where:** `server/src/sim/orderGenerator.ts:66-80`, `server/src/config.ts:10-11`
- **What:** 30% of orders are randomly express (10 min), the rest regular (**15 min**, not the planned 20). Customers are placed 0.5–3.2 km from a store. With the new travel model (12 km/h, ×1.3 at peak, and the sim starts at 19:00, which is peak), express only works within ~0.95 km and a 15-min promise within ~1.5 km. Most orders are late before anyone touches them, in both worlds.
- **Fix (minimal version of `feasibility.ts`):** After choosing the nearest store, set the class from the ETA: ≤10 min → express (promise 600 s), ≤20 min → regular (promise 1200 s), otherwise infeasible (reject, or promise 30 min, and count it separately). Set `REGULAR_PROMISED_SEC` to 1200. Both worlds must get the same order stream; only Baseline should keep "promise 10 min to everyone" if we want the honesty contrast from CONTEXT §9.

### 3. Metrics clock is frozen: the chart never moves and utilization is always 100%
- **Where:** `server/src/sim/world.ts:292` (`getSnapshot`)
- **What:** `calculateMetrics(..., this.startSimTime + 10, this.startSimTime)` passes a constant instead of the current sim time. History only appends when `now - lastT >= 10`, so it holds **1 point** forever. Utilization divides by 10 s, so it is capped at 100%.
- **Fix:** Pass the real `nowSimTime` into `getSnapshot(nowSimTime)` from `index.ts`, and on to `calculateMetrics`.

### 4. Packing isn't a queue: orders finish packing instantly once they reach a slot
- **Where:** `server/src/sim/world.ts:103`
- **What:** Packing completes when `now - decision.decidedAt >= packTimeSec`. That's time since *assignment*, not since packing *started*. Orders waiting behind the 2 slots accumulate "elapsed" time and finish the instant they get a slot. Queue depth stays ~0–1 in both worlds (max queue 1 / 0 in the run), so USP 1 and the queue-depth metric are meaningless.
- **Fix:** Store `packStartedAt` when an order enters a slot (`assigned → packing`) and complete at `packStartedAt + packTimeSec`.

### 5. "Late / at-risk" is inflated for every unassigned order
- **Where:** `server/src/sim/world.ts:230-231`
- **What:** If an order has no decision yet, its projected ETA defaults to `now + 600`. Any unassigned order with <10 min to its promise is flagged late, and an express order is flagged late 1 second after creation. This inflates `lateNow` and paints the map red.
- **Fix:** For unassigned orders, estimate with `now + travel(nearest store → customer) + packTime`. Separately, refresh the ETA for assigned orders (see #9).

### 6. Rider-offline scenario loses orders permanently
- **Where:** `server/src/scenarios.ts:59-88`, `server/src/sim/world.ts:120`
- **What:**
  - (a) Released orders go back to `placed` but **stay in the old store's `packQueue`**. The packing loop then marks them `packed` (old `decidedAt`), and `getPendingOrders` only picks up `placed`, so they're never re-assigned or delivered.
  - (b) Orders already `picked` stay on the offline rider. Offline riders are skipped in `step()`, so those orders are stuck forever.
  - (c) It uses `Math.random()`, so the two worlds lose *different* riders and runs aren't reproducible.
- **Fix:**
  - (a) Remove released orders from every `packQueue` and clear `decision`.
  - (b) For picked orders: mark them failed, or move them to the nearest available rider.
  - (c) Pick the riders with a seeded RNG, and pick the **same rider IDs** in both worlds.

---

## P1 — Wrong behaviour that will confuse the demo or explainability

### 7. Swarm can batch orders from two different stores into one trip
- **Where:** `server/src/alloc/insertion.ts:53`, `server/src/alloc/swarm.ts:186`
- **What:** The same-store check reads `existingOrdersMap.get(firstOrderId).storeId`. For an order assigned earlier *in the same epoch*, `storeId` isn't set yet; it only gets set in `applyAssignments`. So the check is skipped. A rider can be given order A (store X) and order B (store Y); the final route only picks up at store Y, yet still delivers A.
- **Fix:** In `swarm.ts`, track the chosen store per cloned rider (e.g. `tempStoreId`) and check against that. Alternatively, set `order.storeId` on a working copy when assigning.

### 8. Explainability route gets erased as the rider moves
- **Where:** `server/src/sim/world.ts:74`, `server/src/alloc/baseline.ts:91`, `server/src/alloc/swarm.ts:182`
- **What:** `rider.route` and `decision.chosen.tripStops` are the **same array**. `world.step()` calls `route.shift()`, so the stored decision's trip empties out. In the run, `GET /api/decision/swarm/ord-0010` returned `tripStops: []`.
- **Fix:** Copy the stops when applying an assignment: `rider.route = assign.newRoute.map(s => ({ ...s, loc: { ...s.loc } }))`.

### 9. Projected ETA is never updated after assignment
- **Where:** `server/src/sim/world.ts:230`
- **What:** `isLate` uses `decision.chosen.eta` from assignment time. Waiting at the store, re-batching, monsoon and rider loss don't change it. Delivered orders also keep whatever `isLate` they had last, so the map can show a late delivery as green.
- **Fix:** Recompute each assigned order's ETA from the rider's current route every tick (or every epoch). On delivery, set `isLate = deliveredAt > promisedBy`.

### 10. Scenario state survives a reset, and the "spike" badge never clears
- **Where:** `server/src/index.ts:36` (`resetSimulation`), `server/src/scenarios.ts:26`
- **What:**
  - `resetSimulation` doesn't reset the `ScenarioEngine`, so monsoon stays on after Reset and seed-42 runs aren't reproducible.
  - `activeScenario` stays `'spike'` (and others) forever, even after the 10-min spike ends.
  - Also, `data.seed || currentSeed` ignores seed `0`.
- **Fix:**
  - Add `scenarioEngine.reset()` (weather 1.0, scenario `normal`) and call it in `resetSimulation`.
  - Derive the spike badge from `orderGenerator` state.
  - Use `data.seed ?? currentSeed`.

### 11. Cancel burst cancels different orders in each world
- **Where:** `server/src/scenarios.ts:115-136`
- **What:** Each world cancels the first 10% of *its own* active orders, so the two worlds stop having the same order stream.
- **Fix:** Choose the order IDs once (seeded, from orders that exist in both worlds) and cancel the same IDs in both.

---

## P2 — Small inconsistencies (fix when touching the file)

| # | Where | Issue | Fix |
|---|---|---|---|
| 12 | `world.ts:134-136` | Riders returning to their store use straight-line distance (no 1.3 road factor), so returns are 30% faster than other legs | Use `routeDistanceKm` like the other legs |
| 13 | `seed/stores.ts`, `store-select.ts:23` | Inventory is never decremented, so stock only changes via the stockout scenario | Decrement on assignment (restore if released) |
| 14 | `FinalScoreboardModal.tsx:68,110,154` | Negative deltas render as `+-5.0%`; typo "Equivalenced" | Format the sign properly; use "Equal" |
| 15 | `client/src/mock/mockStream.ts` | Mock data still has the old 5 stores | Update to the 15 stores in CONTEXT §2 |

---

## Not bugs (tracked in IMPLEMENTATION.md, not here)

Contract alignment (snapshot field names, `/api/stores`, scenario names like `store_offline`), the Naive comparison world (`naive.ts`), freeze-window rebalance (`rebalance.ts`), risk-padded ETAs (`ETA_RISK_PAD`), the Setup and Results screens, slack + zone packing order (`packing.ts`), fatigue routing, demand forecasting, and synced map pan/zoom.

## Measurements to add while fixing

These are needed to verify the fixes and are part of the contract (IMPLEMENTATION.md `Metrics`). Add them in `metrics.ts` as you touch it:
- **Decision time:** wrap every allocator call with `performance.now()`; report `decisionMsAvg` / `decisionMsMax` (budget: 200 ms per call).
- **Worst-case lateness:** `p90LatenessSec` and `maxLatenessSec` over delivered orders (lateness = `max(0, deliveredAt − promisedBy)`).
- **Failed deliveries:** `ordersFailed` (stranded, stock-out, cancelled by the system).
- **Km travelled:** `kmTotal` alongside the existing `kmPerOrder`.
- **Reassignments:** `reassignments` counter. It stays 0 until `rebalance.ts` exists, but the field should be there.

## Done when

On seed 42, from a fresh reset, at 30× for ~20 sim-minutes:
- The metrics history grows (more than 1 point) and utilization is below 100%.
- Packing queue depth is non-zero under load.
- No order stays in `packed` or `picked` for longer than its trip should take.
- Swarm on-time % ≥ Baseline on-time %, **and** Swarm max lateness ≤ Baseline max lateness.
- `decisionMsMax` < 200 ms for every allocator.
- After a rider-offline event, every released order ends up delivered or counted in `ordersFailed`, with none stuck.
- Running the same seed twice gives the same numbers, including after a scenario is triggered.
