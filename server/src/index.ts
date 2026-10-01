import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

import { CONFIG } from './config';
import { SimClock } from './sim/clock';
import { SimEngine } from './sim/engine';
import { ScenarioName, SetupConfig, TickPayload, WorldName } from './types';
import { applySetup, getSetup } from './setup';

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
const engine = new SimEngine(currentSeed, simClock.getSimTime());
const { worlds } = engine;

function buildPayload(): TickPayload {
  const now = simClock.getSimTime();
  return {
    simTime: now,
    speed: simClock.getSpeed(),
    running: simClock.isRunning(),
    seed: simClock.getSeed(),
    activeScenario: engine.scenarios.getActiveScenario(now),
    weatherMult: engine.scenarios.getWeatherMult(),
    worlds: {
      baseline: worlds.baseline.getSnapshot(now),
      swarm: worlds.swarm.getSnapshot(now),
      naive: worlds.naive.getSnapshot(now, true), // full 3rd deliverable approach: riders, orders, stores, metrics
    },
    forecast: engine.forecast(),
    setup: getSetup(),
    stock: engine.stock(),
    trafficJam: engine.scenarios.getTrafficJam(),
  };
}

function resetSimulation(seed: number = currentSeed) {
  currentSeed = seed;
  simClock.setSeed(seed);
  simClock.reset();
  const startSimTime = simClock.getSimTime();
  engine.reset(seed, startSimTime);

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
    for (const evt of engine.tick(dtSimSec, simClock.getSimTime())) io.emit('event', evt);
  }
  io.emit('tick', buildPayload());
}, 1000);

// Socket.io event handlers
io.on('connection', socket => {
  console.log(`[Socket] Client connected: ${socket.id}`);
  socket.emit('tick', buildPayload());

  socket.on('control', (data: { action: 'play' | 'pause' | 'reset'; speed?: number; seed?: number; setup?: Partial<SetupConfig> }) => {
    if (data.action === 'play') {
      simClock.start();
    } else if (data.action === 'pause') {
      simClock.pause();
    } else if (data.action === 'reset') {
      applySetup(data.setup); // Setup screen values take effect on reset
      resetSimulation(data.seed ?? currentSeed);
      io.emit('tick', buildPayload());
    }

    if (data.speed !== undefined) {
      simClock.setSpeed(data.speed);
    }
  });

  socket.on('scenario', (data: { name: ScenarioName }) => {
    // Every world gets the disruption; Swarm re-plans immediately, the comparisons on their next tick
    for (const evt of engine.trigger(data.name, simClock.getSimTime())) io.emit('event', evt);
  });

  // Order composer: quote an address (serving store, promise, stock), then place a cart there
  socket.on('quote', (data: { lat: number; lng: number }, ack?: (r: unknown) => void) => {
    if (typeof ack !== 'function') return;
    const lat = Number(data?.lat), lng = Number(data?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return ack({ ok: false, reason: 'Invalid location.' });
    ack(engine.quote(lat, lng, simClock.getSimTime()));
  });

  socket.on('place_order', (data: { lat: number; lng: number; items: { sku: string; qty: number }[] }, ack?: (r: unknown) => void) => {
    const lat = Number(data?.lat), lng = Number(data?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Array.isArray(data?.items)) {
      if (typeof ack === 'function') ack({ ok: false, reason: 'Invalid order.' });
      return;
    }
    const { result, events } = engine.placeOrder({ lat, lng, items: data.items }, simClock.getSimTime());
    for (const evt of events) io.emit('event', evt);
    if (result.ok) io.emit('tick', buildPayload());
    if (typeof ack === 'function') ack(result);
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

app.get('/api/setup', (req, res) => res.json(getSetup()));

app.get('/api/stores', (req, res) => {
  return res.json(worlds.baseline.getSnapshot(simClock.getSimTime()).stores);
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 SWARM Sim Server running on http://localhost:${PORT}`);
});
