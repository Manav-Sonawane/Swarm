import { DarkStore, Rider, Order, Assignment, DecisionRecord, CandidateScore } from '../types';
import { CONFIG } from '../config';
import { selectCandidateStores, StoreCandidate } from '../sim/store-select';
import { haversineKm } from '../sim/travel';
import { QueueForecast, canServe, forecastQueue } from './feasibility';
import { RiderPlanState, better, evaluateInsertion } from './insertion';

/**
 * Rolling-horizon insertion (CONTEXT §5): for each pending order choose store + rider + drop
 * position together, keep only options that keep every promise on the trip, and assign the most
 * urgent / highest-regret orders first so scarce riders go where they matter most.
 */
export function runSwarmAllocation(
  pendingOrders: Order[],
  riders: Rider[],
  stores: DarkStore[],
  orders: Map<string, Order>,
  nowSimTime: number,
  weatherMult: number = 1.0
): Assignment[] {
  const assignments: Assignment[] = [];

  // Working copy of every rider that can still take orders on its current trip
  const states = new Map<string, RiderPlanState>();
  for (const r of riders) {
    if (r.status === 'offline' || r.assignedOrderIds.length >= r.capacity) continue;
    const onTrip = r.assignedOrderIds.map(id => orders.get(id)).filter((o): o is Order => !!o);
    const departed = onTrip.some(o => o.status === 'picked');
    if (departed) continue;
    states.set(r.id, { rider: r, orderIds: onTrip.map(o => o.id), tripStoreId: onTrip[0]?.storeId });
  }

  const extraQueued = new Map<string, number>(); // orders assigned in this call, not yet in packQueue
  const forecasts = new Map<string, QueueForecast>();
  const forecastOf = (s: DarkStore) => {
    let f = forecasts.get(s.id);
    if (!f) forecasts.set(s.id, (f = forecastQueue(s, orders, nowSimTime)));
    return f;
  };

  const evaluateAt = (order: Order, storeCands: StoreCandidate[], cands: CandidateScore[]) => {
    for (const cs of storeCands) {
      const fc = forecastOf(cs.store);
      const newReadyAt = fc.nextFinishAt(extraQueued.get(cs.store.id) ?? 0);
      const pool = [...states.values()]
        .filter(s => (!s.tripStoreId || s.tripStoreId === cs.store.id) && canServe(s.rider, cs.store, stores))
        .map(s => ({ s, d: haversineKm(s.rider.loc, cs.store.loc) }))
        .sort((a, b) => a.d - b.d || a.s.rider.id.localeCompare(b.s.rider.id))
        .slice(0, CONFIG.RIDER_CANDIDATES_PER_STORE);
      for (const { s } of pool) {
        const c = evaluateInsertion(order, s, cs.store, orders, fc, newReadyAt, nowSimTime, weatherMult);
        if (c) cands.push(c);
      }
    }
  };

  // Best CANDIDATE_STORES first; if none of them keeps the promise, widen to every stocked store in the
  // geofence (like a dispatcher trying the next store over when the nearby pools are busy)
  const evaluate = (order: Order) => {
    const all = selectCandidateStores(order, stores, orders, nowSimTime, weatherMult, { rank: 'eta', extraQueued, limit: stores.length });
    let storeCands = all.slice(0, CONFIG.CANDIDATE_STORES);
    const cands: CandidateScore[] = [];
    evaluateAt(order, storeCands, cands);
    if (!cands.some(c => c.feasible) && all.length > storeCands.length) {
      evaluateAt(order, all.slice(storeCands.length), cands);
      storeCands = all;
    }
    cands.sort((a, b) => (better(a, b) ? -1 : better(b, a) ? 1 : a.riderId.localeCompare(b.riderId)));
    return { cands, storeCands };
  };

  // Pass 1: urgency + regret for ordering
  interface Ctx { order: Order; slack: number; regret: number; atRisk: boolean }
  const ctxs: Ctx[] = [];
  for (const order of pendingOrders) {
    if (order.holdUntil !== undefined && nowSimTime < order.holdUntil) continue;
    const { cands } = evaluate(order);
    if (cands.length === 0) continue;
    const best = cands[0];
    const second = cands[1];
    ctxs.push({
      order,
      slack: best.minSlackSec,
      regret: second ? second.totalCost - best.totalCost : 1e6,
      atRisk: !best.feasible,
    });
  }
  // At-risk orders first: serving them last was tested and roughly doubled worst-case lateness
  ctxs.sort((a, b) => {
    if (a.atRisk !== b.atRisk) return a.atRisk ? -1 : 1;
    if (Math.abs(a.slack - b.slack) > 15) return a.slack - b.slack;
    if (a.regret !== b.regret) return b.regret - a.regret;
    return a.order.id.localeCompare(b.order.id);
  });

  // Pass 2: assign in that order, re-evaluating against the updated working state
  for (const ctx of ctxs) {
    const order = ctx.order;
    const { cands, storeCands } = evaluate(order);
    if (cands.length === 0) continue;
    const best = cands[0];
    const st = states.get(best.riderId);
    if (!st) continue;

    // Delayed commitment: a comfortable solo trip may wait one epoch for a batch partner
    const isSolo = st.orderIds.length === 0;
    if (best.feasible && isSolo && best.minSlackSec > CONFIG.HOLD_SLACK && nowSimTime - order.createdAt < CONFIG.MAX_HOLD) {
      order.holdUntil = nowSimTime + CONFIG.EPOCH;
      continue;
    }

    assignments.push({
      orderId: order.id,
      storeId: best.storeId,
      riderId: best.riderId,
      decision: buildDecision(order, best, cands, storeCands, stores, nowSimTime),
      newRoute: (best.tripStops ?? []).map(s => ({ ...s, loc: { ...s.loc } })),
    });

    st.orderIds.push(order.id);
    st.tripStoreId = best.storeId;
    extraQueued.set(best.storeId, (extraQueued.get(best.storeId) ?? 0) + 1);
  }

  return assignments;
}

