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

      // Decrement inventory
      for (const item of order.items) {
        if (store.inventory[item.sku] !== undefined) {
          store.inventory[item.sku] = Math.max(0, store.inventory[item.sku] - item.qty);
        }
      }

      // Add to store pack queue if not already there
      if (!store.packQueue.includes(order.id)) {
        store.packQueue.push(order.id);
      }

      // Add to rider assigned orders if not already there
      if (!rider.assignedOrderIds.includes(order.id)) {
        rider.assignedOrderIds.push(order.id);
      }

      // Update rider route (deep copy to preserve decision tripStops)
      rider.route = assign.newRoute.map(s => ({ ...s, loc: { ...s.loc } }));

      if (rider.status === 'idle') {
        rider.status = 'to_store';
      }
    }
  }

  public step(dtSimSec: number, nowSimTime: number, weatherMult: number = 1.0): void {
    if (dtSimSec <= 0) return;

    // 1. Process Packing Queues in Stores (True Queue with packStartedAt)
    for (const store of this.stores) {
      if (store.packQueue.length === 0) continue;

      const activePackingCount = Math.min(store.packingSlots, store.packQueue.length);
      const packedThisTick: string[] = [];

      for (let i = 0; i < activePackingCount; i++) {
        const orderId = store.packQueue[i];
        const order = this.ordersMap.get(orderId);
        if (order) {
          if (order.status === 'assigned') {
            order.status = 'packing';
            order.packStartedAt = nowSimTime;
          }
          if (order.status === 'packing') {
            const elapsed = nowSimTime - (order.packStartedAt ?? nowSimTime);
            if (elapsed >= store.packTimeSec) {
              order.status = 'packed';
              packedThisTick.push(orderId);
            }
          }
        }
      }

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
          const distKm = routeDistanceKm(rider.loc, homeStore.loc);
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
          const assignedOrders = rider.assignedOrderIds
            .map(id => this.ordersMap.get(id))
            .filter((o): o is Order => o !== undefined);

          const allPacked = assignedOrders.every(o => o.status === 'packed' || o.status === 'picked');
          const isFullCapacity = rider.assignedOrderIds.length >= rider.capacity;

          // Walk remaining route from store location to compute projectedDropEta & slack
          let currLoc = rider.loc;
          let currSimTime = nowSimTime;
          let minSlack = Infinity;

          for (let sIdx = 1; sIdx < rider.route.length; sIdx++) {
            const st = rider.route[sIdx];
            const legSec = travelTimeSec(currLoc, st.loc, currSimTime, weatherMult, rider.homeStoreId);
            currSimTime += legSec;
            currLoc = st.loc;
            if (st.type === 'drop' && st.orderId) {
              const ord = this.ordersMap.get(st.orderId);
              if (ord) {
                const dropSlack = ord.promisedBy - currSimTime;
                if (dropSlack < minSlack) minSlack = dropSlack;
              }
            }
          }

          if (minSlack === Infinity && assignedOrders.length > 0) {
            assignedOrders.forEach(o => {
              const slk = o.promisedBy - nowSimTime;
              if (slk < minSlack) minSlack = slk;
            });
          }

          const shouldDepart = allPacked && (this.name === 'baseline' || isFullCapacity || minSlack < CONFIG.DEPART_SLACK || minSlack <= 0);

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
            order.isLate = nowSimTime > order.promisedBy;
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

    // 3. Update Lateness Status for Active Orders accurately
    this.ordersMap.forEach(order => {
      if (order.status === 'delivered') {
        order.isLate = (order.deliveredAt ?? nowSimTime) > order.promisedBy;
      } else if (order.status !== 'cancelled') {
        let projectedEta = nowSimTime + 600;
        if (order.riderId) {
          const rider = this.riders.find(r => r.id === order.riderId);
          if (rider && rider.route.length > 0) {
            let currLoc = rider.loc;
            let currTime = nowSimTime;
            for (const st of rider.route) {
              currTime += travelTimeSec(currLoc, st.loc, currTime, weatherMult, rider.homeStoreId);
              currLoc = st.loc;
              if (st.type === 'drop' && st.orderId === order.id) {
                projectedEta = currTime;
                break;
              }
            }
          }
        } else {
          // Unassigned order: estimate with nearest store
          let nearestDist = Infinity;
          let nearestStore = this.stores[0];
          for (const s of this.stores) {
            const d = haversineKm(s.loc, order.loc);
            if (d < nearestDist) {
              nearestDist = d;
              nearestStore = s;
            }
          }
          const travelSec = travelTimeSec(nearestStore.loc, order.loc, nowSimTime, weatherMult, nearestStore.id);
          projectedEta = nowSimTime + travelSec + nearestStore.packTimeSec;
        }
        order.isLate = nowSimTime > order.promisedBy || projectedEta > order.promisedBy;
      }
    });
  }

  public getSnapshot(nowSimTime: number = this.startSimTime + 10): WorldSnapshot {
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
      nowSimTime,
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
