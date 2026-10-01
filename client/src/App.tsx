import React, { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useSim } from './lib/useSim';
import { WorldName } from './types';
import { TopBar, Screen, SCREENS } from './components/TopBar';
import { LiveView } from './components/LiveView';
import { OrdersView } from './components/OrdersView';
import { ResultsView } from './components/ResultsView';
import { TrackView } from './components/TrackView';
import { SetupView } from './components/SetupView';
import { PitchView } from './components/PitchView';
import { DecisionDrawer } from './components/DecisionDrawer';

const App: React.FC = () => {
  const sim = useSim();
  const { tick, control, connected } = sim;
  const [screen, setScreen] = useState<Screen>(() => {
    const h = window.location.hash.slice(1);
    return SCREENS.some(s => s.id === h) ? (h as Screen) : 'live';
  });
  useEffect(() => {
    window.history.replaceState(null, '', `#${screen}`);
  }, [screen]);
  const [drawer, setDrawer] = useState<{ world: WorldName; id: string } | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [trackId, setTrackId] = useState<string | null>(null);

  const openWhy = useCallback((world: WorldName, id: string) => setDrawer({ world, id }), []);
  const compare = useCallback((id: string) => {
    setOrderId(id);
    setDrawer(null);
    setScreen('orders');
  }, []);
  const track = useCallback((id: string) => {
    setTrackId(id);
    setDrawer(null);
    setScreen('track');
  }, []);

  // A new run (reset or new seed) invalidates any order selection
  const runKey = tick ? `${tick.seed}` : '';
  useEffect(() => {
    setDrawer(null);
    setOrderId(null);
    setTrackId(null);
  }, [runKey]);

  // Space = play/pause, 1-6 = screens (ignored while typing)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.code === 'Space' && tick && connected) {
        e.preventDefault();
        control(tick.running ? 'pause' : 'play');
      }
      const n = Number(e.key);
      if (n >= 1 && n <= SCREENS.length) setScreen(SCREENS[n - 1].id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tick, connected, control]);

  return (
    <div className="flex h-full flex-col">
      <TopBar tick={tick} connected={connected} screen={screen} onScreen={setScreen} onControl={control} />
      <main className="relative min-h-0 flex-1">
        {!tick ? (
          <div className="grid h-full place-items-center">
            <div className="flex flex-col items-center gap-3 text-center">
              <Loader2 className="animate-spin text-brand" size={28} />
              <div className="font-display text-[18px] font-bold">Connecting to the simulation</div>
              <div className="max-w-sm text-[13px] text-mute">
                Start the server with <code className="rounded bg-raise px-1.5 py-0.5 font-mono text-[12px]">npm run dev</code> in <code className="rounded bg-raise px-1.5 py-0.5 font-mono text-[12px]">server/</code>. This page connects on its own.
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Live stays mounted so the maps keep their view and riders keep gliding */}
            <div className={`absolute inset-0 ${screen === 'live' ? '' : 'invisible pointer-events-none'}`} aria-hidden={screen !== 'live'}>
              <LiveView sim={sim} selected={drawer} onSelectOrder={openWhy} onTrack={track} />
            </div>
            {screen !== 'live' && (
              <div className="absolute inset-0 z-10 bg-bg" key={screen}>
                {screen === 'orders' && <OrdersView tick={tick} orderId={orderId} onOrder={setOrderId} onWhy={openWhy} onTrack={track} placed={sim.placed} />}
                {screen === 'results' && <ResultsView tick={tick} />}
                {screen === 'track' && <TrackView tick={tick} trackId={trackId} onTrackId={setTrackId} placed={sim.placed} onWhy={openWhy} />}
                {screen === 'setup' && <SetupView tick={tick} onApply={(setup, seed) => control('reset', { setup, seed })} />}
                {screen === 'pitch' && <PitchView tick={tick} />}
              </div>
            )}
            {drawer && <DecisionDrawer tick={tick} world={drawer.world} orderId={drawer.id} onClose={() => setDrawer(null)} onCompare={compare} onTrack={track} />}
          </>
        )}
      </main>
    </div>
  );
};

export default App;
