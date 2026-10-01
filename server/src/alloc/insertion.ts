import { Rider, Order, DarkStore, CandidateScore, Stop, LatLng } from '../types';
import { CONFIG } from '../config';
import { travelTimeSec, routeDistanceKm } from '../sim/travel';

export function getDropPermutations<T>(array: T[]): T[][] {
  if (array.length <= 1) return [array];
  const result: T[][] = [];
  for (let i = 0; i < array.length; i++) {
    const current = array[i];
    const remaining = array.slice(0, i).concat(array.slice(i + 1));
    const subPerms = getDropPermutations(remaining);
    for (const perm of subPerms) {
      result.push([current, ...perm]);
    }
  }
  return result;
}

export function calculateSoloTripCost(
  order: Order,
  rider: Rider,
  store: DarkStore,
  nowSimTime: number,
  weatherMult: number = 1.0
): number {
  const storeLegSec = travelTimeSec(rider.loc, store.loc, nowSimTime, weatherMult, store.id);
  const packWaitSec = (store.packQueue.length / Math.max(1, store.packingSlots)) * store.packTimeSec;
  const dropLegSec = travelTimeSec(store.loc, order.loc, nowSimTime, weatherMult, store.id);
  return storeLegSec + packWaitSec + dropLegSec;
}

export function evaluateInsertion(
  order: Order,
  rider: Rider,
  store: DarkStore,
  existingOrdersMap: Map<string, Order>,
  nowSimTime: number,
  weatherMult: number = 1.0
): CandidateScore | null {
  // Check capacity limit
  if (rider.assignedOrderIds.length >= rider.capacity) {
    return null;
  }

  // Same-store batching constraint: rider must be idle, heading to store, or at store
  // If rider already has assigned orders, they must all be from the same store
  if (rider.assignedOrderIds.length > 0) {
    if (rider.status === 'delivering' || rider.status === 'returning' || rider.status === 'offline') {
      return null;
    }
    // Check home or assigned store match for all existing orders
    for (const oid of rider.assignedOrderIds) {
      const existingOrder = existingOrdersMap.get(oid);
      if (existingOrder && existingOrder.storeId && existingOrder.storeId !== store.id) {
        return null;
      }
    }
  } else {
    // Rider is idle or returning.
    if (rider.status === 'offline') return null;
  }

  // Existing drop locations and orders
  const existingDrops: { orderId: string; loc: LatLng; promisedBy: number }[] = [];
  for (const oid of rider.assignedOrderIds) {
    const o = existingOrdersMap.get(oid);
    if (o && o.status !== 'delivered' && o.status !== 'cancelled') {
      existingDrops.push({ orderId: o.id, loc: o.loc, promisedBy: o.promisedBy });
    }
  }

  const newDrop = { orderId: order.id, loc: order.loc, promisedBy: order.promisedBy };
  const allDropsToSequence = [...existingDrops, newDrop];

  // Calculate current baseline travel time for rider before adding this order
  let currentTripTimeSec = 0;
  if (rider.route.length > 0) {
    let prevLoc = rider.loc;
    for (const s of rider.route) {
      currentTripTimeSec += travelTimeSec(prevLoc, s.loc, nowSimTime, weatherMult);
      prevLoc = s.loc;
    }
  }

  // Calculate time to arrive at store & finish packing
  const travelToStoreSec = travelTimeSec(rider.loc, store.loc, nowSimTime, weatherMult, store.id);
  const pickupEta = nowSimTime + travelToStoreSec;
  const storePackWaitSec = (store.packQueue.length / Math.max(1, store.packingSlots)) * store.packTimeSec;
  const storeDepartureSimTime = pickupEta + storePackWaitSec;

  // Brute-force drop permutations (up to 4 drops, max 24 permutations)
  const dropPerms = getDropPermutations(allDropsToSequence);

  let bestPermScore: CandidateScore | null = null;
  let minCost = Infinity;

  for (const perm of dropPerms) {
    let currTime = storeDepartureSimTime;
    let currLoc = store.loc;
    let totalDropTravelSec = 0;
    let totalLatenessSec = 0;
    let allFeasible = true;

    const stops: Stop[] = [];
    // Store pickup stop
    stops.push({
      type: 'pickup',
      storeId: store.id,
      loc: store.loc,
      eta: pickupEta,
    });

    let targetOrderEta = 0;

    for (const drop of perm) {
      const legSec = travelTimeSec(currLoc, drop.loc, currTime, weatherMult, store.id);
      currTime += legSec;
      totalDropTravelSec += legSec;
      currLoc = drop.loc;

      stops.push({
        type: 'drop',
        orderId: drop.orderId,
        loc: drop.loc,
        eta: currTime,
      });

      if (drop.orderId === order.id) {
        targetOrderEta = currTime;
      }

      const lateness = Math.max(0, currTime - drop.promisedBy);
      if (currTime > drop.promisedBy) {
        allFeasible = false;
      }
      totalLatenessSec += lateness;
    }

    const totalTripSec = travelToStoreSec + storePackWaitSec + totalDropTravelSec;
    const insertionSec = Math.max(0, totalTripSec - currentTripTimeSec);
    const loadPenalty = CONFIG.W_LOAD * rider.assignedOrderIds.length;
    const latenessPenalty = CONFIG.W_LATE * totalLatenessSec;

    const soloCost = calculateSoloTripCost(order, rider, store, nowSimTime, weatherMult);
    const batchSavingSec = Math.max(0, soloCost - insertionSec);

    const totalCost = insertionSec + latenessPenalty + loadPenalty + storePackWaitSec;

    const candidateScore: CandidateScore = {
      riderId: rider.id,
      storeId: store.id,
      totalCost,
      breakdown: {
        travelSec: travelToStoreSec + totalDropTravelSec,
        insertionSec,
        latenessPenalty,
        loadPenalty,
        packWaitSec: storePackWaitSec,
        batchSavingSec,
      },
      eta: targetOrderEta,
      feasible: allFeasible,
      tripStops: stops,
    };

    if (totalCost < minCost) {
      minCost = totalCost;
      bestPermScore = candidateScore;
    }
  }

  return bestPermScore;
}
