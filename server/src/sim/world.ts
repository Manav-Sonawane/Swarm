import { DarkStore, Rider, Order, Assignment, WorldSnapshot, RiderSnapshot, OrderSnapshot, StoreSnapshot } from '../types';
import { generateSeedStores } from '../seed/stores';
import { generateSeedRiders } from '../seed/riders';
import { travelTimeSec, routeDistanceKm, haversineKm, getTrafficMultiplier } from './travel';
import { MetricsEngine } from '../metrics';
import { CONFIG } from '../config';

export class World {
  public name: 'baseline' | 'swarm';
  public stores: DarkStore[];
  public riders: Rider[];
  public ordersMap: Map<string, Order> = new Map();
  public metricsEngine: MetricsEngine;
  private startSimTime: number;

  constructor(name: 'baseline' | 'swarm', startSimTime: number) {
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
  }

  public addOrders(newOrders: Order[]): void {
    for (const ord of newOrders) {
      // Clone order so each world has isolated state
      const cloned: Order = JSON.parse(JSON.stringify(ord));
      this.ordersMap.set(cloned.id, cloned);
    }
  }

  public getPendingOrders(): Order[] {
    const pending: Order[] = [];
    this.ordersMap.forEach(o => {
      if (o.status === 'placed' || (this.name === 'swarm' && o.status === 'assigned' && !o.riderId)) {
        pending.push(o);
      }
    });
    return pending;
  }

  public applyAssignments(assignments: Assignment[]): void {
    for (const assign of assignments) {
      const order = this.ordersMap.get(assign.orderId);
      const rider = this.riders.find(r => r.id === assign.riderId);
      const store = this.stores.find(s => s.id === assign.storeId);

      if (!order || !rider || !store) continue;

      order.status = 'assigned';
      order.storeId = store.id;
      order.riderId = rider.id;
      order.decision = assign.decision;

      // Add to store pack queue if not already there
      if (!store.packQueue.includes(order.id)) {
        store.packQueue.push(order.id);
      }

      // Add to rider assigned orders if not already there
      if (!rider.assignedOrderIds.includes(order.id)) {
        rider.assignedOrderIds.push(order.id);
      }

      // Update rider route
      rider.route = assign.newRoute;

      if (rider.status === 'idle') {
        rider.status = 'to_store';
      }
    }
  }

