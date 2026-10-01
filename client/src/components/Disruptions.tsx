import React from 'react';
import { CloudRain, Construction, StoreIcon, UserX, TrendingUp, Ban, PackageX, Sun } from 'lucide-react';
import { ScenarioName, TickPayload } from '../types';

const ITEMS: { id: ScenarioName; label: string; effect: string; icon: React.ReactNode; tone: string; active?: (t: TickPayload) => boolean }[] = [
  { id: 'monsoon', label: 'Monsoon', effect: 'Travel +50% everywhere', icon: <CloudRain size={16} />, tone: 'text-info', active: t => t.weatherMult < 1 },
  { id: 'traffic_jam', label: 'Gridlock', effect: '2× travel around one store', icon: <Construction size={16} />, tone: 'text-jam', active: t => !!t.trafficJam },
  { id: 'surge', label: 'Demand surge', effect: '3× orders for 10 min', icon: <TrendingUp size={16} />, tone: 'text-warn', active: t => t.activeScenario === 'spike' },
  { id: 'store_offline', label: 'Store offline', effect: 'Orders move to next store', icon: <StoreIcon size={16} />, tone: 'text-bad', active: t => t.worlds.swarm.stores.some(s => s.offline) },
  { id: 'rider_offline', label: 'Riders drop out', effect: '3 riders, mid-delivery', icon: <UserX size={16} />, tone: 'text-bad' },
  { id: 'cancel_burst', label: 'Cancellations', effect: '10% of unpicked orders', icon: <Ban size={16} />, tone: 'text-mute' },
  { id: 'stockout', label: 'Stock-out', effect: '5 items gone in Andheri W', icon: <PackageX size={16} />, tone: 'text-plum' },
];

export const Disruptions: React.FC<{ tick: TickPayload; onTrigger: (s: ScenarioName) => void; disabled?: boolean }> = ({ tick, onTrigger, disabled }) => (
  <section className="panel p-4" aria-label="Disruptions">
    <div className="flex items-center justify-between">
      <div>
        <div className="eyebrow">Hit all three worlds at once</div>
        <h2 className="mt-1 font-display text-[15px] font-bold">Disruptions</h2>
      </div>
      <button className="btn h-8 px-2.5 text-[12px]" onClick={() => onTrigger('clear')} disabled={disabled} title="Clear weather, gridlock and offline stores">
        <Sun size={14} /> All clear
      </button>
    </div>
    <div className="mt-3 grid grid-cols-2 gap-1.5">
      {ITEMS.map(it => {
        const on = it.active?.(tick);
        return (
          <button
            key={it.id}
            onClick={() => onTrigger(it.id)}
            disabled={disabled}
            className={`group flex min-w-0 items-start gap-2 rounded-xl border px-2.5 py-2 text-left transition-[background,border-color,transform] duration-150 active:scale-[0.98] disabled:opacity-40 ${
              on ? 'border-edge bg-lift' : 'border-line bg-bg/60 hover:border-edge hover:bg-raise'
            }`}
          >
            <span className={`mt-0.5 shrink-0 ${it.tone}`}>{it.icon}</span>
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-ink">
                {it.label}
                {on && <span className="h-1.5 w-1.5 animate-pulse2 rounded-full bg-brand" />}
              </span>
              <span className="block truncate text-[11px] text-dim">{it.effect}</span>
            </span>
          </button>
        );
      })}
    </div>
  </section>
);
