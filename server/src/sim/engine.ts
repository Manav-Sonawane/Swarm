import { performance } from 'perf_hooks';
import { CONFIG } from '../config';
import { World } from './world';
import { OrderGenerator } from './orderGenerator';
import { ScenarioEngine } from '../scenarios';
import { runNaiveAllocation } from '../alloc/naive';
import { runBaselineAllocation } from '../alloc/baseline';
import { runSwarmAllocation } from '../alloc/swarm';
import { runRebalance } from '../alloc/rebalance';
import { classifyOrder } from '../alloc/feasibility';
import { EventPayload, Order, OrderClass, ScenarioName, WorldName } from '../types';
import { isOnLand } from '../seed/land';
import { servingStoreFor } from './store-select';
import { haversineKm } from './travel';

export type QuoteResult =
  | { ok: true; storeId: string; storeName: string; distanceKm: number; class: OrderClass; promiseMin: number; stock: Record<string, number> }
  | { ok: false; reason: string };

export type PlaceResult =
  | { ok: true; orderId: string; storeId: string; storeName: string; class: OrderClass; promiseMin: number; promisedBy: number }
  | { ok: false; reason: string };

const allocators = {
  naive: runNaiveAllocation,
  baseline: runBaselineAllocation,
  swarm: runSwarmAllocation,
};

/**
 * One simulation run: the shared order stream, three worlds (Naive, Baseline, Swarm) and the
 * scenario engine. Used by the live server (index.ts) and the headless benchmark (bench.ts).
 */
export class SimEngine {
  public worlds: Record<WorldName, World>;
  public all: World[];
  public orderGenerator: OrderGenerator;
  public scenarios: ScenarioEngine;
  private lastSwarmEpoch: number;
  private lastRebalance: number;
  private arrivals: number[] = []; // order creation times inside the forecast window
  private surge = false;

  constructor(seed: number, startSimTime: number) {
    this.worlds = {
      naive: new World('naive', startSimTime),
      baseline: new World('baseline', startSimTime),
      swarm: new World('swarm', startSimTime),
    };
    this.all = [this.worlds.naive, this.worlds.baseline, this.worlds.swarm];
    this.orderGenerator = new OrderGenerator(seed, startSimTime);
    this.scenarios = new ScenarioEngine(seed);
    this.lastSwarmEpoch = startSimTime;
    this.lastRebalance = startSimTime;
  }

  public reset(seed: number, startSimTime: number): void {
    this.all.forEach(w => w.reset(startSimTime));
    this.orderGenerator.reset(seed, startSimTime);
    this.scenarios.reset(seed);
    this.lastSwarmEpoch = startSimTime;
    this.lastRebalance = startSimTime;
    this.arrivals = [];
    this.surge = false;
  }

  /** Demand forecast: order rate over the last SURGE_WINDOW_SEC, scaled to orders per hour. */
  public forecast(): { ordersPerHourLast5Min: number; surge: boolean } {
    return { ordersPerHourLast5Min: Math.round(this.arrivals.length * (3600 / CONFIG.SURGE_WINDOW_SEC)), surge: this.surge };
  }

  /**
   * Moving-average forecaster (CONTEXT USP stretch): if the recent order rate is SURGE_RATIO x normal,
   * assume it continues and raise a surge alert. With SURGE_MODE on, Swarm also holds briefly for batch
   * partners and lets riders carry SURGE_CAPACITY orders until the rate falls.
   */
  private updateForecast(now: number): EventPayload[] {
    this.arrivals = this.arrivals.filter(t => t > now - CONFIG.SURGE_WINDOW_SEC);
    const { ordersPerHourLast5Min } = this.forecast();
    const surge = CONFIG.SURGE_FORECAST && ordersPerHourLast5Min >= CONFIG.SURGE_RATIO * CONFIG.ORDERS_PER_HOUR;
    if (surge === this.surge) return [];
    this.surge = surge;

    if (CONFIG.SURGE_MODE) {
      const swarm = this.worlds.swarm;
      swarm.batchHoldSec = surge ? CONFIG.SURGE_HOLD_SEC : CONFIG.MAX_HOLD;
      for (const r of swarm.riders) r.capacity = surge ? CONFIG.SURGE_CAPACITY : CONFIG.CAPACITY;
    }
    return [{
      simTime: now,
      world: 'swarm',
      kind: surge ? 'FORECAST_SURGE' : 'FORECAST_NORMAL',
      message: surge
        ? `📈 Surge forecast: ${ordersPerHourLast5Min} orders/h over the last 5 min (normal ${CONFIG.ORDERS_PER_HOUR}); expect it to continue.` +
          (CONFIG.SURGE_MODE ? ` Swarm batches up to ${CONFIG.SURGE_CAPACITY} per trip and holds ${CONFIG.SURGE_HOLD_SEC}s for partners.` : '')
        : `📉 Demand back to normal (${ordersPerHourLast5Min} orders/h).`,
    }];
  }

