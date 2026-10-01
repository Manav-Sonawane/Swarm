import React, { useEffect, useState } from 'react';
import { socket } from './socket';
import { TickPayload, EventPayload, ScenarioName, OrderSnapshot } from './types';
import { getMockTickPayload } from './mock/mockStream';
import { Header } from './components/Header';
import { SimControls } from './components/SimControls';
import { ScenarioBar } from './components/ScenarioBar';
import { MapView } from './components/MapView';
import { MetricsPanel } from './components/MetricsPanel';
import { OrderDrawer } from './components/OrderDrawer';
import { EventLog } from './components/EventLog';
import { OrderLedger } from './components/OrderLedger';
import { FinalScoreboardModal } from './components/FinalScoreboardModal';
import { PitchDeckModal } from './components/PitchDeckModal';
import { AtmosphericBackground } from './components/AtmosphericBackground';
import { Map as MapIcon } from 'lucide-react';

const App: React.FC = () => {
  const [tickData, setTickData] = useState<TickPayload>(getMockTickPayload());
  const [events, setEvents] = useState<EventPayload[]>([]);
  const [connected, setConnected] = useState<boolean>(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedWorld, setSelectedWorld] = useState<'naive' | 'baseline' | 'swarm'>('swarm');
  const [mapLayout, setMapLayout] = useState<'dual_baseline' | '3way' | 'dual_naive' | 'single'>('dual_baseline');
  const [singleFocusWorld, setSingleFocusWorld] = useState<'naive' | 'baseline' | 'swarm'>('swarm');
  const [scoreboardOpen, setScoreboardOpen] = useState<boolean>(false);
  const [pitchDeckOpen, setPitchDeckOpen] = useState<boolean>(false);

  useEffect(() => {
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onTick = (data: TickPayload) => setTickData(data);
    const onEvent = (evt: EventPayload) => setEvents(prev => [...prev.slice(-99), evt]);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('tick', onTick);
    socket.on('event', onEvent);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('tick', onTick);
      socket.off('event', onEvent);
    };
  }, []);

  const handleSimControl = (action: 'play' | 'pause' | 'reset', speed?: number, seed?: number) => {
    socket.emit('control', { action, speed, seed });
  };

  const handleTriggerScenario = (name: ScenarioName) => {
    socket.emit('scenario', { name });
  };

  const handleSelectOrder = (orderId: string, world: 'naive' | 'baseline' | 'swarm') => {
    setSelectedOrderId(orderId);
    setSelectedWorld(world);
  };

  const handleExport = () => {
    fetch('/api/export').then(r => r.json()).then(data => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `swarm_export_seed_${tickData.seed}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  // Safe fallback for naive world snapshot
  const naiveWorld = tickData.worlds.naive || {
    riders: tickData.worlds.baseline.riders,
    orders: tickData.worlds.baseline.orders,
    stores: tickData.worlds.baseline.stores,
    metrics: tickData.worlds.baseline.metrics,
  };

  const targetWorldSnapshot = selectedWorld === 'naive'
    ? naiveWorld
    : tickData.worlds[selectedWorld];

  const selectedOrderObj: OrderSnapshot | null = selectedOrderId
    ? targetWorldSnapshot.orders.find((o: OrderSnapshot) => o.id === selectedOrderId) || null
    : null;

  return (
    <div className="intelligence-root min-h-screen relative overflow-x-hidden bg-[#03020a] text-slate-100 font-sans">
      {/* Scroll-reactive Atmospheric Background */}
      <AtmosphericBackground />

      <Header
        connected={connected}
        simTime={tickData.simTime}
        seed={tickData.seed}
        activeScenario={tickData.activeScenario}
        weatherMult={tickData.weatherMult}
        onOpenScoreboard={() => setScoreboardOpen(true)}
        onOpenPitchDeck={() => setPitchDeckOpen(true)}
      />

      <main className="relative z-10 flex-1 max-w-[1700px] w-full mx-auto px-4 sm:px-6 pb-8 space-y-4">
        <SimControls
          running={tickData.running}
          speed={tickData.speed}
          seed={tickData.seed}
          onControl={handleSimControl}
          onExport={handleExport}
        />
        <ScenarioBar
          activeScenario={tickData.activeScenario}
          onTriggerScenario={handleTriggerScenario}
        />

        {/* Map Layout Toolbar & Large Map View */}
        <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 glass-medium px-5 py-3 rounded-2xl border border-white/10 shadow-glass-sm relative overflow-hidden">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
                <MapIcon className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <span className="text-[0.8rem] font-bold text-slate-200 tracking-[-0.01em]"
                    style={{ fontFamily: 'var(--font-primary)' }}>
                Live Mumbai Digital Twin Maps
              </span>
              <span className="text-[10px] font-mono text-slate-500 hidden sm:inline">3 Deliverable Approaches</span>
            </div>

            <div className="flex items-center space-x-2 flex-wrap gap-1.5">
              <div className="flex bg-black/40 p-1 rounded-xl border border-white/10 text-[11px] font-mono">
                <button
                  onClick={() => setMapLayout('dual_baseline')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    mapLayout === 'dual_baseline'
                      ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white font-bold shadow-[0_0_12px_rgba(139,92,246,0.5)] border border-violet-400/40'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                  }`}
                >
                  Baseline vs Swarm
                </button>
                <button
                  onClick={() => setMapLayout('3way')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    mapLayout === '3way'
                      ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white font-bold shadow-[0_0_12px_rgba(139,92,246,0.5)] border border-violet-400/40'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                  }`}
                >
                  3-Way Grid
                </button>
                <button
                  onClick={() => setMapLayout('dual_naive')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    mapLayout === 'dual_naive'
                      ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white font-bold shadow-[0_0_12px_rgba(139,92,246,0.5)] border border-violet-400/40'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                  }`}
                >
                  Naive vs Swarm
                </button>
                <button
                  onClick={() => setMapLayout('single')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    mapLayout === 'single'
                      ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white font-bold shadow-[0_0_12px_rgba(139,92,246,0.5)] border border-violet-400/40'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                  }`}
                >
                  Focus View
                </button>
              </div>

              {mapLayout === 'single' && (
                <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[11px] font-mono">
                  <button
                    onClick={() => setSingleFocusWorld('naive')}
                    className={`px-2.5 py-1 rounded transition-all ${
                      singleFocusWorld === 'naive' ? 'bg-slate-800 text-white font-bold' : 'text-slate-400'
                    }`}
                  >
                    Naive
                  </button>
                  <button
                    onClick={() => setSingleFocusWorld('baseline')}
                    className={`px-2.5 py-1 rounded transition-all ${
                      singleFocusWorld === 'baseline' ? 'bg-rose-950 text-rose-300 font-bold' : 'text-slate-400'
                    }`}
                  >
                    Baseline
                  </button>
                  <button
                    onClick={() => setSingleFocusWorld('swarm')}
                    className={`px-2.5 py-1 rounded transition-all ${
                      singleFocusWorld === 'swarm' ? 'bg-emerald-950 text-emerald-300 font-bold' : 'text-slate-400'
                    }`}
                  >
                    Swarm ★
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Large Map Container (580px - 620px height) */}
          <div className={`grid gap-4 ${
            mapLayout === '3way'
              ? 'grid-cols-1 md:grid-cols-3 h-[580px]'
              : mapLayout === 'single'
              ? 'grid-cols-1 h-[620px]'
              : 'grid-cols-1 lg:grid-cols-2 h-[580px]'
          }`}>
            {/* Approach 1: Naive Map (when 3way, dual_naive, or single naive) */}
            {(mapLayout === '3way' || mapLayout === 'dual_naive' || (mapLayout === 'single' && singleFocusWorld === 'naive')) && (
              <MapView
                title="Approach 1: Naive"
                badge="Single-Store Nearest Rider"
                badgeColor="bg-slate-900/90 text-slate-300 border-slate-700"
                worldData={naiveWorld}
                onSelectOrder={(id: string) => handleSelectOrder(id, 'naive')}
                selectedOrderId={selectedWorld === 'naive' ? selectedOrderId || undefined : undefined}
              />
            )}

            {/* Approach 2: Baseline Map (when 3way, dual_baseline, or single baseline) */}
            {(mapLayout === '3way' || mapLayout === 'dual_baseline' || (mapLayout === 'single' && singleFocusWorld === 'baseline')) && (
              <MapView
                title="Approach 2: Baseline"
                badge="Nearest Stocked Dark Store (FIFO Solo)"
                badgeColor="bg-rose-950/80 text-rose-400 border-rose-600/40"
                worldData={tickData.worlds.baseline}
                onSelectOrder={(id: string) => handleSelectOrder(id, 'baseline')}
                selectedOrderId={selectedWorld === 'baseline' ? selectedOrderId || undefined : undefined}
              />
            )}

            {/* Approach 3: Swarm Map (when 3way, dual_baseline, dual_naive, or single swarm) */}
            {(mapLayout === '3way' || mapLayout === 'dual_baseline' || mapLayout === 'dual_naive' || (mapLayout === 'single' && singleFocusWorld === 'swarm')) && (
              <MapView
                title="Approach 3: Swarm Engine ★"
                badge="Coupled Store + Rider + Batch Route"
                badgeColor="bg-emerald-950/80 text-emerald-400 border-emerald-500/40"
                worldData={tickData.worlds.swarm}
                onSelectOrder={(id: string) => handleSelectOrder(id, 'swarm')}
                selectedOrderId={selectedWorld === 'swarm' ? selectedOrderId || undefined : undefined}
              />
            )}
          </div>
        </div>

        <MetricsPanel
          baselineMetrics={tickData.worlds.baseline.metrics}
          swarmMetrics={tickData.worlds.swarm.metrics}
          naiveMetrics={tickData.worlds.naive?.metrics}
        />

        <OrderLedger
          baselineOrders={tickData.worlds.baseline.orders}
          swarmOrders={tickData.worlds.swarm.orders}
          naiveOrders={tickData.worlds.naive?.orders}
          baselineStores={tickData.worlds.baseline.stores}
          swarmStores={tickData.worlds.swarm.stores}
          naiveStores={tickData.worlds.naive?.stores}
          baselineRiders={tickData.worlds.baseline.riders}
          swarmRiders={tickData.worlds.swarm.riders}
          naiveRiders={tickData.worlds.naive?.riders}
          simTime={tickData.simTime}
          seed={tickData.seed}
          onSelectOrder={handleSelectOrder}
        />

        <EventLog events={events} />
      </main>

      {selectedOrderObj && (
        <OrderDrawer
          order={selectedOrderObj}
          world={selectedWorld}
          onClose={() => setSelectedOrderId(null)}
        />
      )}

      <FinalScoreboardModal
        isOpen={scoreboardOpen}
        onClose={() => setScoreboardOpen(false)}
        baselineMetrics={tickData.worlds.baseline.metrics}
        swarmMetrics={tickData.worlds.swarm.metrics}
        naiveMetrics={tickData.worlds.naive?.metrics}
      />

      <PitchDeckModal
        isOpen={pitchDeckOpen}
        onClose={() => setPitchDeckOpen(false)}
      />
    </div>
  );
};

export default App;