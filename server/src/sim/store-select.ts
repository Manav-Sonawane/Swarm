import { DarkStore, LatLng, Order } from '../types';
import { CONFIG } from '../config';
import { forecastQueue } from '../alloc/feasibility';
import { haversineKm, travelTimeSec } from './travel';

/**
 * Zepto/Blinkit-style serving store: the customer's nearest *online* dark store inside the service
 * radius. The cart only offers items that store has in stock, so there is no stock-based store hopping.
 * Returns null when the address is outside the service area.
 */
export function servingStoreFor(loc: LatLng, stores: DarkStore[], exclude?: Set<string>): DarkStore | null {
  let best: DarkStore | null = null;
  let bestKm = Infinity;
  for (const s of stores) {
    if (s.offline || exclude?.has(s.id)) continue;
    const km = haversineKm(s.loc, loc);
    if (km > CONFIG.GEOFENCE_KM) continue;
    if (km < bestKm || (km === bestKm && best && s.id < best.id)) {
      best = s;
      bestKm = km;
    }
  }
  return best;
}

export interface StoreCandidate {
  store: DarkStore;
  score: number; // packing delay + travel (sec)
  packWaitSec: number; // until a newly queued order would be packed
  travelSec: number; // store -> customer, expected
  queueDepth: number;
}

/** Packing delay and travel time for serving `order` from `store` (shown in the decision record). */
export function storeCandidate(
  store: DarkStore,
  order: Order,
  orders: Map<string, Order>,
  nowSimTime: number,
  weatherMult: number = 1.0,
  extraQueued: number = 0
): StoreCandidate {
  const packWaitSec = forecastQueue(store, orders, nowSimTime).nextFinishAt(extraQueued) - nowSimTime;
  const travelSec = travelTimeSec(store.loc, order.loc, nowSimTime, weatherMult);
  return { store, score: packWaitSec + travelSec, packWaitSec, travelSec, queueDepth: store.packQueue.length + extraQueued };
}