  public step(dtSimSec: number, nowSimTime: number, weatherMult: number = 1.0): void {
    if (dtSimSec <= 0) return;

    // 1. Process Packing Queues in Stores
    for (const store of this.stores) {
      if (store.packQueue.length === 0) continue;

      // Pack up to packingSlots orders simultaneously
      const activePackingCount = Math.min(store.packingSlots, store.packQueue.length);
      const packedThisTick: string[] = [];

      for (let i = 0; i < activePackingCount; i++) {
        const orderId = store.packQueue[i];
        const order = this.ordersMap.get(orderId);
        if (order) {
          if (order.status === 'assigned') {
            order.status = 'packing';
          }
          // Decrement remaining pack time effectively by completing packed items
          // Simplified simulation tick for packing:
          // Order finishes packing after packTimeSec
          const elapsed = nowSimTime - (order.decision?.decidedAt || nowSimTime);
          if (elapsed >= store.packTimeSec) {
            order.status = 'packed';
            packedThisTick.push(orderId);
          }
        }
      }

      // Remove packed orders from queue
      for (const pId of packedThisTick) {
        const idx = store.packQueue.indexOf(pId);
        if (idx !== -1) store.packQueue.splice(idx, 1);
      }
    }

    // 2. Process Riders & Movement
    for (const rider of this.riders) {
      if (rider.status === 'offline') continue;

      const isBusy = rider.status !== 'idle';
      if (isBusy) {
        rider.stats.activeSec += dtSimSec;
      }

      if (rider.route.length === 0) {
        if (rider.status !== 'idle' && rider.status !== 'returning') {
          rider.status = 'idle';
        }

        // If idle far from home store, transition to returning
        const homeStore = this.stores.find(s => s.id === rider.homeStoreId);
        if (homeStore && haversineKm(rider.loc, homeStore.loc) > 0.3) {
          rider.status = 'returning';
          const distKm = haversineKm(rider.loc, homeStore.loc);
          const trafficMult = getTrafficMultiplier(nowSimTime);
          const speedKmh = Math.max(5, CONFIG.BASE_SPEED_KMH * trafficMult * weatherMult);
          const moveDistKm = (speedKmh * dtSimSec) / 3600;
          const stepFrac = Math.min(1.0, moveDistKm / Math.max(0.001, distKm));

          rider.loc.lat += (homeStore.loc.lat - rider.loc.lat) * stepFrac;
          rider.loc.lng += (homeStore.loc.lng - rider.loc.lng) * stepFrac;
          rider.stats.km += Math.min(distKm, moveDistKm);

          if (haversineKm(rider.loc, homeStore.loc) <= 0.05) {
            rider.status = 'idle';
          }
        }
        continue;
      }

      // Rider has stops in route
      const nextStop = rider.route[0];
      const distKm = routeDistanceKm(rider.loc, nextStop.loc);
      const trafficMult = getTrafficMultiplier(nowSimTime, rider.homeStoreId);
      const speedKmh = Math.max(5, CONFIG.BASE_SPEED_KMH * trafficMult * weatherMult);
      const maxMoveKm = (speedKmh * dtSimSec) / 3600;

      if (distKm <= maxMoveKm || distKm < 0.02) {
        // Arrived at next stop
        rider.loc = { ...nextStop.loc };
        rider.stats.km += distKm;

        if (nextStop.type === 'pickup') {
          rider.status = 'at_store';
          // Check departure rule
          const assignedOrders = rider.assignedOrderIds
            .map(id => this.ordersMap.get(id))
            .filter((o): o is Order => o !== undefined);

          const allPacked = assignedOrders.every(o => o.status === 'packed' || o.status === 'picked');
          const isFullCapacity = rider.assignedOrderIds.length >= rider.capacity;

          let minSlack = Infinity;
          assignedOrders.forEach(o => {
            const slk = o.promisedBy - nowSimTime;
            if (slk < minSlack) minSlack = slk;
          });

          // Rider departs store if all orders packed AND (capacity full OR min slack < DEPART_SLACK OR baseline world)
          const shouldDepart = allPacked && (this.name === 'baseline' || isFullCapacity || minSlack < CONFIG.DEPART_SLACK);

          if (shouldDepart) {
            rider.status = 'delivering';
            assignedOrders.forEach(o => {
              if (o.status === 'packed' || o.status === 'assigned' || o.status === 'packing') {
                o.status = 'picked';
              }
            });
            // Remove pickup stop
            rider.route.shift();
          }
        } else if (nextStop.type === 'drop') {
          rider.status = 'delivering';
          const order = this.ordersMap.get(nextStop.orderId!);
          if (order) {
            order.status = 'delivered';
            order.deliveredAt = nowSimTime;
            rider.stats.delivered += 1;
          }

          // Remove completed drop order from rider assigned list
          rider.assignedOrderIds = rider.assignedOrderIds.filter(id => id !== nextStop.orderId);
          rider.route.shift();

          if (rider.route.length === 0) {
            rider.status = 'idle';
            this.metricsEngine.incrementCompletedTrips(1);
          }
        }
      } else {
        // Move towards next stop
        const stepFrac = maxMoveKm / distKm;
        rider.loc.lat += (nextStop.loc.lat - rider.loc.lat) * stepFrac;
        rider.loc.lng += (nextStop.loc.lng - rider.loc.lng) * stepFrac;
        rider.stats.km += maxMoveKm;

        if (nextStop.type === 'pickup') {
          rider.status = 'to_store';
        } else {
          rider.status = 'delivering';
        }
      }
    }

    // 3. Update Lateness Status for Active Orders
    this.ordersMap.forEach(order => {
      if (order.status !== 'delivered' && order.status !== 'cancelled') {
        const projectedEta = order.decision?.chosen.eta || (nowSimTime + 600);
        order.isLate = nowSimTime > order.promisedBy || projectedEta > order.promisedBy;
      }
    });
  }

  public getSnapshot(): WorldSnapshot {
    const activeAndRecentOrders: OrderSnapshot[] = [];
    const allOrdersList = Array.from(this.ordersMap.values());

    // Keep active orders + last 30 delivered
    const activeOrders = allOrdersList.filter(o => o.status !== 'delivered' && o.status !== 'cancelled');
    const deliveredOrders = allOrdersList
      .filter(o => o.status === 'delivered')
      .sort((a, b) => (b.deliveredAt || 0) - (a.deliveredAt || 0))
      .slice(0, 30);

    const combinedOrders = [...activeOrders, ...deliveredOrders];

    for (const o of combinedOrders) {
      activeAndRecentOrders.push({
        id: o.id,
        lat: o.loc.lat,
        lng: o.loc.lng,
        status: o.status,
        priority: o.priority,
        isLate: !!o.isLate,
        riderId: o.riderId,
        storeId: o.storeId,
        promisedBy: o.promisedBy,
        createdAt: o.createdAt,
        deliveredAt: o.deliveredAt,
        zoneId: o.zoneId,
      });
    }

    const riderSnapshots: RiderSnapshot[] = this.riders.map(r => {
      const routeLine: [number, number][] = [[r.loc.lat, r.loc.lng]];
      r.route.forEach(st => routeLine.push([st.loc.lat, st.loc.lng]));

      return {
        id: r.id,
        lat: r.loc.lat,
        lng: r.loc.lng,
        status: r.status,
        load: r.assignedOrderIds.length,
        routeLine,
        homeStoreId: r.homeStoreId,
      };
    });

    const storeSnapshots: StoreSnapshot[] = this.stores.map(s => ({
      id: s.id,
      name: s.name,
      lat: s.loc.lat,
      lng: s.loc.lng,
      queue: s.packQueue.length,
    }));

    const metrics = this.metricsEngine.calculateMetrics(
      allOrdersList,
      this.riders,
      this.startSimTime + 10,
      this.startSimTime
    );

    return {
      riders: riderSnapshots,
      orders: activeAndRecentOrders,
      stores: storeSnapshots,
      metrics,
    };
  }
}
