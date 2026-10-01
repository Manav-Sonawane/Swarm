import { DarkStore, LatLng, Order, OrderClass, Rider, Stop } from '../types';
import { CONFIG } from '../config';
import { haversineKm, travelTimeSec } from '../sim/travel';

// ---------------------------------------------------------------------------
// Packing queue model
// ---------------------------------------------------------------------------

export interface QueueForecast {
  finishAt: Map<string, number>; // orderId -> projected pack-finish sim-time
  nextFinishAt: (extra: number) => number; // finish time of the (extra+1)-th order appended now
}

/**
 * Simulates the store's FIFO packing queue: orders already packing keep their slot,
 * queued orders take the earliest free slot in order.
 */
export function forecastQueue(store: DarkStore, orders: Map<string, Order>, now: number): QueueForecast {
  const finishAt = new Map<string, number>();
  const slots: number[] = [];

  for (const id of store.packQueue) {
    const o = orders.get(id);
    if (o && o.status === 'packing' && o.packStartedAt !== undefined) {
      const f = Math.max(now, o.packStartedAt + store.packTimeSec);
      finishAt.set(id, f);
      slots.push(f);
    }
  }
  while (slots.length < store.packingSlots) slots.push(now);

  for (const id of store.packQueue) {
    if (finishAt.has(id)) continue;
    slots.sort((a, b) => a - b);
    const f = Math.max(now, slots[0]) + store.packTimeSec;
    slots[0] = f;
    finishAt.set(id, f);
  }

  const nextFinishAt = (extra: number) => {
    const s = [...slots];
    let f = now;
    for (let i = 0; i <= extra; i++) {
      s.sort((a, b) => a - b);
      f = Math.max(now, s[0]) + store.packTimeSec;
      s[0] = f;
    }
    return f;
  };

  return { finishAt, nextFinishAt };
}

/** When will this order be packed and ready for pickup? */
export function packReadyAt(order: Order, store: DarkStore, orders: Map<string, Order>, now: number): number {
  if (order.status === 'packed' || order.status === 'picked') return now;
  const fc = forecastQueue(store, orders, now);
  return fc.finishAt.get(order.id) ?? fc.nextFinishAt(0);
}

// ---------------------------------------------------------------------------
// Trip planning: rider -> store (wait for packing) -> drops in sequence
// ---------------------------------------------------------------------------

export interface DropSpec {
  orderId: string;
  loc: LatLng;
  promisedBy: number;
}

export interface TripPlan {
  pickupEta: number; // arrival at store
  departAt: number; // max(arrival, all orders packed)
  dropEtas: Map<string, number>;
  rideSec: number; // pure riding time (to store + all drops)
  stops: Stop[];
}

/**
 * @param pad travel-time multiplier: 1 for expected times, CONFIG.ETA_RISK_PAD for feasibility checks
 * @param store null when the rider has already left the store (drops only)
 */
export function planTrip(
  from: LatLng,
  now: number,
  store: DarkStore | null,
  readyAt: number,
  drops: DropSpec[],
  weatherMult: number,
  pad = 1
): TripPlan {
  const stops: Stop[] = [];
  let t = now;
  let loc = from;
  let rideSec = 0;
  let pickupEta = now;

  if (store) {
    const leg = travelTimeSec(loc, store.loc, t, weatherMult) * pad;
    rideSec += leg;
    pickupEta = t + leg;
    t = Math.max(pickupEta, readyAt);
    loc = store.loc;
    stops.push({ type: 'pickup', storeId: store.id, loc: { ...store.loc }, eta: pickupEta });
  }
  const departAt = t;

  const dropEtas = new Map<string, number>();
  for (const d of drops) {
    const leg = travelTimeSec(loc, d.loc, t, weatherMult) * pad;
    rideSec += leg;
    t += leg;
    loc = d.loc;
    dropEtas.set(d.orderId, t);
    stops.push({ type: 'drop', orderId: d.orderId, loc: { ...d.loc }, eta: t });
  }

  return { pickupEta, departAt, dropEtas, rideSec, stops };
}

export function permutations<T>(arr: T[]): T[][] {
  if (arr.length <= 1) return [arr];
  const out: T[][] = [];
  arr.forEach((x, i) => {
    for (const p of permutations([...arr.slice(0, i), ...arr.slice(i + 1)])) out.push([x, ...p]);
  });
  return out;
}

// ---------------------------------------------------------------------------
// Order classification (USP 0: feasibility honesty)
// ---------------------------------------------------------------------------

/** Store pools: a rider picks up only at its home store (or nearby stores if RIDER_BORROW_KM > 0). */
export function canServe(rider: Rider, store: DarkStore, stores: DarkStore[]): boolean {
  if (store.offline) return false;
  if (rider.homeStoreId === store.id) return true;
  if (CONFIG.RIDER_BORROW_KM <= 0) return false;
  const home = stores.find(s => s.id === rider.homeStoreId);
  return !!home && haversineKm(home.loc, store.loc) <= CONFIG.RIDER_BORROW_KM;
}

export function hasStock(store: DarkStore, order: Order): boolean {
  return order.items.every(it => (store.inventory[it.sku] ?? 0) >= it.qty);
}

/**
 * Classifies a new order from the nominal ETA of the best stocked store inside the geofence:
 * travel (risk-padded) + one pack time. Sets class, priority and promisedBy, or rejects the order.
 * Runs once on the shared order stream so every world gets the same promise.
 */
export function classifyOrder(order: Order, stores: DarkStore[], now: number, weatherMult: number): void {
  let bestSec = Infinity;
  for (const s of stores) {
    if (s.offline || haversineKm(s.loc, order.loc) > CONFIG.GEOFENCE_KM || !hasStock(s, order)) continue;
    const sec = travelTimeSec(s.loc, order.loc, now, weatherMult) * CONFIG.ETA_RISK_PAD + s.packTimeSec;
    if (sec < bestSec) bestSec = sec;
  }

  let cls: OrderClass;
  let windowSec: number;
  if (bestSec === Infinity) {
    order.class = 'infeasible';
    order.priority = 'regular';
    order.status = 'rejected';
    order.promisedBy = order.createdAt;
    return;
  } else if (bestSec <= CONFIG.EXPRESS_PROMISED_SEC) {
    cls = 'express';
    windowSec = CONFIG.EXPRESS_PROMISED_SEC;
  } else if (bestSec <= CONFIG.REGULAR_PROMISED_SEC) {
    cls = 'regular';
    windowSec = CONFIG.REGULAR_PROMISED_SEC;
  } else {
    cls = 'infeasible';
    windowSec = CONFIG.EXTENDED_PROMISED_SEC;
  }
  order.class = cls;
  order.priority = cls === 'express' ? 'express' : 'regular';
  order.promisedBy = order.createdAt + windowSec;
}
