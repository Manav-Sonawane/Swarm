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
import { EventPayload, ScenarioName, WorldName } from '../types';

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

  /** Swarm only: freeze-window rebalance of assigned-but-not-picked orders (CONTEXT §5 step 8). */
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
