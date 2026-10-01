import { DarkStore, Order } from '../types';
import { CONFIG } from '../config';
import { haversineKm, travelTimeSec } from './travel';
import { forecastQueue, hasStock } from '../alloc/feasibility';

export interface StoreCandidate {
  store: DarkStore;
  score: number; // packing delay + travel (sec)
  packWaitSec: number; // until a newly queued order would be packed
  travelSec: number; // store -> customer, expected
  queueDepth: number;
}

/**
 * Stores inside the geofence that stock every item, ranked.
 * rank 'eta': packing delay + travel (Swarm, CONTEXT §5 step 1)
 * rank 'travel': nearest only (Baseline)
 */
export function selectCandidateStores(
  order: Order,
  stores: DarkStore[],
  orders: Map<string, Order>,
  nowSimTime: number,
  weatherMult: number = 1.0,
  opts: { rank?: 'eta' | 'travel'; limit?: number; extraQueued?: Map<string, number> } = {}
): StoreCandidate[] {
  const rank = opts.rank ?? 'eta';
  const limit = opts.limit ?? CONFIG.CANDIDATE_STORES;
  const eligible: StoreCandidate[] = [];

  for (const store of stores) {
    if (store.offline) continue;
    if (haversineKm(store.loc, order.loc) > CONFIG.GEOFENCE_KM) continue;
    if (!hasStock(store, order)) continue;

    const extra = opts.extraQueued?.get(store.id) ?? 0;
    const packWaitSec = forecastQueue(store, orders, nowSimTime).nextFinishAt(extra) - nowSimTime;
    const travelSec = travelTimeSec(store.loc, order.loc, nowSimTime, weatherMult);
    eligible.push({
      store,
      score: rank === 'eta' ? packWaitSec + travelSec : travelSec,
      packWaitSec,
      travelSec,
      queueDepth: store.packQueue.length + extra,
    });
  }

  eligible.sort((a, b) => a.score - b.score || a.store.id.localeCompare(b.store.id));
  return eligible.slice(0, limit);
}
