// Headless benchmark: runs the same loop as index.ts without sockets and prints Naive vs Baseline vs Swarm.
// Usage: npm run bench -- [simMinutes=60] [events, e.g. "20:monsoon,30:riders_offline"] [seed=42]
import { performance } from 'perf_hooks';
import { CONFIG } from './config';
import { World } from './sim/world';
import { OrderGenerator } from './sim/orderGenerator';
import { ScenarioEngine } from './scenarios';
import { runNaiveAllocation } from './alloc/naive';
import { runBaselineAllocation } from './alloc/baseline';
import { runSwarmAllocation } from './alloc/swarm';
import { classifyOrder } from './alloc/feasibility';
import { Metrics, ScenarioName } from './types';

const SPEED = 30; // sim-seconds per tick, like the UI at 30x
const simMinutes = Number(process.argv[2] ?? 60);
const schedule = (process.argv[3] ?? '')
  .split(',')
  .filter(Boolean)
  .map(s => {
    const [m, n] = s.split(':');
    return { atMin: Number(m), name: n as ScenarioName };
  });
const seed = Number(process.argv[4] ?? CONFIG.DEFAULT_SEED);

function run(): { metrics: Record<string, Metrics>; log: string[] } {
  const start = 19 * 3600;
  const worlds = { naive: new World('naive', start), baseline: new World('baseline', start), swarm: new World('swarm', start) };
  const all = [worlds.naive, worlds.baseline, worlds.swarm];
  const allocators = { naive: runNaiveAllocation, baseline: runBaselineAllocation, swarm: runSwarmAllocation };
  const gen = new OrderGenerator(seed, start);
  const scenarios = new ScenarioEngine(seed);
  const fired = new Set<number>();
  const log: string[] = [];
  let lastEpoch = start;
  let now = start;

  const allocate = (w: World, t: number, wm: number) => {
    const pending = w.getPendingOrders();
    if (!pending.length) return;
    const t0 = performance.now();
    const a = allocators[w.name](pending, w.riders, w.stores, w.ordersMap, t, wm);
    const ms = performance.now() - t0;
    w.metricsEngine.recordDecision(ms);
    w.applyAssignments(a, ms);
  };

  for (let tick = 0; tick < (simMinutes * 60) / SPEED; tick++) {
    now += SPEED;
    schedule.forEach((e, i) => {
      if (fired.has(i) || now - start < e.atMin * 60) return;
      fired.add(i);
      for (const ev of scenarios.triggerScenario(e.name, all, gen, now)) log.push(`[${e.atMin}m] ${ev.message}`);
      allocate(worlds.swarm, now, scenarios.getWeatherMult());
    });
    const wm = scenarios.getWeatherMult();
    const newOrders = gen.step(now, worlds.swarm.stores);
    for (const o of newOrders) classifyOrder(o, worlds.swarm.stores, now, wm);
    if (newOrders.length) all.forEach(w => w.addOrders(newOrders));
    all.forEach(w => w.step(SPEED, now, wm));
    allocate(worlds.naive, now, wm);
    allocate(worlds.baseline, now, wm);
    if (newOrders.length || now - lastEpoch >= CONFIG.EPOCH) {
      lastEpoch = now;
      allocate(worlds.swarm, now, wm);
    }
    all.forEach(w => w.getSnapshot(now, false)); // advances metric history like the live server
    all.forEach(w => w.drainEvents()); // the event feed isn't used headless
  }

  const metrics: Record<string, Metrics> = {};
  for (const w of all) metrics[w.name] = w.getSnapshot(now, false).metrics;
  return { metrics, log };
}

const a = run();
const b = run();
const comparable = (r: typeof a) => JSON.stringify(r.metrics, (k, v) => (k.startsWith('decisionMs') ? undefined : v));

console.log(`seed ${seed}, ${simMinutes} sim-min from 19:00${schedule.length ? '' : ', no disruptions'}`);
a.log.forEach(l => console.log(l));
const rows: [string, keyof Metrics][] = [
  ['on-time %', 'onTimeRate'], ['p90 lateness s', 'p90LatenessSec'], ['max lateness s', 'maxLatenessSec'],
  ['delivered', 'delivered'], ['failed', 'ordersFailed'], ['rejected', 'ordersRejected'], ['late now', 'lateNow'],
  ['avg delivery s', 'avgDeliverySec'], ['p90 delivery s', 'p90DeliverySec'], ['km / order', 'kmPerOrder'],
  ['orders / trip', 'ordersPerTrip'], ['utilization %', 'utilization'], ['queue depth', 'packingQueueDepth'],
  ['decision ms avg', 'decisionMsAvg'], ['decision ms max', 'decisionMsMax'],
];
console.log('metric'.padEnd(18) + ['naive', 'baseline', 'swarm'].map(n => n.padStart(10)).join(''));
for (const [label, key] of rows) {
  console.log(label.padEnd(18) + ['naive', 'baseline', 'swarm'].map(n => String(a.metrics[n][key]).padStart(10)).join(''));
}
console.log(`orders by class: ${JSON.stringify(a.metrics.swarm.ordersByClass)}`);
console.log(`deterministic (same seed twice): ${comparable(a) === comparable(b)}`);
