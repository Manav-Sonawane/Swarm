import { DarkStore, Rider, Order, Assignment, DecisionRecord, Stop } from '../types';
import { selectCandidateStores } from '../sim/store-select';
import { haversineKm, travelTimeSec } from '../sim/travel';

export function runBaselineAllocation(
  pendingOrders: Order[],
  riders: Rider[],
  stores: DarkStore[],
  nowSimTime: number,
  weatherMult: number = 1.0
): Assignment[] {
  const assignments: Assignment[] = [];

  // Sort FIFO by createdAt
  const sortedOrders = [...pendingOrders].sort((a, b) => a.createdAt - b.createdAt);

  const availableRiders = riders.filter(r => r.status === 'idle' && r.assignedOrderIds.length === 0);

  for (const order of sortedOrders) {
    if (availableRiders.length === 0) break;

    // 1. Select nearest store with full stock
    const candidateStores = selectCandidateStores(order, stores, nowSimTime, weatherMult);
    if (candidateStores.length === 0) continue;

    const chosenStore = candidateStores[0].store;

    // 2. Find nearest idle rider to the store
    let nearestRider: Rider | null = null;
    let minDistance = Infinity;
    let nearestIndex = -1;

    for (let i = 0; i < availableRiders.length; i++) {
      const rider = availableRiders[i];
      const dist = haversineKm(rider.loc, chosenStore.loc);
      if (dist < minDistance) {
        minDistance = dist;
        nearestRider = rider;
        nearestIndex = i;
      }
    }

    if (!nearestRider || nearestIndex === -1) continue;

    // Remove rider from available pool for this tick
    availableRiders.splice(nearestIndex, 1);

    // Compute route timings
    const travelToStoreSec = travelTimeSec(nearestRider.loc, chosenStore.loc, nowSimTime, weatherMult, chosenStore.id);
    const pickupEta = nowSimTime + travelToStoreSec;
    const packWaitSec = (chosenStore.packQueue.length / Math.max(1, chosenStore.packingSlots)) * chosenStore.packTimeSec;
    const storeDeparture = pickupEta + packWaitSec;
    const dropTravelSec = travelTimeSec(chosenStore.loc, order.loc, storeDeparture, weatherMult, chosenStore.id);
    const dropEta = storeDeparture + dropTravelSec;

    const stops: Stop[] = [
      { type: 'pickup', storeId: chosenStore.id, loc: chosenStore.loc, eta: pickupEta },
      { type: 'drop', orderId: order.id, loc: order.loc, eta: dropEta },
    ];

    const isFeasible = dropEta <= order.promisedBy;
    const latenessPenalty = Math.max(0, dropEta - order.promisedBy) * 5.0;

    const decision: DecisionRecord = {
      decidedAt: nowSimTime,
      chosen: {
        riderId: nearestRider.id,
        storeId: chosenStore.id,
        totalCost: travelToStoreSec + dropTravelSec + latenessPenalty,
        breakdown: {
          travelSec: travelToStoreSec + dropTravelSec,
          insertionSec: travelToStoreSec + dropTravelSec,
          latenessPenalty,
          loadPenalty: 0,
          packWaitSec,
          batchSavingSec: 0,
        },
        eta: dropEta,
        feasible: isFeasible,
        tripStops: stops,
      },
      runnersUp: [],
      reason: `Greedy Baseline: Nearest store (${chosenStore.name}) + nearest idle rider (${nearestRider.id})`,
    };

    assignments.push({
      orderId: order.id,
      storeId: chosenStore.id,
      riderId: nearestRider.id,
      decision,
      newRoute: stops,
    });
  }

  return assignments;
}
