import { DarkStore, Order } from '../types';
import { travelTimeSec } from '../sim/travel';

export interface StoreCandidate {
  store: DarkStore;
  score: number;
  packWaitSec: number;
  travelSec: number;
}

export function selectCandidateStores(
  order: Order,
  stores: DarkStore[],
  nowSimTime: number,
  weatherMult: number = 1.0
): StoreCandidate[] {
  const eligible: StoreCandidate[] = [];

  for (const store of stores) {
    // Check if store has stock for every item in order
    let hasAllStock = true;
    for (const item of order.items) {
      const availableQty = store.inventory[item.sku] ?? 0;
      if (availableQty < item.qty) {
        hasAllStock = false;
        break;
      }
    }

    if (!hasAllStock) continue;

    const packWaitSec = (store.packQueue.length / Math.max(1, store.packingSlots)) * store.packTimeSec;
    const travelSec = travelTimeSec(store.loc, order.loc, nowSimTime, weatherMult, store.id);
    const score = travelSec + packWaitSec;

    eligible.push({
      store,
      score,
      packWaitSec,
      travelSec,
    });
  }

  // Sort by lowest score and keep top 2
  eligible.sort((a, b) => a.score - b.score);
  return eligible.slice(0, 2);
}