  /** Advances every world by one tick. Returns events for the feed (visible worlds only). */
  public tick(dtSimSec: number, now: number): EventPayload[] {
    const events: EventPayload[] = [];
    const weatherMult = this.scenarios.getWeatherMult();
    const swarm = this.worlds.swarm;

    // 1. Shared order stream, classified once so every world gets the same promise (USP 0)
    const newOrders = this.orderGenerator.step(now, swarm.stores);
    for (const o of newOrders) this.arrivals.push(o.createdAt);
    events.push(...this.updateForecast(now));
    for (const o of newOrders) classifyOrder(o, swarm.stores, now, weatherMult);
    if (newOrders.length > 0) {
      this.all.forEach(w => w.addOrders(newOrders));
      events.push({ simTime: now, world: 'all', kind: 'ORDERS_PLACED', message: `📦 ${newOrders.length} new customer order(s) placed across dark stores.` });
      for (const o of newOrders) {
        if (o.status !== 'rejected') continue;
        events.push({ simTime: now, world: 'all', kind: 'ORDER_REJECTED', message: `🚫 ${o.id} rejected: outside the service area (no dark store within ${CONFIG.GEOFENCE_KM} km).` });
      }
    }

    // 2. Move riders, pack, deliver
    this.all.forEach(w => w.step(dtSimSec, now, weatherMult));

    // 3. Allocate: comparisons every tick; Swarm on new orders and every epoch; rebalance periodically
    this.allocate(this.worlds.naive, now, weatherMult);
    this.allocate(this.worlds.baseline, now, weatherMult);
    if (newOrders.length > 0 || now - this.lastSwarmEpoch >= CONFIG.EPOCH) {
      this.lastSwarmEpoch = now;
      this.allocate(swarm, now, weatherMult);
    }
    if (now - this.lastRebalance >= CONFIG.REBALANCE_SEC) {
      this.lastRebalance = now;
      this.rebalance(now, weatherMult);
    }

    return [...events, ...this.drainWorldEvents()];
  }

  /** Applies a disruption to every world; Swarm re-plans immediately (allocate + rebalance). */
  public trigger(name: ScenarioName, now: number): EventPayload[] {
    const events = this.scenarios.triggerScenario(name, this.all, this.orderGenerator, now);
    const weatherMult = this.scenarios.getWeatherMult();
    this.allocate(this.worlds.swarm, now, weatherMult);
    this.rebalance(now, weatherMult);
    this.lastRebalance = now;
    return [...events, ...this.drainWorldEvents()];
  }

  /** Runs one world's allocator on its pending orders and records the wall-clock decision time. */
  private allocate(world: World, now: number, weatherMult: number): void {
    const pending = world.getPendingOrders();
    if (pending.length === 0) return;
    const t0 = performance.now();
    const assignments =
      world.name === 'swarm'
        ? runSwarmAllocation(pending, world.riders, world.stores, world.ordersMap, now, weatherMult, world.batchHoldSec)
        : allocators[world.name](pending, world.riders, world.stores, world.ordersMap, now, weatherMult);
    const ms = performance.now() - t0;
    world.metricsEngine.recordDecision(ms);
    world.applyAssignments(assignments, Number(ms.toFixed(2)));
  }

