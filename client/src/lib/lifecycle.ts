import { OrderSnapshot, TickPayload, WorldName, WorldSnapshot } from '../types';

export interface Step {
  key: string;
  label: string;
  at?: number; // sim time it happened (real event time from the simulation)
  state: 'done' | 'now' | 'todo';
}

/** The customer-facing journey of an order, built only from real event times. */
export function lifecycle(o: OrderSnapshot): Step[] {
  const delivered = o.status === 'delivered';
  const out = o.status === 'picked' || delivered;
  const packed = !!o.packedAt || out || (o.status === 'packed');
  const assigned = !!o.assignedAt || o.status !== 'placed';
  const raw: Omit<Step, 'state'>[] = [
    { key: 'placed', label: 'Order placed', at: o.createdAt },
    { key: 'assigned', label: o.handover ? 'Handover rider assigned' : 'Rider assigned', at: assigned ? o.assignedAt : undefined },
    { key: 'packed', label: 'Packed at the store', at: packed ? o.packedAt : undefined },
    { key: 'picked', label: o.handover && !out ? 'Waiting for roadside pickup' : 'Out for delivery', at: out ? o.pickedAt : undefined },
    { key: 'delivered', label: 'Delivered', at: delivered ? o.deliveredAt : undefined },
  ];
  const reached = [true, assigned, packed, out, delivered];
  const lastDone = reached.lastIndexOf(true);
  return raw.map((s, i) => ({ ...s, state: i <= lastDone ? (i === lastDone && !delivered ? 'now' : 'done') : 'todo' }));
}

export const worldData = (tick: TickPayload, w: WorldName): WorldSnapshot =>
  w === 'naive' ? tick.worlds.naive ?? tick.worlds.baseline : tick.worlds[w];

export const findOrder = (tick: TickPayload, w: WorldName, id: string): OrderSnapshot | undefined =>
  worldData(tick, w).orders.find(o => o.id === id);

/** Minutes the order is (or will be) past its promise; negative = early. */
export function slackMin(o: OrderSnapshot, now: number): number {
  const end = o.deliveredAt ?? o.projectedEta ?? now;
  return (o.promisedBy - end) / 60;
}

export function isTerminal(o: OrderSnapshot) {
  return ['delivered', 'cancelled', 'failed', 'rejected'].includes(o.status);
}
