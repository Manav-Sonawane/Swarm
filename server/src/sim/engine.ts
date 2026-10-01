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
  }

  /** Advances every world by one tick. Returns events for the feed (visible worlds only). */
  public tick(dtSimSec: number, now: number): EventPayload[] {
    const events: EventPayload[] = [];
    const weatherMult = this.scenarios.getWeatherMult();
    const swarm = this.worlds.swarm;

    // 1. Shared order stream, classified once so every world gets the same promise (USP 0)
    const newOrders = this.orderGenerator.step(now, swarm.stores);
    for (const o of newOrders) classifyOrder(o, swarm.stores, now, weatherMult);
    if (newOrders.length > 0) {
      this.all.forEach(w => w.addOrders(newOrders));
      events.push({ simTime: now, world: 'all', kind: 'ORDERS_PLACED', message: `📦 ${newOrders.length} new customer order(s) placed across dark stores.` });
      for (const o of newOrders) {
        if (o.status !== 'rejected') continue;
        events.push({ simTime: now, world: 'all', kind: 'ORDER_REJECTED', message: `🚫 ${o.id} rejected: no store within ${CONFIG.GEOFENCE_KM} km has every item in stock.` });
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
    const assignments = allocators[world.name](pending, world.riders, world.stores, world.ordersMap, now, weatherMult);
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

  /** Per-order events from the visible worlds; the headless Naive world's are dropped. */
  private drainWorldEvents(): EventPayload[] {
    this.worlds.naive.drainEvents();
    return [...this.worlds.baseline.drainEvents(), ...this.worlds.swarm.drainEvents()];
  }
}