  /**
   * Swarm only: freeze-window rebalance of assigned-but-not-picked orders (CONTEXT §5 step 8), plus re-sequencing
   * of the remaining drops for riders already out delivering (traffic or weather may have changed the best order).
   */
  private rebalance(now: number, weatherMult: number): void {
    const world = this.worlds.swarm;
    const t0 = performance.now();
    const moves = runRebalance(world.riders, world.stores, world.ordersMap, now, weatherMult);
    const ms = performance.now() - t0;
    world.metricsEngine.recordDecision(ms);
    for (const m of moves) {
      const order = world.ordersMap.get(m.orderId);
      if (order) world.reassignOrder(order, m.assignment, m.gainSec, m.rescued, now, Number(ms.toFixed(2)));
    }
    world.resequenceDeliveries(now, weatherMult);
  }

  /** Shelf stock of the orderable SKUs per store. */
  public stock(): Record<string, Record<string, number>> {
    return this.orderGenerator.stockSnapshot();
  }

  /**
   * What the app would quote for an address: its serving store, the distance and the promise class. Nothing is
   * reserved; the customer then builds a cart from that store's stock.
   */
  public quote(lat: number, lng: number, now: number): QuoteResult {
    const stores = this.worlds.swarm.stores;
    const loc = { lat, lng };
    if (!isOnLand(loc)) return { ok: false, reason: 'That spot is in the sea. Pick an address on land.' };
    const store = servingStoreFor(loc, stores);
    if (!store) return { ok: false, reason: `Outside the service area: no online dark store within ${CONFIG.GEOFENCE_KM} km.` };
    const probe = { id: 'quote', loc, items: [], priority: 'regular', class: 'regular', createdAt: now, promisedBy: now, status: 'placed', servingStoreId: store.id } as Order;
    classifyOrder(probe, stores, now, this.scenarios.getWeatherMult());
    return {
      ok: true,
      storeId: store.id,
      storeName: store.name,
      distanceKm: Number(haversineKm(store.loc, loc).toFixed(2)),
      class: probe.class,
      promiseMin: Math.round((probe.promisedBy - now) / 60),
      stock: this.orderGenerator.stockSnapshot()[store.id] ?? {},
    };
  }

  /** A customer order placed by hand: enters every world, and Swarm assigns it straight away. */
  public placeOrder(req: { lat: number; lng: number; items: { sku: string; qty: number }[] }, now: number): { result: PlaceResult; events: EventPayload[] } {
    const swarm = this.worlds.swarm;
    const made = this.orderGenerator.createManualOrder(req, now, swarm.stores);
    if ('error' in made) return { result: { ok: false, reason: made.error }, events: [] };
    const o = made.order;
    const weatherMult = this.scenarios.getWeatherMult();
    classifyOrder(o, swarm.stores, now, weatherMult);
    this.arrivals.push(o.createdAt);
    this.all.forEach(w => w.addOrders([o]));
    this.allocate(swarm, now, weatherMult);
    const store = swarm.stores.find(s => s.id === o.servingStoreId)!;
    const promiseMin = Math.round((o.promisedBy - now) / 60);
    const events: EventPayload[] = [
      { simTime: now, world: 'all', kind: 'ORDER_PLACED', message: `🛒 ${o.id} placed from the dashboard: ${o.items.reduce((a, i) => a + i.qty, 0)} item(s) from ${store.name}, promised in ${promiseMin} min (${o.class}).` },
      ...this.drainWorldEvents(),
    ];
    return {
      result: { ok: true, orderId: o.id, storeId: store.id, storeName: store.name, class: o.class, promiseMin, promisedBy: o.promisedBy },
      events,
    };
  }

  /** Per-order events from all three visible worlds (Naive, Baseline, Swarm). */
  private drainWorldEvents(): EventPayload[] {
    return [
      ...this.worlds.naive.drainEvents(),
      ...this.worlds.baseline.drainEvents(),
      ...this.worlds.swarm.drainEvents(),
    ];
  }
}
