import React from 'react';
import { Truck, Activity, CloudRain, Zap, Award, Presentation } from 'lucide-react';
import { formatSimTime } from '../lib/format';

interface HeaderProps {
  connected: boolean;
  simTime: number;
  seed: number;
  activeScenario: string;
  weatherMult: number;
  onOpenScoreboard: () => void;
  onOpenPitchDeck: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  connected,
  simTime,
  seed,
  activeScenario,
  weatherMult,
  onOpenScoreboard,
  onOpenPitchDeck,
}) => {
  return (
    <header className="w-full bg-[#0b0f19]/90 border-b border-slate-800/80 px-6 py-3 flex flex-wrap items-center justify-between gap-4 backdrop-blur-md sticky top-0 z-40">
      {/* Left Branding */}
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 ring-1 ring-emerald-400/40">
          <Truck className="w-5 h-5 text-black font-bold" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-black tracking-tight text-white font-mono">SWARM</h1>
            <span className="text-[10px] font-semibold tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              SIMULATOR 4.0
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Mumbai Last-Mile Allocation Engine & Live Digital Twin
          </p>
        </div>
      </div>

      {/* Center Clock & Scenario Status */}
      <div className="flex items-center space-x-4">
        {/* Digital Clock */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-lg px-4 py-1.5 flex items-center space-x-2">
          <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
          <div className="text-right">
            <span className="text-[10px] uppercase text-slate-500 font-mono block leading-none">Sim Time</span>
            <span className="text-lg font-bold font-mono text-emerald-400 leading-none">
              {formatSimTime(simTime)}
            </span>
          </div>
        </div>

        {/* Seed & Scenario Indicators */}
        <div className="flex items-center space-x-2">
          <span className="text-xs font-mono px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-slate-300">
            Seed: <strong className="text-amber-400">{seed}</strong>
          </span>

          {weatherMult < 1.0 && (
            <span className="text-xs font-medium px-2.5 py-1 rounded-md bg-sky-950/80 border border-sky-600/40 text-sky-300 flex items-center space-x-1.5 animate-pulse">
              <CloudRain className="w-3.5 h-3.5 text-sky-400" />
              <span>Monsoon (ETAs +50%)</span>
            </span>
          )}

          {activeScenario === 'spike' && (
            <span className="text-xs font-medium px-2.5 py-1 rounded-md bg-amber-950/80 border border-amber-600/40 text-amber-300 flex items-center space-x-1.5 animate-pulse">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>IPL Spike (3x Rate)</span>
            </span>
          )}
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center space-x-3">
        {/* Server Connection Pill */}
        <div className="flex items-center space-x-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800">
          <div
            className={`w-2 h-2 rounded-full ${
              connected ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-red-500 shadow-[0_0_8px_#ef4444]'
            }`}
          />
          <span className="text-xs font-medium text-slate-300">
            {connected ? 'Engine Live' : 'Disconnected'}
          </span>
        </div>

        {/* Pitch Deck Trigger */}
        <button
          onClick={onOpenPitchDeck}
          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-600 font-semibold text-xs flex items-center space-x-1.5 transition-all active:scale-95"
        >
          <Presentation className="w-4 h-4 text-emerald-400" />
          <span>Pitch Deck (6 Slides)</span>
        </button>

        {/* Scoreboard Trigger */}
        <button
          onClick={onOpenScoreboard}
          className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-slate-900 font-semibold text-xs flex items-center space-x-1.5 shadow-md shadow-emerald-600/20 transition-all active:scale-95"
        >
          <Award className="w-4 h-4 text-black font-black" />
          <span>Final Scoreboard</span>
        </button>
      </div>
    </header>
  );
};

