import { DarkStore, Order, Rider } from '../types';

/**
 * Packing queue intelligence (CONTEXT §5, USP 2): orders already packing keep their slot; the rest
 * are grouped by the trip they ride on (a rider's batch = one zone run) and the most urgent trip is
 * packed first, so a batch finishes together and the rider isn't left waiting on its last order.
 * Urgency = smallest slack (promisedBy − projected ETA) in the group. Ties fall back to FIFO.
 * The comparison worlds keep plain FIFO.
 */
export function orderPackingQueue(store: DarkStore, orders: Map<string, Order>, riders: Rider[], now: number): void {
  const fifo = new Map(store.packQueue.map((id, i) => [id, i]));
  const packing = store.packQueue.filter(id => orders.get(id)?.status === 'packing');
  const queued = store.packQueue.filter(id => orders.get(id)?.status !== 'packing');
  if (queued.length < 2) return;

  const tripOf = new Map<string, string>(); // orderId -> riderId
  for (const r of riders) for (const id of r.assignedOrderIds) tripOf.set(id, r.id);
  const slack = (id: string) => {
    const o = orders.get(id)!;
    return o.promisedBy - (o.projectedEta ?? now);
  };

  const groups = new Map<string, string[]>();
  for (const id of queued) {
    const key = tripOf.get(id) ?? id;
    groups.set(key, [...(groups.get(key) ?? []), id]);
  }
  const ranked = [...groups.values()]
    .map(ids => {
      const minSlack = Math.min(...ids.map(slack));
      return {
        ids: ids.sort((a, b) => slack(a) - slack(b) || fifo.get(a)! - fifo.get(b)!),
        // Savable trips first, tightest first; trips already projected late go after them (FIFO)
        urgency: minSlack >= 0 ? minSlack : Number.MAX_SAFE_INTEGER,
        first: Math.min(...ids.map(id => fifo.get(id)!)),
      };
    })
    .sort((a, b) => a.urgency - b.urgency || a.first - b.first);

  store.packQueue = [...packing, ...ranked.flatMap(g => g.ids)];
}
