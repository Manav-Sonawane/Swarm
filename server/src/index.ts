import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

import { CONFIG } from './config';
import { SimClock } from './sim/clock';
import { World } from './sim/world';
import { OrderGenerator } from './sim/orderGenerator';
import { ScenarioEngine } from './scenarios';
import { runBaselineAllocation } from './alloc/baseline';
import { runSwarmAllocation } from './alloc/swarm';
import { ScenarioName, TickPayload } from './types';

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
const worldA = new World('baseline', simClock.getSimTime());
const worldB = new World('swarm', simClock.getSimTime());
const orderGenerator = new OrderGenerator(currentSeed, simClock.getSimTime());
const scenarioEngine = new ScenarioEngine();

let lastSwarmEpochSimTime = simClock.getSimTime();

function resetSimulation(seed: number = currentSeed) {
  currentSeed = seed;
  simClock.setSeed(seed);
  simClock.reset();
  const startSimTime = simClock.getSimTime();
  worldA.reset(startSimTime);
  worldB.reset(startSimTime);
  orderGenerator.reset(seed, startSimTime);
  scenarioEngine.reset();
  lastSwarmEpochSimTime = startSimTime;

  io.emit('event', {
    simTime: startSimTime,
    world: 'both',
    kind: 'SYSTEM_RESET',
    message: `🔄 Simulation reset to initial state (Seed: ${seed}).`,
  });
}

// Tick loop running every 1 real second
setInterval(() => {
  const simTime = simClock.getSimTime();
  const isRunning = simClock.isRunning();
  let dtSimSec = 0;

  if (isRunning) {
    dtSimSec = simClock.tick(1.0); // 1 second real time tick
    const nowSimTime = simClock.getSimTime();
    const weatherMult = scenarioEngine.getWeatherMult();

    // 1. Generate Shared Orders
    const newOrders = orderGenerator.step(nowSimTime, worldA.stores);
    if (newOrders.length > 0) {
      worldA.addOrders(newOrders);
      worldB.addOrders(newOrders);

      io.emit('event', {
        simTime: nowSimTime,
        world: 'both',
        kind: 'ORDERS_PLACED',
        message: `📦 ${newOrders.length} new customer order(s) placed across dark stores.`,
      });
    }

    // 2. Step World A (Baseline) & Run Baseline Allocator
    const pendingA = worldA.getPendingOrders();
    const assignmentsA = runBaselineAllocation(pendingA, worldA.riders, worldA.stores, nowSimTime, weatherMult);
    worldA.applyAssignments(assignmentsA);
    worldA.step(dtSimSec, nowSimTime, weatherMult);

    // 3. Step World B (Swarm) & Run Swarm Allocator on Epochs
    worldB.step(dtSimSec, nowSimTime, weatherMult);

    const isEpochTime = nowSimTime - lastSwarmEpochSimTime >= CONFIG.EPOCH;
    if (isEpochTime) {
      lastSwarmEpochSimTime = nowSimTime;
      const pendingB = worldB.getPendingOrders();
      const assignmentsB = runSwarmAllocation(
        pendingB,
        worldB.riders,
        worldB.stores,
        worldB.ordersMap,
        nowSimTime,
        weatherMult
      );
      worldB.applyAssignments(assignmentsB);
    }
  }

  // 4. Emit Tick Snapshots to Socket Clients
  const currentSimTime = simClock.getSimTime();
  const payload: TickPayload = {
    simTime: currentSimTime,
    speed: simClock.getSpeed(),
    running: isRunning,
    seed: simClock.getSeed(),
    activeScenario: scenarioEngine.getActiveScenario(),
    weatherMult: scenarioEngine.getWeatherMult(),
    worlds: {
      baseline: worldA.getSnapshot(currentSimTime),
      swarm: worldB.getSnapshot(currentSimTime),
    },
  };

  io.emit('tick', payload);
}, 1000);

// Socket.io event handlers
io.on('connection', socket => {
  console.log(`[Socket] Client connected: ${socket.id}`);

  const currentSimTime = simClock.getSimTime();
  // Send initial tick state immediately
  socket.emit('tick', {
    simTime: currentSimTime,
    speed: simClock.getSpeed(),
    running: simClock.isRunning(),
    seed: simClock.getSeed(),
    activeScenario: scenarioEngine.getActiveScenario(),
    weatherMult: scenarioEngine.getWeatherMult(),
    worlds: {
      baseline: worldA.getSnapshot(currentSimTime),
      swarm: worldB.getSnapshot(currentSimTime),
    },
  });

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
    const events = scenarioEngine.triggerScenario(
      data.name,
      worldA,
      worldB,
      orderGenerator,
      simClock.getSimTime()
    );

    // Run immediate allocation update for Swarm on scenario disruption
    const nowSimTime = simClock.getSimTime();
    const weatherMult = scenarioEngine.getWeatherMult();
    const pendingB = worldB.getPendingOrders();
    const assignmentsB = runSwarmAllocation(
      pendingB,
      worldB.riders,
      worldB.stores,
      worldB.ordersMap,
      nowSimTime,
      weatherMult
    );
    worldB.applyAssignments(assignmentsB);

    events.forEach(evt => io.emit('event', evt));
  });

  socket.on('disconnect', () => {
    console.log(`[Socket] Client disconnected: ${socket.id}`);
  });
});

// REST Endpoints
app.get('/api/decision/:world/:orderId', (req, res) => {
  const { world, orderId } = req.params;
  const targetWorld = world === 'baseline' ? worldA : worldB;
  const order = targetWorld.ordersMap.get(orderId);

  if (!order || !order.decision) {
    return res.status(404).json({ error: 'Order decision record not found' });
  }

  return res.json(order.decision);
});

app.get('/api/export', (req, res) => {
  const currentSimTime = simClock.getSimTime();
  const snapshotA = worldA.getSnapshot(currentSimTime);
  const snapshotB = worldB.getSnapshot(currentSimTime);

  return res.json({
    simTime: currentSimTime,
    seed: simClock.getSeed(),
    baseline: snapshotA.metrics,
    swarm: snapshotB.metrics,
  });
});

app.get('/api/stores', (req, res) => {
  const currentSimTime = simClock.getSimTime();
  const snapshotA = worldA.getSnapshot(currentSimTime);
  return res.json(snapshotA.stores);
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 SWARM Sim Server running on http://localhost:${PORT}`);
});
