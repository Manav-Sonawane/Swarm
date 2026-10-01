import React from 'react';
import { Truck, Activity, CloudRain, Zap, Award, Presentation } from 'lucide-react';
import { formatSimTime } from '../lib/format';

interface HeaderProps {
  connected: boolean;
  simTime: number;
  seed: number;
  activeScenario: string;
  weatherMult: number;
  forecast?: { ordersPerHourLast5Min: number; surge: boolean };
  offlineStores?: string[];
  onOpenScoreboard: () => void;
  onOpenPitchDeck: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  connected,
  simTime,
  seed,
  activeScenario,
  weatherMult,
  forecast,
  offlineStores = [],
  onOpenScoreboard,
  onOpenPitchDeck,
}) => {
  return (
    <header className="w-full glass-heavy border-b border-white/10 px-6 py-3.5 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-40 shadow-glass-md">
      {/* Top subtle sheen */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />

      {/* Left Branding */}
      <div className="flex items-center space-x-3.5">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-violet-600 via-purple-500 to-cyan-400 p-[1.5px] shadow-[0_0_20px_rgba(124,58,237,0.35)]">
          <div className="w-full h-full bg-[#08070D] rounded-[14px] flex items-center justify-center">
            <Truck className="w-5 h-5 text-lavender-300 font-bold" />
          </div>
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-black tracking-tight text-white font-mono bg-gradient-to-r from-white via-slate-100 to-lavender-300 bg-clip-text text-transparent">
              SWARM
            </h1>
            <span className="text-[10px] font-semibold font-mono tracking-wider px-2 py-0.5 rounded-full bg-violet-500/15 text-lavender-300 border border-violet-500/30 shadow-[0_0_10px_rgba(124,58,237,0.2)]">
              SIMULATOR 4.0
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Mumbai Last-Mile Allocation Engine &amp; Live Digital Twin
          </p>
        </div>
      </div>

      {/* Center Clock & Scenario Status */}
      <div className="flex items-center space-x-4">
        {/* Digital Clock */}
        <div className="glass-light border border-white/10 rounded-xl px-4 py-1.5 flex items-center space-x-2.5 shadow-glass-sm">
          <Activity className="w-4 h-4 text-cyan-accent animate-pulse" />
          <div className="text-right">
            <span className="text-[9px] uppercase tracking-wider text-slate-400 font-mono block leading-none">Sim Time</span>
            <span className="text-lg font-bold font-mono text-white leading-none">
              {formatSimTime(simTime)}
            </span>
          </div>
        </div>

        {/* Seed & Scenario Indicators */}
        <div className="flex items-center space-x-2">
          <span className="text-xs font-mono px-3 py-1 rounded-xl glass-light border border-white/10 text-slate-300">
            Seed: <strong className="text-lavender-300">{seed}</strong>
          </span>

          {weatherMult < 1.0 && (
            <span className="text-xs font-medium px-3 py-1 rounded-xl bg-sky-950/60 border border-sky-400/30 text-sky-200 flex items-center space-x-1.5 shadow-[0_0_15px_rgba(56,189,248,0.2)] animate-pulse">
              <CloudRain className="w-3.5 h-3.5 text-sky-300" />
              <span>Monsoon (ETAs +50%)</span>
            </span>
          )}

          {activeScenario === 'spike' && (
            <span className="text-xs font-medium px-3 py-1 rounded-xl bg-amber-950/60 border border-amber-400/30 text-amber-200 flex items-center space-x-1.5 shadow-[0_0_15px_rgba(251,191,36,0.2)] animate-pulse">
              <Zap className="w-3.5 h-3.5 text-amber-300" />
              <span>IPL Spike (3x Rate)</span>
            </span>
          )}

          {forecast?.surge && (
            <span className="text-xs font-medium px-3 py-1 rounded-xl bg-orange-950/60 border border-orange-400/30 text-orange-200 flex items-center space-x-1.5">
              <Zap className="w-3.5 h-3.5 text-orange-300" />
              <span>Surge forecast: {forecast.ordersPerHourLast5Min} orders/h</span>
            </span>
          )}

          {offlineStores.length > 0 && (
            <span className="text-xs font-medium px-3 py-1 rounded-xl bg-rose-950/60 border border-rose-400/30 text-rose-200 flex items-center space-x-1.5">
              <span>⛔ {offlineStores.join(', ')} offline</span>
            </span>
          )}
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center space-x-3">
        {/* Server Connection Pill */}
        <div className="flex items-center space-x-2 px-3 py-1 rounded-full glass-light border border-white/10">
          <div
            className={`w-2 h-2 rounded-full ${
              connected ? 'bg-emerald-400 shadow-[0_0_10px_#34d399]' : 'bg-rose-500 shadow-[0_0_10px_#f43f5e]'
            }`}
          />
          <span className="text-xs font-medium text-slate-300">
            {connected ? 'Engine Live' : 'Disconnected'}
          </span>
        </div>

        {/* Pitch Deck Trigger */}
        <button
          onClick={onOpenPitchDeck}
          className="px-3.5 py-1.5 rounded-xl glass-light hover:glass-medium text-slate-200 hover:text-white border border-white/15 hover:border-violet-400/40 font-semibold text-xs flex items-center space-x-1.5 transition-all duration-300 active:scale-95 shadow-glass-sm hover:shadow-[0_0_20px_rgba(124,58,237,0.25)]"
        >
          <Presentation className="w-4 h-4 text-cyan-accent" />
          <span>Pitch Deck (6 Slides)</span>
        </button>

        {/* Scoreboard Trigger */}
        <button
          onClick={onOpenScoreboard}
          className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-semibold text-xs flex items-center space-x-1.5 shadow-[0_0_20px_rgba(124,58,237,0.4)] border border-violet-400/30 transition-all duration-300 active:scale-95"
        >
          <Award className="w-4 h-4 text-lavender-200" />
          <span>Final Scoreboard</span>
        </button>
      </div>
    </header>
  );
};

