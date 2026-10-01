import { DarkStore, Rider, Order, Assignment, WorldSnapshot, RiderSnapshot, OrderSnapshot, StoreSnapshot, WorldName, EventPayload } from '../types';
import { generateSeedStores } from '../seed/stores';
import { generateSeedRiders } from '../seed/riders';
import { routeDistanceKm, getTrafficMultiplier, travelTimeSec, haversineKm } from './travel';
import { MetricsEngine } from '../metrics';
import { CONFIG } from '../config';
import { DropSpec, QueueForecast, forecastQueue, hasStock, planTrip } from '../alloc/feasibility';

const TERMINAL = new Set(['delivered', 'cancelled', 'failed', 'rejected']);
export const isTerminal = (o: Order) => TERMINAL.has(o.status);

/** 125 -> "2m 05s" */
export const fmtDur = (sec: number) => {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
};

export class World {
  public name: WorldName;
  public stores: DarkStore[];
  public riders: Rider[];
  public ordersMap: Map<string, Order> = new Map();
  public metricsEngine: MetricsEngine;
  private startSimTime: number;
  private events: EventPayload[] = []; // per-order events since the last drainEvents()

  constructor(name: WorldName, startSimTime: number) {
    this.name = name;
    this.startSimTime = startSimTime;
    this.stores = generateSeedStores();
    this.riders = generateSeedRiders(this.stores);
    this.metricsEngine = new MetricsEngine();
  }

  public reset(startSimTime: number): void {
    this.startSimTime = startSimTime;
    this.stores = generateSeedStores();
    this.riders = generateSeedRiders(this.stores);
    this.ordersMap.clear();
    this.metricsEngine.reset();
    this.events = [];
  }

