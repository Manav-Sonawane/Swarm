// Headless benchmark: runs the same SimEngine as the live server, without sockets, and prints
// Naive vs Baseline vs Swarm.
// Usage: npm run bench -- [simMinutes=60] [events, e.g. "20:monsoon,30:store_offline"] [seed=42]
import { CONFIG } from './config';
import { SimEngine } from './sim/engine';
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
  const engine = new SimEngine(seed, start);
  const fired = new Set<number>();
  const log: string[] = [];
  let now = start;

  for (let tick = 0; tick < (simMinutes * 60) / SPEED; tick++) {
    now += SPEED;
    schedule.forEach((e, i) => {
      if (fired.has(i) || now - start < e.atMin * 60) return;
      fired.add(i);
      for (const ev of engine.trigger(e.name, now)) {
        if (ev.kind.startsWith('SCENARIO')) log.push(`[${e.atMin}m] ${ev.message}`);
      }
    });
    engine.tick(SPEED, now);
    engine.all.forEach(w => w.getSnapshot(now, false)); // advances metric history like the live server
  }

  const metrics: Record<string, Metrics> = {};
  for (const w of engine.all) metrics[w.name] = w.getSnapshot(now, false).metrics;
  return { metrics, log };
}

const a = run();
const b = run();
const comparable = (r: typeof a) => JSON.stringify(r.metrics, (k, v) => (k.startsWith('decisionMs') ? undefined : v));

console.log(`seed ${seed}, ${simMinutes} sim-min from 19:00, ${CONFIG.ORDERS_PER_HOUR} orders/h${schedule.length ? '' : ', no disruptions'}`);
a.log.forEach(l => console.log(l));
const rows: [string, keyof Metrics][] = [
  ['on-time %', 'onTimeRate'], ['p90 lateness s', 'p90LatenessSec'], ['max lateness s', 'maxLatenessSec'],
  ['delivered', 'delivered'], ['failed', 'ordersFailed'], ['rejected', 'ordersRejected'], ['late now', 'lateNow'],
  ['avg delivery s', 'avgDeliverySec'], ['p90 delivery s', 'p90DeliverySec'], ['km / order', 'kmPerOrder'],
  ['orders / trip', 'ordersPerTrip'], ['utilization %', 'utilization'], ['queue depth', 'packingQueueDepth'],
  ['reassignments', 'reassignments'], ['decision ms avg', 'decisionMsAvg'], ['decision ms max', 'decisionMsMax'],
];
console.log('metric'.padEnd(18) + ['naive', 'baseline', 'swarm'].map(n => n.padStart(10)).join(''));
for (const [label, key] of rows) {
  console.log(label.padEnd(18) + ['naive', 'baseline', 'swarm'].map(n => String(a.metrics[n][key]).padStart(10)).join(''));
}
console.log(`orders by class: ${JSON.stringify(a.metrics.swarm.ordersByClass)}`);
console.log(`deterministic (same seed twice): ${comparable(a) === comparable(b)}`);
