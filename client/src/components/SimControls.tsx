import React, { useState } from 'react';
import { Play, Pause, RotateCcw, FastForward, Download, Key } from 'lucide-react';

interface SimControlsProps {
  running: boolean;
  speed: number;
  seed: number;
  onControl: (action: 'play' | 'pause' | 'reset', speed?: number, seed?: number) => void;
  onExport: () => void;
}

export const SimControls: React.FC<SimControlsProps> = ({
  running,
  speed,
  seed,
  onControl,
  onExport,
}) => {
  const [seedInput, setSeedInput] = useState<number>(seed);

  const handleSeedSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onControl('reset', speed, seedInput);
  };

  return (
    <div className="glass-medium border border-white/10 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-4 shadow-glass-md transition-all duration-300 relative overflow-hidden">
      {/* Top sheen */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      {/* Play/Pause & Reset */}
      <div className="flex items-center space-x-2.5">
        <button
          onClick={() => onControl(running ? 'pause' : 'play')}
          className={`px-5 py-2.5 rounded-xl font-bold text-xs flex items-center space-x-2 transition-all duration-300 active:scale-95 ${
            running
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.25)]'
              : 'glass-btn-primary shadow-[0_0_20px_rgba(124,58,237,0.4)]'
          }`}
        >
          {running ? (
            <>
              <Pause className="w-4 h-4 text-amber-300" />
              <span>Pause Sim</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-white text-white" />
              <span>Start Sim</span>
            </>
          )}
        </button>

        <button
          onClick={() => onControl('reset', speed, seedInput)}
          className="px-3.5 py-2.5 rounded-xl glass-light text-slate-300 hover:text-white border border-white/10 hover:border-white/25 font-medium text-xs flex items-center space-x-1.5 transition-all duration-300 active:scale-95"
          title="Reset simulation to initial seed state"
        >
          <RotateCcw className="w-3.5 h-3.5 text-lavender-300" />
          <span>Reset</span>
        </button>
      </div>

      {/* Speed Slider */}
      <div className="flex items-center space-x-3 bg-black/40 border border-white/10 rounded-xl px-4 py-2">
        <FastForward className="w-4 h-4 text-lavender-300" />
        <span className="text-xs text-slate-300 font-mono w-10">
          <strong className="text-white">{speed}x</strong>
        </span>

        <input
          type="range"
          min="1"
          max="30"
          value={speed}
          onChange={(e) => onControl(running ? 'play' : 'pause', Number(e.target.value))}
          className="w-24 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-violet-500"
        />

        <div className="flex space-x-1">
          {[1, 10, 30].map((s) => (
            <button
              key={s}
              onClick={() => onControl(running ? 'play' : 'pause', s)}
              className={`px-2.5 py-1 text-[10px] font-mono rounded-lg transition-all duration-200 ${
                speed === s
                  ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white font-bold shadow-[0_0_10px_rgba(139,92,246,0.4)] border border-violet-400/30'
                  : 'bg-white/[0.04] text-slate-400 hover:text-white hover:bg-white/[0.08]'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      {/* Seed Input & Export */}
      <div className="flex items-center space-x-3">
        <form onSubmit={handleSeedSubmit} className="flex items-center space-x-2">
          <div className="relative flex items-center">
            <Key className="w-3.5 h-3.5 text-lavender-400 absolute left-3 pointer-events-none" />
            <input
              type="number"
              value={seedInput}
              onChange={(e) => setSeedInput(Number(e.target.value))}
              className="glass-input w-24 pl-8"
              placeholder="Seed"
            />
          </div>
          <button
            type="submit"
            className="px-3.5 py-2 rounded-xl glass-light hover:glass-medium text-slate-200 hover:text-white border border-white/10 hover:border-violet-400/30 text-xs font-medium transition-all duration-200"
          >
            Apply
          </button>
        </form>

        <button
          onClick={onExport}
          className="px-3.5 py-2 rounded-xl glass-light hover:glass-medium text-slate-200 hover:text-white border border-white/10 hover:border-violet-400/30 text-xs font-medium flex items-center space-x-1.5 transition-all duration-200 shadow-glass-sm"
          title="Export Run Metrics to JSON"
        >
          <Download className="w-3.5 h-3.5 text-cyan-accent" />
          <span>Export JSON</span>
        </button>
      </div>
    </div>
  );
};
