import { DarkStore, Rider, Order, Assignment } from '../types';
import { haversineKm } from '../sim/travel';
import { forecastQueue } from './feasibility';
import { freeRiders, soloAssignment } from './baseline';

/**
 * Comparison allocator (CONTEXT §5): the nearest free rider to the customer, from any store's pool
 * (rider pools and the packing queue ignored). The rider rides to the serving store first, so it often
 * covers a long way before even picking up. Solo trips, FIFO.
 */
export function runNaiveAllocation(
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
    const store = stores.find(s => s.id === order.servingStoreId);
    if (!store || store.offline) continue;

    let idx = -1;
    let minDist = Infinity;
    available.forEach((r, i) => {
      const d = haversineKm(r.loc, order.loc);
      if (d < minDist || (d === minDist && idx !== -1 && r.id < available[idx].id)) {
        minDist = d;
        idx = i;
      }
    });
    const rider = available.splice(idx, 1)[0];

    const extra = extraQueued.get(store.id) ?? 0;
    const readyAt = forecastQueue(store, orders, nowSimTime).nextFinishAt(extra);
    extraQueued.set(store.id, extra + 1);

    assignments.push(
      soloAssignment(order, rider, store, readyAt, nowSimTime, weatherMult,
        `Naive: nearest free rider in the city (${rider.id}), pools ignored; rides to ${store.name} first.`)
    );
  }

  return assignments;
}
