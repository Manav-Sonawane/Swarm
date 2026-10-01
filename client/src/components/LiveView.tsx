import React, { useMemo, useState } from 'react';
import { MousePointerClick, X } from 'lucide-react';
import { Sim } from '../lib/useSim';
import { WorldName } from '../types';
import { WORLDS } from '../lib/theme';
import { WorldMap, createMapSync } from './WorldMap';
import { Scoreboard } from './Scoreboard';
import { Disruptions } from './Disruptions';
import { EventFeed } from './EventFeed';
import { OrderComposer } from './OrderComposer';

type Layout = 'duel' | 'trio' | 'focus';

interface Props {
  sim: Sim;
  selected: { world: WorldName; id: string } | null;
  onSelectOrder: (world: WorldName, id: string) => void;
  onTrack: (id: string) => void;
}

const LEGEND: { label: string; color: string; ring?: string }[] = [
  { label: 'Express (10 min)', color: '#f6b73c' },
  { label: 'Regular (20 min)', color: '#5ab8ff' },
  { label: 'Extended (30 min)', color: '#94a2b3' },
  { label: 'Late / at risk', color: '#ff5b70' },
  { label: 'Roadside handover', color: '#e879a8' },
  { label: 'Placed by you', color: '#09090b', ring: '#f6b73c' },
];

export const LiveView: React.FC<Props> = ({ sim, selected, onSelectOrder, onTrack }) => {
  const tick = sim.tick!;
  const [layout, setLayout] = useState<Layout>('duel');
  const [focus, setFocus] = useState<WorldName>('swarm');
  const [picking, setPicking] = useState(false);
  const [pick, setPick] = useState<{ lat: number; lng: number } | null>(null);
  const sync = useMemo(createMapSync, []);

  const shown: WorldName[] = layout === 'duel' ? ['swarm', 'baseline'] : layout === 'trio' ? ['swarm', 'baseline', 'naive'] : [focus];
  const worldData = (w: WorldName) => (w === 'naive' ? tick.worlds.naive ?? tick.worlds.baseline : tick.worlds[w]);

  const startPicking = () => {
    setPicking(true);
    setPick(null);
  };
  const closeComposer = () => {
    setPicking(false);
    setPick(null);
  };

  return (
    <div className="screen grid h-full min-h-0 grid-cols-1 gap-3 overflow-y-auto p-3 xl:grid-cols-[minmax(0,1fr)_400px] xl:overflow-hidden">
      {/* Maps */}
      <section className="flex min-h-[560px] min-w-0 flex-col gap-2.5 xl:min-h-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="seg" role="group" aria-label="Map layout">
              <button aria-pressed={layout === 'duel'} onClick={() => setLayout('duel')}>Swarm vs Baseline</button>
              <button aria-pressed={layout === 'trio'} onClick={() => setLayout('trio')}>All three</button>
              <button aria-pressed={layout === 'focus'} onClick={() => setLayout('focus')}>One world</button>
            </div>
            {layout === 'focus' && (
              <div className="seg animate-fade" role="group" aria-label="World">
                {(['swarm', 'baseline', 'naive'] as WorldName[]).map(w => (
                  <button key={w} aria-pressed={focus === w} onClick={() => setFocus(w)}>
                    <span className={focus === w ? WORLDS[w].text : ''}>{WORLDS[w].label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {picking ? (
            <button className="btn border-brand/50 bg-brand/10 text-brand" onClick={closeComposer}>
              <X size={15} /> {pick ? 'Close order' : 'Click a spot on the map…'}
            </button>
          ) : (
            <button className="btn btn-brand" onClick={startPicking} disabled={!sim.connected}>
              <MousePointerClick size={15} /> Place an order
            </button>
          )}
        </div>

        <div
          className={`relative grid min-h-0 flex-1 gap-2.5 ${
            shown.length === 3 ? 'grid-cols-1 lg:grid-cols-3' : shown.length === 2 ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'
          }`}
        >
          {shown.map(w => (
            <WorldMap
              key={w}
              world={w}
              data={worldData(w)}
              jam={tick.trafficJam}
              sync={sync}
              selectedOrderId={selected?.id}
              onSelectOrder={id => onSelectOrder(w, id)}
              picking={picking}
              onPick={(lat, lng) => setPick({ lat, lng })}
              pick={pick}
            />
          ))}
          {picking && pick && (
            <OrderComposer pick={pick} quote={sim.quote} place={sim.placeOrder} onClose={closeComposer} onTrack={id => { closeComposer(); onTrack(id); }} />
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-dim">
          {LEGEND.map(l => (
            <span key={l.label} className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: l.color, boxShadow: l.ring ? `inset 0 0 0 2px ${l.ring}` : undefined }} />
              {l.label}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5"><span className="h-[2px] w-4 rounded bg-mute" /> Trip in progress</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-[2px] w-4 rounded border-t-2 border-dashed border-mute" /> Heading to pickup</span>
          <span>Click any order to see why it went to that rider.</span>
        </div>
      </section>

      {/* Side column */}
      <aside className="-mr-1 flex min-h-0 min-w-0 flex-col gap-3 pr-1 xl:overflow-y-auto">
        <Scoreboard tick={tick} />
        <Disruptions tick={tick} onTrigger={sim.scenario} disabled={!sim.connected} />
        <EventFeed events={sim.events} className="min-h-[320px] flex-1 shrink-0" />
      </aside>
    </div>
  );
};
