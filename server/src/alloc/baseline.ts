import { DarkStore, Rider, Order, Assignment, DecisionRecord } from '../types';
import { CONFIG } from '../config';
import { selectCandidateStores } from '../sim/store-select';
import { haversineKm } from '../sim/travel';
import { canServe, forecastQueue, planTrip } from './feasibility';

/** Riders with no orders that are free to take a new solo trip. */
export function freeRiders(riders: Rider[]): Rider[] {
  return riders.filter(r => (r.status === 'idle' || r.status === 'returning') && r.assignedOrderIds.length === 0);
}

/** Builds a solo-trip assignment (rider -> store -> customer) with its decision record. */
export function soloAssignment(
  order: Order,
  rider: Rider,
  store: DarkStore,
  readyAt: number,
  now: number,
  weatherMult: number,
  reason: string
): Assignment {
  const drop = [{ orderId: order.id, loc: order.loc, promisedBy: order.promisedBy }];
  const exp = planTrip(rider.loc, now, store, readyAt, drop, weatherMult);
  const pad = planTrip(rider.loc, now, store, readyAt, drop, weatherMult, CONFIG.ETA_RISK_PAD);
  const eta = exp.dropEtas.get(order.id)!;
  const padEta = pad.dropEtas.get(order.id)!;
  const feasible = padEta <= order.promisedBy;

  const chosen = {
    riderId: rider.id,
    storeId: store.id,
    totalCost: eta - now,
    breakdown: {
      travelSec: exp.rideSec,
      insertionSec: exp.rideSec,
      latenessPenalty: Math.max(0, padEta - order.promisedBy),
      loadPenalty: 0,
      packWaitSec: Math.max(0, exp.departAt - exp.pickupEta),
      batchSavingSec: 0,
    },
    eta,
    feasible,
    maxLatenessSec: Math.max(0, padEta - order.promisedBy),
    minSlackSec: order.promisedBy - padEta,
    tripStops: exp.stops,
  };

  const decision: DecisionRecord = {
    decidedAt: now,
    chosen: { ...chosen, tripStops: exp.stops.map(s => ({ ...s, loc: { ...s.loc } })) },
    runnersUp: [],
    reason,
    chosenStore: store.id,
    chosenRider: rider.id,
    storeOptions: [{ storeId: store.id, eta, queueDepth: store.packQueue.length, feasible }],
    riderOptions: [{ riderId: rider.id, insertionTime: exp.rideSec, tripEta: eta, feasible }],
    batchSavingSec: 0,
    rejectedInfeasible: 0,
    decisionMs: 0,
  };

  return {
    orderId: order.id,
    storeId: store.id,
    riderId: rider.id,
    decision,
    newRoute: exp.stops.map(s => ({ ...s, loc: { ...s.loc } })),
  };
}

/** Greedy baseline: FIFO, nearest stocked store in the geofence + nearest free rider, solo trips. */
export function runBaselineAllocation(
  pendingOrders: Order[],
  riders: Rider[],
  stores: DarkStore[],
  orders: Map<string, Order>,
  nowSimTime: number,
  weatherMult: number = 1.0
): Assignment[] {
  const assignments: Assignment[] = [];
  const sortedOrders = [...pendingOrders].sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
  const available = freeRiders(riders);
  const extraQueued = new Map<string, number>();

  for (const order of sortedOrders) {
    if (available.length === 0) break;

    // Nearest stocked store (in the geofence) that has a free rider in its own pool
    const cands = selectCandidateStores(order, stores, orders, nowSimTime, weatherMult, { rank: 'travel', limit: stores.length, extraQueued });
    let store: DarkStore | null = null;
    let idx = -1;
    for (const cs of cands) {
      let minDist = Infinity;
      available.forEach((r, i) => {
        if (!canServe(r, cs.store, stores)) return;
        const d = haversineKm(r.loc, cs.store.loc);
        if (d < minDist || (d === minDist && r.id < available[idx].id)) {
          minDist = d;
          idx = i;
        }
      });
      if (idx !== -1) {
        store = cs.store;
        break;
      }
    }
    if (!store) continue; // every nearby pool is busy: wait for a rider
    const rider = available.splice(idx, 1)[0];

    const extra = extraQueued.get(store.id) ?? 0;
    const readyAt = forecastQueue(store, orders, nowSimTime).nextFinishAt(extra);
    extraQueued.set(store.id, extra + 1);

    assignments.push(
      soloAssignment(order, rider, store, readyAt, nowSimTime, weatherMult,
        `Greedy Baseline: nearest stocked store with a free rider (${store.name}) + its nearest free rider (${rider.id}), solo trip.`)
    );
  }

  return assignments;
}