export function buildDecision(
  order: Order,
  best: CandidateScore,
  cands: CandidateScore[],
  storeCands: StoreCandidate[],
  stores: DarkStore[],
  now: number,
  prefix: string = 'Swarm'
): DecisionRecord {
  const storeName = stores.find(s => s.id === best.storeId)?.name ?? best.storeId;
  const rejected = cands.filter(c => !c.feasible).length;
  let reason = `${prefix}: ${best.riderId} from ${storeName}. `;
  if (best.breakdown.batchSavingSec > 0) {
    reason += `Batched with ${best.tripStops!.filter(s => s.type === 'drop').length - 1} order(s); saves ${Math.round(best.breakdown.batchSavingSec)}s riding vs solo. `;
  } else {
    reason += 'Solo trip. ';
  }
  if (best.feasible) {
    reason += `Every order on the trip stays on time (min slack ${Math.round(best.minSlackSec)}s, padded ETA). `;
  } else {
    reason += `[AT RISK] No option keeps the promise; chose the least-late (${Math.round(best.maxLatenessSec)}s). `;
  }
  if (rejected > 0) reason += `${rejected} option(s) removed by the deadline filter.`;

  return {
    decidedAt: now,
    chosen: { ...best, tripStops: best.tripStops?.map(s => ({ ...s, loc: { ...s.loc } })) },
    runnersUp: cands.slice(1, 3).map(c => ({ ...c, tripStops: undefined })),
    reason,
    chosenStore: best.storeId,
    chosenRider: best.riderId,
    storeOptions: storeCands.map(cs => ({
      storeId: cs.store.id,
      eta: now + cs.packWaitSec + cs.travelSec,
      queueDepth: cs.queueDepth,
      feasible: cands.some(c => c.storeId === cs.store.id && c.feasible),
    })),
    riderOptions: cands.slice(0, 5).map(c => ({
      riderId: c.riderId,
      insertionTime: c.breakdown.insertionSec,
      tripEta: c.eta,
      feasible: c.feasible,
    })),
    batchSavingSec: best.breakdown.batchSavingSec,
    rejectedInfeasible: rejected,
    decisionMs: 0, // filled in by the caller after timing the whole allocator call
  };
}
