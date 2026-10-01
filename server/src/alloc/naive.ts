import { DarkStore, Rider, Order, Assignment } from '../types';
import { haversineKm } from '../sim/travel';
import { forecastQueue, hasStock } from './feasibility';
import { freeRiders, soloAssignment } from './baseline';

/**
 * Comparison allocator (CONTEXT §5): nearest free rider to the customer; the order is packed at
 * that rider's home store, ignoring stock and the packing queue. A missing item = failed delivery.
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

    let idx = -1;
    let minDist = Infinity;
    available.forEach((r, i) => {
      const d = haversineKm(r.loc, order.loc);
      if (d < minDist || (d === minDist && r.id < available[idx].id)) {
        minDist = d;
        idx = i;
      }
    });
    const rider = available[idx];
    const store = stores.find(s => s.id === rider.homeStoreId)!;

    if (!hasStock(store, order)) {
      order.status = 'failed';
      order.failReason = `stock-out at ${store.name}`;
      continue; // rider stays free
    }
    available.splice(idx, 1);

    const extra = extraQueued.get(store.id) ?? 0;
    const readyAt = forecastQueue(store, orders, nowSimTime).nextFinishAt(extra);
    extraQueued.set(store.id, extra + 1);

    assignments.push(
      soloAssignment(order, rider, store, readyAt, nowSimTime, weatherMult,
        `Naive: nearest free rider (${rider.id}) packs at its home store (${store.name}); stock and queue ignored.`)
    );
  }

  return assignments;
}
