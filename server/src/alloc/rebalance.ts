import { DarkStore, Rider, Order, Assignment, CandidateScore } from '../types';
import { CONFIG } from '../config';
import { storeCandidate } from '../sim/store-select';
import { haversineKm } from '../sim/travel';
import { QueueForecast, canServe, forecastQueue } from './feasibility';
import { RiderPlanState, better, evaluateInsertion, fairPenalty } from './insertion';
import { buildDecision } from './swarm';

export interface Move {
  orderId: string;
  fromRiderId: string;
  assignment: Assignment;
  gainSec: number; // expected drop-time improvement
  rescued: boolean; // was projected late, now feasible
}

/**
 * Periodic rebalance with a freeze window (CONTEXT §5 step 8). Reconsiders orders that are assigned
 * but not picked up, most urgent first, and may hand them to another rider of the same store. Never
 * touches a rider at the store, already departed, or within FREEZE_DIST_KM of the store. Moves an order
 * if it saves ≥ REASSIGN_MIN_GAIN_SEC or rescues an order that is projected late; a late order may also
 * move to a still-late but much sooner option. An on-time order is never moved to an option that would
 * make it late. The pickup store never changes (it is the customer's serving store).
 */
export function runRebalance(
  riders: Rider[],
  stores: DarkStore[],
  orders: Map<string, Order>,
  nowSimTime: number,
  weatherMult: number = 1.0
): Move[] {
  const riderById = new Map(riders.map(r => [r.id, r]));
  const storeById = new Map(stores.map(s => [s.id, s]));

  // Working copy of every rider whose trip hasn't departed (same as the allocator's view)
  const states = new Map<string, RiderPlanState>();
  for (const r of riders) {
    if (r.status === 'offline' || r.status === 'off_shift') continue;
    const onTrip = r.assignedOrderIds.map(id => orders.get(id)).filter((o): o is Order => !!o);
    if (onTrip.some(o => o.status === 'picked' || !!o.handoverLoc)) continue;
    states.set(r.id, { rider: r, orderIds: onTrip.map(o => o.id), tripStoreId: onTrip[0]?.storeId, fairPenaltySec: fairPenalty(r, riders) });
  }

  const isFrozen = (r: Rider, store: DarkStore | undefined) =>
    r.status === 'at_store' || !states.has(r.id) || (!!store && haversineKm(r.loc, store.loc) <= CONFIG.FREEZE_DIST_KM);

  const candidates = [...orders.values()]
    .filter(o => (o.status === 'assigned' || o.status === 'packing' || o.status === 'packed') && o.riderId && !o.handoverLoc)
    .filter(o => {
      const r = riderById.get(o.riderId!);
      return !!r && !isFrozen(r, storeById.get(o.storeId!));
    })
    .sort((a, b) => {
      const slackA = a.promisedBy - (a.projectedEta ?? nowSimTime);
      const slackB = b.promisedBy - (b.projectedEta ?? nowSimTime);
      return slackA - slackB || a.id.localeCompare(b.id);
    })
    .slice(0, CONFIG.REBALANCE_MAX_ORDERS);

  const forecasts = new Map<string, QueueForecast>();
  const forecastOf = (s: DarkStore) => {
    let f = forecasts.get(s.id);
    if (!f) forecasts.set(s.id, (f = forecastQueue(s, orders, nowSimTime)));
    return f;
  };

  const moves: Move[] = [];
  for (const order of candidates) {
    const fromId = order.riderId!;
    const curEta = order.projectedEta ?? nowSimTime;
    const curLate = curEta > order.promisedBy;

    const store = storeById.get(order.storeId!)!;
    const fc = forecastOf(store);
    const readyAt = order.status === 'packed' ? nowSimTime : fc.finishAt.get(order.id) ?? fc.nextFinishAt(0);
    const pool = [...states.values()]
      .filter(s => s.rider.id !== fromId && (!s.tripStoreId || s.tripStoreId === store.id) && canServe(s.rider, store))
      .map(s => ({ s, d: haversineKm(s.rider.loc, store.loc) }))
      .sort((a, b) => a.d - b.d || a.s.rider.id.localeCompare(b.s.rider.id))
      .slice(0, CONFIG.RIDER_CANDIDATES_PER_STORE);

    const cands: CandidateScore[] = [];
    for (const { s } of pool) {
      // Infeasible options are kept too (insertion already drops any that would make others late),
      // so an order that can't be saved can still be moved somewhere much less late
      const c = evaluateInsertion(order, s, store, orders, fc, readyAt, nowSimTime, weatherMult);
      if (c) cands.push(c);
    }
    if (cands.length === 0) continue;
    cands.sort((a, b) => (better(a, b) ? -1 : better(b, a) ? 1 : a.riderId.localeCompare(b.riderId)));
    const best = cands[0];

    const gainSec = curEta - best.eta;
    const rescued = curLate && best.feasible;
    if (!best.feasible && !curLate) continue; // never make an on-time order late
    if (gainSec < CONFIG.REASSIGN_MIN_GAIN_SEC && !rescued) continue;

    const storeCands = [storeCandidate(store, order, orders, nowSimTime, weatherMult)];
    const decision = buildDecision(order, best, cands, storeCands, stores, nowSimTime, `Rebalanced from ${fromId}`);
    decision.reason += rescued ? ' Rescues an order that was projected late.' : ` Saves ${Math.round(gainSec)}s.`;
    moves.push({
      orderId: order.id,
      fromRiderId: fromId,
      gainSec,
      rescued,
      assignment: {
        orderId: order.id,
        storeId: best.storeId,
        riderId: best.riderId,
        decision,
        newRoute: (best.tripStops ?? []).map(s => ({ ...s, loc: { ...s.loc } })),
      },
    });

    // Update the working state so later moves in this pass see it
    const from = states.get(fromId);
    if (from) {
      from.orderIds = from.orderIds.filter(id => id !== order.id);
      if (from.orderIds.length === 0) from.tripStoreId = undefined;
    }
    const to = states.get(best.riderId)!;
    to.orderIds.push(order.id);
    to.tripStoreId = best.storeId;
  }

  return moves;
}
