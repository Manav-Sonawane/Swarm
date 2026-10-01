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
import { FinalScoreboardModal } from './components/FinalScoreboardModal';

const App: React.FC = () => {
  const [tickData, setTickData] = useState<TickPayload>(getMockTickPayload());
  const [events, setEvents] = useState<EventPayload[]>([]);
  const [connected, setConnected] = useState<boolean>(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedWorld, setSelectedWorld] = useState<'baseline' | 'swarm'>('swarm');
  const [scoreboardOpen, setScoreboardOpen] = useState<boolean>(false);

  useEffect(() => {
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onTick = (data: TickPayload) => setTickData(data);
    const onEvent = (evt: EventPayload) => setEvents(prev => [...prev.slice(-49), evt]);

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

  const handleSelectOrder = (orderId: string, world: 'baseline' | 'swarm') => {
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

  const selectedOrderObj: OrderSnapshot | null = selectedOrderId
    ? tickData.worlds[selectedWorld].orders.find((o: OrderSnapshot) => o.id === selectedOrderId) || null
    : null;

  return (
    <div className="intelligence-root min-h-screen flex flex-col bg-slate-950 text-slate-100 font-sans">
      <Header
        connected={connected}
        simTime={tickData.simTime}
        seed={tickData.seed}
        activeScenario={tickData.activeScenario}
        weatherMult={tickData.weatherMult}
        onOpenScoreboard={() => setScoreboardOpen(true)}
      />

      <main className="flex-1 max-w-[1700px] w-full mx-auto p-4 space-y-4">
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-[440px]">
          <MapView
            title="World A: Baseline (Greedy FIFO)"
            badge="Naive Nearest-Rider"
            badgeColor="bg-rose-950/80 text-rose-400 border-rose-600/40"
            worldData={tickData.worlds.baseline}
            onSelectOrder={(id: string) => handleSelectOrder(id, 'baseline')}
            selectedOrderId={selectedWorld === 'baseline' ? selectedOrderId || undefined : undefined}
          />
          <MapView
            title="World B: Swarm (Rolling-Horizon Engine)"
            badge="Batching + Slack-Aware + Re-planning"
            badgeColor="bg-emerald-950/80 text-emerald-400 border-emerald-500/40"
            worldData={tickData.worlds.swarm}
            onSelectOrder={(id: string) => handleSelectOrder(id, 'swarm')}
            selectedOrderId={selectedWorld === 'swarm' ? selectedOrderId || undefined : undefined}
          />
        </div>

        <MetricsPanel
          baselineMetrics={tickData.worlds.baseline.metrics}
          swarmMetrics={tickData.worlds.swarm.metrics}
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
      />
    </div>
  );
};

export default App;