  /** Returns and clears the per-order events (delivered, delivered late, failed) collected so far. */
  public drainEvents(): EventPayload[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  public addOrders(newOrders: Order[]): void {
    for (const ord of newOrders) {
      // Clone order so each world has isolated state
      const cloned: Order = JSON.parse(JSON.stringify(ord));
      if (CONFIG.BASELINE_PROMISES_10_MIN && this.name !== 'swarm' && cloned.status !== 'rejected') {
        cloned.promisedBy = cloned.createdAt + CONFIG.EXPRESS_PROMISED_SEC;
      }
      this.ordersMap.set(cloned.id, cloned);
    }
  }

  public getPendingOrders(): Order[] {
    const pending: Order[] = [];
    this.ordersMap.forEach(o => {
      if (o.status === 'placed') pending.push(o);
    });
    return pending;
  }

  public applyAssignments(assignments: Assignment[], decisionMs: number = 0): void {
    for (const assign of assignments) {
      const order = this.ordersMap.get(assign.orderId);
      const rider = this.riders.find(r => r.id === assign.riderId);
      const store = this.stores.find(s => s.id === assign.storeId);
      if (!order || !rider || !store || order.status !== 'placed') continue;

      order.status = 'assigned';
      order.storeId = store.id;
      order.riderId = rider.id;
      order.holdUntil = undefined;
      order.decision = { ...assign.decision, decisionMs };

      // Reserve stock (restored if the order is released before pickup)
      for (const item of order.items) {
        if (store.inventory[item.sku] !== undefined) {
          store.inventory[item.sku] = Math.max(0, store.inventory[item.sku] - item.qty);
        }
      }

      if (!store.packQueue.includes(order.id)) store.packQueue.push(order.id);
      if (!rider.assignedOrderIds.includes(order.id)) rider.assignedOrderIds.push(order.id);

      // Own copy: the decision record keeps its trip even as the rider consumes stops
      rider.route = assign.newRoute.map(s => ({ ...s, loc: { ...s.loc } }));
      if (rider.status === 'idle' || rider.status === 'returning') rider.status = 'to_store';
    }
  }

  /** Puts an order back to `placed` and removes it from every queue and trip. */
  public releaseOrder(order: Order): void {
    // Goods not yet picked up go back on the shelf
    const store = this.stores.find(s => s.id === order.storeId);
    if (store && order.status !== 'picked' && order.status !== 'placed') {
      for (const item of order.items) {
        if (store.inventory[item.sku] !== undefined) store.inventory[item.sku] += item.qty;
      }
    }
    for (const s of this.stores) s.packQueue = s.packQueue.filter(id => id !== order.id);
    for (const r of this.riders) {
      if (!r.assignedOrderIds.includes(order.id)) continue;
      r.assignedOrderIds = r.assignedOrderIds.filter(id => id !== order.id);
      r.route = r.route.filter(st => st.orderId !== order.id);
      if (r.assignedOrderIds.length === 0) r.route = [];
    }
    order.status = 'placed';
    order.riderId = undefined;
    order.storeId = undefined;
    order.decision = undefined;
    order.packStartedAt = undefined;
    order.holdUntil = undefined;
  }

  /** Terminal failure (or cancellation): removes the order from queues and trips. */
  public endOrder(order: Order, status: 'failed' | 'cancelled', now: number, reason?: string): void {
    this.releaseOrder(order);
    order.status = status;
    order.failReason = reason;
    if (status === 'failed') {
      this.events.push({ simTime: now, world: this.name, kind: 'ORDER_FAILED', message: `❌ ${order.id} failed${reason ? ': ' + reason : ''}.` });
    }
  }

  public step(dtSimSec: number, nowSimTime: number, weatherMult: number = 1.0): void {
    if (dtSimSec <= 0) return;

    // 1. Packing: FIFO queue, `packingSlots` in parallel, each order takes packTimeSec from when it starts
    for (const store of this.stores) {
      store.packQueue = store.packQueue.filter(id => {
        const o = this.ordersMap.get(id);
        if (!o || (o.status !== 'assigned' && o.status !== 'packing')) return false;
        if (o.status === 'packing' && nowSimTime >= o.packStartedAt! + store.packTimeSec) {
          o.status = 'packed';
          return false;
        }
        return true;
      });
      let packing = store.packQueue.filter(id => this.ordersMap.get(id)!.status === 'packing').length;
      for (const id of store.packQueue) {
        if (packing >= store.packingSlots) break;
        const o = this.ordersMap.get(id)!;
        if (o.status === 'assigned') {
          o.status = 'packing';
          o.packStartedAt = nowSimTime;
          packing++;
        }
      }
    }

    // 2. Riders & movement
    for (const rider of this.riders) {
      if (rider.status === 'offline') continue;
      if (rider.status !== 'idle') rider.stats.activeSec += dtSimSec;

      if (rider.route.length === 0) {
        if (rider.status !== 'idle' && rider.status !== 'returning') rider.status = 'idle';

        const homeStore = this.stores.find(s => s.id === rider.homeStoreId);
        if (homeStore && haversineKm(rider.loc, homeStore.loc) > 0.3) {
          rider.status = 'returning';
          const distKm = routeDistanceKm(rider.loc, homeStore.loc);
          const speedKmh = Math.max(5, CONFIG.BASE_SPEED_KMH * getTrafficMultiplier(nowSimTime) * weatherMult);
          const moveDistKm = (speedKmh * dtSimSec) / 3600;
          const stepFrac = Math.min(1.0, moveDistKm / Math.max(0.001, distKm));
          rider.loc.lat += (homeStore.loc.lat - rider.loc.lat) * stepFrac;
          rider.loc.lng += (homeStore.loc.lng - rider.loc.lng) * stepFrac;
          rider.stats.km += Math.min(distKm, moveDistKm);
          if (haversineKm(rider.loc, homeStore.loc) <= 0.05) rider.status = 'idle';
        }
        continue;
      }

      const nextStop = rider.route[0];
      const distKm = routeDistanceKm(rider.loc, nextStop.loc);
      const speedKmh = Math.max(5, CONFIG.BASE_SPEED_KMH * getTrafficMultiplier(nowSimTime, rider.homeStoreId) * weatherMult);
      const maxMoveKm = (speedKmh * dtSimSec) / 3600;

      if (distKm <= maxMoveKm || distKm < 0.02) {
        rider.loc = { ...nextStop.loc };
        rider.stats.km += distKm;

        if (nextStop.type === 'pickup') {
          rider.status = 'at_store';
          if (this.shouldDepart(rider, nowSimTime, weatherMult)) {
            rider.status = 'delivering';
            rider.readyAtStoreSince = undefined;
            for (const id of rider.assignedOrderIds) {
              const o = this.ordersMap.get(id);
              if (o && o.status === 'packed') o.status = 'picked';
            }
            rider.route.shift();
          }
        } else {
          rider.status = 'delivering';
          const order = this.ordersMap.get(nextStop.orderId!);
          if (order && order.status === 'picked') {
            order.status = 'delivered';
            order.deliveredAt = nowSimTime;
            order.isLate = nowSimTime > order.promisedBy;
            order.projectedEta = nowSimTime;
            rider.stats.delivered += 1;
            const diff = order.promisedBy - nowSimTime;
            this.events.push(
              order.isLate
                ? { simTime: nowSimTime, world: this.name, kind: 'ORDER_DELIVERED_LATE', message: `⏰ ${order.id} delivered ${fmtDur(-diff)} late by ${rider.id} (${order.class}).` }
                : { simTime: nowSimTime, world: this.name, kind: 'ORDER_DELIVERED', message: `✅ ${order.id} delivered on time by ${rider.id}, ${fmtDur(diff)} early (${order.class}).` }
            );
          }
          rider.assignedOrderIds = rider.assignedOrderIds.filter(id => id !== nextStop.orderId);
          rider.route.shift();
          if (rider.route.length === 0) {
            rider.status = 'idle';
            this.metricsEngine.incrementCompletedTrips(1);
          }
        }
      } else {
        const stepFrac = maxMoveKm / distKm;
        rider.loc.lat += (nextStop.loc.lat - rider.loc.lat) * stepFrac;
        rider.loc.lng += (nextStop.loc.lng - rider.loc.lng) * stepFrac;
        rider.stats.km += maxMoveKm;
        rider.status = nextStop.type === 'pickup' ? 'to_store' : 'delivering';
      }
    }

    // 3. Refresh projected ETAs and lateness for every active order
    this.refreshProjections(nowSimTime, weatherMult);
  }

  /**
   * Departure rule (CONTEXT §5 step 10): all orders packed AND (capacity full OR min slack vs the
   * projected *drop* time < DEPART_SLACK). Comparison worlds leave as soon as everything is packed.
   */
  private shouldDepart(rider: Rider, now: number, weatherMult: number): boolean {
    const onTrip = rider.assignedOrderIds
      .map(id => this.ordersMap.get(id))
      .filter((o): o is Order => !!o && !isTerminal(o));
    if (!onTrip.every(o => o.status === 'packed' || o.status === 'picked')) {
      rider.readyAtStoreSince = undefined;
      return false;
    }
    if (this.name !== 'swarm' || onTrip.length >= rider.capacity) return true;

    // Waiting for a batch partner has an opportunity cost: at most MAX_HOLD once everything is packed
    rider.readyAtStoreSince ??= now;
    if (now - rider.readyAtStoreSince >= CONFIG.MAX_HOLD) return true;

    // Risk-padded like every other feasibility check, so a held trip keeps a buffer against disruptions
    const drops = this.dropsOf(rider);
    const plan = planTrip(rider.loc, now, null, now, drops, weatherMult, CONFIG.ETA_RISK_PAD);
    let minSlack = Infinity;
    for (const d of drops) minSlack = Math.min(minSlack, d.promisedBy - plan.dropEtas.get(d.orderId)!);
    return minSlack < CONFIG.DEPART_SLACK;
  }

  private dropsOf(rider: Rider): DropSpec[] {
    const drops: DropSpec[] = [];
    for (const st of rider.route) {
      if (st.type !== 'drop') continue;
      const o = this.ordersMap.get(st.orderId!);
      if (o && !isTerminal(o)) drops.push({ orderId: o.id, loc: o.loc, promisedBy: o.promisedBy });
    }
    return drops;
  }

  private refreshProjections(now: number, weatherMult: number): void {
    const forecasts = new Map<string, QueueForecast>();
    const fc = (s: DarkStore) => {
      let f = forecasts.get(s.id);
      if (!f) forecasts.set(s.id, (f = forecastQueue(s, this.ordersMap, now)));
      return f;
    };
    const projected = new Map<string, number>();

    for (const rider of this.riders) {
      if (rider.status === 'offline' || rider.route.length === 0) continue;
      const drops = this.dropsOf(rider);
      let store: DarkStore | null = null;
      let readyAt = now;
      if (rider.route[0].type === 'pickup') {
        store = this.stores.find(s => s.id === rider.route[0].storeId) ?? null;
        for (const id of rider.assignedOrderIds) {
          const o = this.ordersMap.get(id);
          if (!o || !store || o.status === 'packed' || o.status === 'picked' || isTerminal(o)) continue;
          readyAt = Math.max(readyAt, fc(store).finishAt.get(o.id) ?? fc(store).nextFinishAt(0));
        }
      }
      const plan = planTrip(rider.loc, now, store, readyAt, drops, weatherMult);
      for (const [id, eta] of plan.dropEtas) projected.set(id, eta);
      for (const st of rider.route) {
        st.eta = st.type === 'pickup' ? plan.pickupEta : plan.dropEtas.get(st.orderId!) ?? st.eta;
      }
    }

    this.ordersMap.forEach(order => {
      if (isTerminal(order)) return;
      let eta = projected.get(order.id);
      if (eta === undefined) {
        // Unassigned: best stocked store in the geofence, packing delay + travel
        eta = Infinity;
        for (const s of this.stores) {
          if (haversineKm(s.loc, order.loc) > CONFIG.GEOFENCE_KM || !hasStock(s, order)) continue;
          eta = Math.min(eta, fc(s).nextFinishAt(0) + travelTimeSec(s.loc, order.loc, now, weatherMult));
        }
        if (eta === Infinity) eta = Math.max(now, order.promisedBy) + 1;
      }
      order.projectedEta = eta;
      order.isLate = now > order.promisedBy || eta > order.promisedBy;
    });
  }

  public getSnapshot(nowSimTime: number, full: boolean = true): WorldSnapshot {
    const allOrdersList = Array.from(this.ordersMap.values());
    const metrics = this.metricsEngine.calculateMetrics(allOrdersList, this.riders, this.stores, nowSimTime, this.startSimTime);
    if (!full) return { riders: [], orders: [], stores: [], metrics };

    // Keep active orders + last 30 delivered
    const activeOrders = allOrdersList.filter(o => !isTerminal(o));
    const deliveredOrders = allOrdersList
      .filter(o => o.status === 'delivered')
      .sort((a, b) => (b.deliveredAt || 0) - (a.deliveredAt || 0))
      .slice(0, 30);

    const orders: OrderSnapshot[] = [...activeOrders, ...deliveredOrders].map(o => ({
      id: o.id,
      lat: o.loc.lat,
      lng: o.loc.lng,
      status: o.status,
      priority: o.priority,
      class: o.class,
      isLate: !!o.isLate,
      riderId: o.riderId,
      storeId: o.storeId,
      promisedBy: o.promisedBy,
      projectedEta: o.projectedEta,
      createdAt: o.createdAt,
      deliveredAt: o.deliveredAt,
      zoneId: o.zoneId,
    }));

    const riders: RiderSnapshot[] = this.riders.map(r => ({
      id: r.id,
      lat: r.loc.lat,
      lng: r.loc.lng,
      status: r.status,
      load: r.assignedOrderIds.length,
      routeLine: [[r.loc.lat, r.loc.lng] as [number, number], ...r.route.map(st => [st.loc.lat, st.loc.lng] as [number, number])],
      homeStoreId: r.homeStoreId,
    }));

    const stores: StoreSnapshot[] = this.stores.map(s => ({
      id: s.id,
      name: s.name,
      lat: s.loc.lat,
      lng: s.loc.lng,
      queue: s.packQueue.length,
    }));

    return { riders, orders, stores, metrics };
  }
}
