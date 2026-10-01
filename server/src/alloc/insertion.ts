import { Rider, Order, DarkStore, CandidateScore } from '../types';
import { CONFIG } from '../config';
import { travelTimeSec } from '../sim/travel';
import { DropSpec, QueueForecast, TripPlan, permutations, planTrip } from './feasibility';

/** A rider's trip as the allocator sees it during one call (includes orders assigned earlier in the same call). */
export interface RiderPlanState {
  rider: Rider;
  orderIds: string[]; // undelivered orders on the trip
  tripStoreId?: string; // store every order on the trip is picked up from
}

/**
 * Inserts `order` into the rider's trip at `store`, trying every drop sequence (CONTEXT §5 steps 3–5).
 * Feasible = every order on the trip meets its promise under the risk-padded ETA. Existing orders
 * that were already projected late may not get later.
 */
export function evaluateInsertion(
  order: Order,
  st: RiderPlanState,
  store: DarkStore,
  orders: Map<string, Order>,
  forecast: QueueForecast,
  newReadyAt: number,
  nowSimTime: number,
  weatherMult: number
): CandidateScore | null {
  const rider = st.rider;
  if (rider.status === 'offline') return null;
  if (st.orderIds.length >= rider.capacity) return null;
  if (st.tripStoreId && st.tripStoreId !== store.id) return null; // one pickup store per trip

  const existing: DropSpec[] = [];
  let readyAt = newReadyAt;
  for (const oid of st.orderIds) {
    const o = orders.get(oid);
    if (!o || o.status === 'delivered' || o.status === 'cancelled' || o.status === 'failed') continue;
    existing.push({ orderId: o.id, loc: o.loc, promisedBy: o.promisedBy });
    const r = o.status === 'packed' || o.status === 'picked' ? nowSimTime : forecast.finishAt.get(o.id) ?? newReadyAt;
    readyAt = Math.max(readyAt, r);
  }

  // Current trip without the new order (best sequence), for delay + insertion cost
  let oldExp: TripPlan | null = null;
  let oldPad: TripPlan | null = null;
  if (existing.length > 0) {
    for (const p of permutations(existing)) {
      const e = planTrip(rider.loc, nowSimTime, store, readyAt, p, weatherMult);
      if (!oldExp || e.rideSec < oldExp.rideSec) {
        oldExp = e;
        oldPad = planTrip(rider.loc, nowSimTime, store, readyAt, p, weatherMult, CONFIG.ETA_RISK_PAD);
      }
    }
  }

  const newDrop: DropSpec = { orderId: order.id, loc: order.loc, promisedBy: order.promisedBy };
  const load = existing.length;
  let best: CandidateScore | null = null;

  for (const perm of permutations([...existing, newDrop])) {
    const exp = planTrip(rider.loc, nowSimTime, store, readyAt, perm, weatherMult);
    const pad = planTrip(rider.loc, nowSimTime, store, readyAt, perm, weatherMult, CONFIG.ETA_RISK_PAD);

    let feasible = true;
    let breaksOthers = false;
    let maxLateness = 0;
    let minSlack = Infinity;
    let delayToOthers = 0;
    for (const d of perm) {
      const padEta = pad.dropEtas.get(d.orderId)!;
      const allowed = d.orderId === order.id ? d.promisedBy : Math.max(d.promisedBy, oldPad?.dropEtas.get(d.orderId) ?? d.promisedBy);
      if (padEta > allowed) {
        feasible = false;
        if (d.orderId !== order.id) breaksOthers = true;
      }
      maxLateness = Math.max(maxLateness, padEta - d.promisedBy);
      minSlack = Math.min(minSlack, d.promisedBy - padEta);
      if (d.orderId !== order.id && oldExp) {
        delayToOthers += Math.max(0, exp.dropEtas.get(d.orderId)! - oldExp.dropEtas.get(d.orderId)!);
      }
    }
    // Never rescue one order by making orders already on the trip late (lateness would cascade under load)
    if (breaksOthers) continue;

    const eta = exp.dropEtas.get(order.id)!;
    const loadPenalty = CONFIG.W_LOAD * load;
    // Insertion cost: the new customer's wait + extra wait imposed on customers already on the trip
    const totalCost = (eta - nowSimTime) + delayToOthers + loadPenalty;
    const insertionSec = exp.rideSec - (oldExp?.rideSec ?? 0);
    const soloRideSec =
      travelTimeSec(rider.loc, store.loc, nowSimTime, weatherMult) + travelTimeSec(store.loc, order.loc, nowSimTime, weatherMult);

    const cand: CandidateScore = {
      riderId: rider.id,
      storeId: store.id,
      totalCost,
      breakdown: {
        travelSec: exp.rideSec,
        insertionSec,
        latenessPenalty: Math.max(0, maxLateness),
        loadPenalty,
        packWaitSec: Math.max(0, exp.departAt - exp.pickupEta),
        batchSavingSec: load > 0 ? Math.max(0, soloRideSec - insertionSec) : 0,
      },
      eta,
      feasible,
      maxLatenessSec: Math.max(0, maxLateness),
      minSlackSec: minSlack,
      tripStops: exp.stops,
    };

    if (!best || better(cand, best)) best = cand;
  }

  return best;
}

/** Feasible beats infeasible; among feasible lower cost (tie: more slack); among infeasible lower worst lateness. */
export function better(a: CandidateScore, b: CandidateScore): boolean {
  if (a.feasible !== b.feasible) return a.feasible;
  if (a.feasible) {
    if (Math.abs(a.totalCost - b.totalCost) > 1e-6) return a.totalCost < b.totalCost;
    return a.minSlackSec > b.minSlackSec;
  }
  if (Math.abs(a.maxLatenessSec - b.maxLatenessSec) > 1e-6) return a.maxLatenessSec < b.maxLatenessSec;
  return a.totalCost < b.totalCost;
}
