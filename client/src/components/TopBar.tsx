import React from 'react';
import { Pause, Play, RotateCcw, CloudRain, TrendingUp, Construction, StoreIcon, WifiOff } from 'lucide-react';
import { TickPayload } from '../types';
import { formatSimTime } from '../lib/format';

export type Screen = 'live' | 'orders' | 'results' | 'track' | 'setup' | 'pitch';

export const SCREENS: { id: Screen; label: string }[] = [
  { id: 'live', label: 'Live' },
  { id: 'orders', label: 'Orders' },
  { id: 'results', label: 'Results' },
  { id: 'track', label: 'Track' },
  { id: 'setup', label: 'Setup' },
  { id: 'pitch', label: 'Pitch' },
];

const SPEEDS = [1, 5, 10, 30];

interface Props {
  tick: TickPayload | null;
  connected: boolean;
  screen: Screen;
  onScreen: (s: Screen) => void;
  onControl: (action: 'play' | 'pause' | 'reset', opts?: { speed?: number }) => void;
}

export const TopBar: React.FC<Props> = ({ tick, connected, screen, onScreen, onControl }) => {
  const running = !!tick?.running;
  const offline = tick?.worlds.swarm.stores.filter(s => s.offline).map(s => s.name.replace(' Dark Store', '')) ?? [];

  return (
    <header className="relative z-40 flex h-[var(--topbar)] items-center gap-4 border-b border-line bg-panel/95 px-4 backdrop-blur">
      {/* Brand */}
      <div className="flex shrink-0 items-center gap-2.5">
        <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
          <rect width="26" height="26" rx="8" fill="#f6b73c" />
          <circle cx="8.5" cy="9" r="2.2" fill="#140e03" />
          <circle cx="17.5" cy="9" r="2.2" fill="#140e03" />
          <circle cx="13" cy="17.5" r="2.2" fill="#140e03" />
          <path d="M8.5 9L13 17.5L17.5 9" fill="none" stroke="#140e03" strokeWidth="1.6" />
        </svg>
        <div className="leading-none">
          <div className="font-display text-[16px] font-extrabold tracking-[-0.02em]">Swarm</div>
          <div className="mt-0.5 hidden font-mono text-[10px] text-dim xl:block">Mumbai dispatch · 15 dark stores</div>
        </div>
      </div>

      {/* Screens */}
      <nav className="flex min-w-0 items-center gap-0.5 overflow-x-auto" aria-label="Screens">
        {SCREENS.map((s, i) => (
          <button
            key={s.id}
            onClick={() => onScreen(s.id)}
            aria-current={screen === s.id ? 'page' : undefined}
            title={`${s.label} (${i + 1})`}
            className={`relative h-9 shrink-0 rounded-lg px-3 text-[13px] font-medium transition-colors ${
              screen === s.id ? 'text-ink' : 'text-mute hover:bg-raise hover:text-ink'
            }`}
          >
            {s.label}
            <span
              className={`absolute inset-x-3 -bottom-[11px] h-[2px] rounded-full bg-brand transition-opacity duration-200 ${screen === s.id ? 'opacity-100' : 'opacity-0'}`}
            />
          </button>
        ))}
      </nav>

      {/* Live conditions */}
      <div className="hidden min-w-0 flex-1 items-center justify-end gap-1.5 lg:flex">
        {tick && tick.weatherMult < 1 && (
          <span className="chip border-info/40 bg-info/10 text-info"><CloudRain size={13} /> Monsoon +50%</span>
        )}
        {tick?.trafficJam && (
          <span className="chip border-jam/40 bg-jam/10 text-jam"><Construction size={13} /> Gridlock {tick.trafficJam.name}</span>
        )}
        {tick?.forecast?.surge && (
          <span className="chip border-warn/40 bg-warn/10 text-warn"><TrendingUp size={13} /> Surge {tick.forecast.ordersPerHourLast5Min}/h</span>
        )}
        {offline.length > 0 && (
          <span className="chip border-bad/40 bg-bad/10 text-bad"><StoreIcon size={13} /> {offline.join(', ')} offline</span>
        )}
      </div>

      {/* Clock + transport */}
      <div className="ml-auto flex shrink-0 items-center gap-2 lg:ml-0">
        <div className="hidden text-right sm:block">
          <div className="eyebrow leading-none">Sim time</div>
          <div className="num mt-0.5 font-mono text-[17px] font-semibold leading-none">{tick ? formatSimTime(tick.simTime) : '--:--:--'}</div>
        </div>
        <button
          className="btn btn-brand w-[92px] justify-center"
          onClick={() => onControl(running ? 'pause' : 'play')}
          disabled={!connected}
          title="Play / pause (Space)"
        >
          {running ? <Pause size={15} /> : <Play size={15} />}
          {running ? 'Pause' : 'Play'}
        </button>
        <div className="seg hidden md:inline-flex" role="group" aria-label="Speed">
          {SPEEDS.map(s => (
            <button key={s} aria-pressed={tick?.speed === s} onClick={() => onControl(running ? 'play' : 'pause', { speed: s })} disabled={!connected}>
              {s}×
            </button>
          ))}
        </div>
        <button className="btn btn-ghost px-2.5" onClick={() => onControl('reset')} disabled={!connected} title="Reset the run (same seed)">
          <RotateCcw size={15} />
        </button>
        <span
          className={`flex h-9 items-center gap-1.5 rounded-xl px-2 text-[12px] ${connected ? 'text-mute' : 'text-bad'}`}
          title={connected ? 'Connected to the simulation server' : 'Not connected to the simulation server'}
        >
          {connected ? <span className="h-2 w-2 rounded-full bg-good shadow-[0_0_8px_rgb(var(--good))]" /> : <WifiOff size={14} />}
          <span className="hidden 2xl:inline">{connected ? 'Live' : 'Offline'}</span>
        </span>
      </div>
    </header>
  );
};
