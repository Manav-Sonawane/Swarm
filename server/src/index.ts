import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { performance } from 'perf_hooks';

import { CONFIG } from './config';
import { SimClock } from './sim/clock';
import { World } from './sim/world';
import { OrderGenerator } from './sim/orderGenerator';
import { ScenarioEngine } from './scenarios';
import { runNaiveAllocation } from './alloc/naive';
import { runBaselineAllocation } from './alloc/baseline';
import { runSwarmAllocation } from './alloc/swarm';
import { classifyOrder } from './alloc/feasibility';
import { ScenarioName, TickPayload, WorldName } from './types';

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

let currentSeed = CONFIG.DEFAULT_SEED;
const simClock = new SimClock(currentSeed);
const worlds: Record<WorldName, World> = {
  naive: new World('naive', simClock.getSimTime()),
  baseline: new World('baseline', simClock.getSimTime()),
  swarm: new World('swarm', simClock.getSimTime()),
};
const allWorlds = [worlds.naive, worlds.baseline, worlds.swarm];
const allocators = {
  naive: runNaiveAllocation,
  baseline: runBaselineAllocation,
  swarm: runSwarmAllocation,
};
const orderGenerator = new OrderGenerator(currentSeed, simClock.getSimTime());
const scenarioEngine = new ScenarioEngine(currentSeed);

let lastSwarmEpochSimTime = simClock.getSimTime();

/** Runs one world's allocator on its pending orders and records the wall-clock decision time. */
function allocate(world: World, nowSimTime: number, weatherMult: number): void {
  const pending = world.getPendingOrders();
  if (pending.length === 0) return;
  const t0 = performance.now();
  const assignments = allocators[world.name](pending, world.riders, world.stores, world.ordersMap, nowSimTime, weatherMult);
  const ms = performance.now() - t0;
  world.metricsEngine.recordDecision(ms);
  world.applyAssignments(assignments, Number(ms.toFixed(2)));
}

/** Forwards per-order events (delivered, delivered late, failed) from the two visible worlds. */
function emitWorldEvents(): void {
  worlds.naive.drainEvents(); // headless world: keep the feed readable
  for (const w of [worlds.baseline, worlds.swarm]) {
    for (const evt of w.drainEvents()) io.emit('event', evt);
  }
}

function buildPayload(): TickPayload {
  const now = simClock.getSimTime();
  return {
    simTime: now,
    speed: simClock.getSpeed(),
    running: simClock.isRunning(),
    seed: simClock.getSeed(),
    activeScenario: scenarioEngine.getActiveScenario(now),
    weatherMult: scenarioEngine.getWeatherMult(),
    worlds: {
      baseline: worlds.baseline.getSnapshot(now),
      swarm: worlds.swarm.getSnapshot(now),
      naive: worlds.naive.getSnapshot(now, false), // headless: metrics only
    },
  };
}

function resetSimulation(seed: number = currentSeed) {
  currentSeed = seed;
  simClock.setSeed(seed);
  simClock.reset();
  const startSimTime = simClock.getSimTime();
  allWorlds.forEach(w => w.reset(startSimTime));
  orderGenerator.reset(seed, startSimTime);
  scenarioEngine.reset(seed);
  lastSwarmEpochSimTime = startSimTime;

  io.emit('event', {
    simTime: startSimTime,
    world: 'all',
    kind: 'SYSTEM_RESET',
    message: `🔄 Simulation reset to initial state (Seed: ${seed}).`,
  });
}

// Tick loop running every 1 real second
setInterval(() => {
  if (simClock.isRunning()) {
    const dtSimSec = simClock.tick(1.0); // 1 second real time tick
    const nowSimTime = simClock.getSimTime();
    const weatherMult = scenarioEngine.getWeatherMult();

    // 1. Shared order stream, classified once so every world gets the same promise (USP 0)
    const newOrders = orderGenerator.step(nowSimTime, worlds.swarm.stores);
    for (const o of newOrders) classifyOrder(o, worlds.swarm.stores, nowSimTime, weatherMult);
    if (newOrders.length > 0) {
      allWorlds.forEach(w => w.addOrders(newOrders));
      io.emit('event', {
        simTime: nowSimTime,
        world: 'all',
        kind: 'ORDERS_PLACED',
        message: `📦 ${newOrders.length} new customer order(s) placed across dark stores.`,
      });
      for (const o of newOrders) {
        if (o.status !== 'rejected') continue;
        io.emit('event', {
          simTime: nowSimTime,
          world: 'all',
          kind: 'ORDER_REJECTED',
          message: `🚫 ${o.id} rejected: no store within ${CONFIG.GEOFENCE_KM} km has every item in stock.`,
        });
      }
    }

    // 2. Move riders, pack, deliver
    allWorlds.forEach(w => w.step(dtSimSec, nowSimTime, weatherMult));
    emitWorldEvents();

    // 3. Allocate: comparisons every tick; Swarm on new orders and every epoch (CONTEXT §5)
    allocate(worlds.naive, nowSimTime, weatherMult);
    allocate(worlds.baseline, nowSimTime, weatherMult);
    if (newOrders.length > 0 || nowSimTime - lastSwarmEpochSimTime >= CONFIG.EPOCH) {
      lastSwarmEpochSimTime = nowSimTime;
      allocate(worlds.swarm, nowSimTime, weatherMult);
    }
  }

  io.emit('tick', buildPayload());
}, 1000);

// Socket.io event handlers
io.on('connection', socket => {
  console.log(`[Socket] Client connected: ${socket.id}`);
  socket.emit('tick', buildPayload());

  socket.on('control', (data: { action: 'play' | 'pause' | 'reset'; speed?: number; seed?: number }) => {
    if (data.action === 'play') {
      simClock.start();
    } else if (data.action === 'pause') {
      simClock.pause();
    } else if (data.action === 'reset') {
      resetSimulation(data.seed ?? currentSeed);
    }

    if (data.speed !== undefined) {
      simClock.setSpeed(data.speed);
    }
  });

  socket.on('scenario', (data: { name: ScenarioName }) => {
    const nowSimTime = simClock.getSimTime();
    const events = scenarioEngine.triggerScenario(data.name, allWorlds, orderGenerator, nowSimTime);

    // Swarm re-plans immediately on a disruption; the comparisons pick up released orders next tick
    allocate(worlds.swarm, nowSimTime, scenarioEngine.getWeatherMult());

    events.forEach(evt => io.emit('event', evt));
    emitWorldEvents(); // e.g. orders failed when a rider went offline mid-delivery
  });

  socket.on('disconnect', () => {
    console.log(`[Socket] Client disconnected: ${socket.id}`);
  });
});

// REST Endpoints
app.get('/api/decision/:world/:orderId', (req, res) => {
  const { world, orderId } = req.params;
  const targetWorld = worlds[world as WorldName];
  const order = targetWorld?.ordersMap.get(orderId);

  if (!order || !order.decision) {
    return res.status(404).json({ error: 'Order decision record not found' });
  }

  return res.json(order.decision);
});

app.get('/api/export', (req, res) => {
  const now = simClock.getSimTime();
  return res.json({
    simTime: now,
    seed: simClock.getSeed(),
    timestamp: new Date().toISOString(),
    naive: worlds.naive.getSnapshot(now, false).metrics,
    baseline: worlds.baseline.getSnapshot(now, false).metrics,
    swarm: worlds.swarm.getSnapshot(now, false).metrics,
  });
});

app.get('/api/stores', (req, res) => {
  return res.json(worlds.baseline.getSnapshot(simClock.getSimTime()).stores);
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 SWARM Sim Server running on http://localhost:${PORT}`);
});
