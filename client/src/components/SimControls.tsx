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
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-4 shadow-xl">
      {/* Play/Pause & Reset */}
      <div className="flex items-center space-x-2">
        <button
          onClick={() => onControl(running ? 'pause' : 'play')}
          className={`px-4 py-2 rounded-lg font-semibold text-xs flex items-center space-x-2 transition-all shadow-md active:scale-95 ${
            running
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 hover:bg-amber-500/30'
              : 'bg-emerald-500 text-black hover:bg-emerald-400 font-bold shadow-emerald-500/20'
          }`}
        >
          {running ? (
            <>
              <Pause className="w-4 h-4" />
              <span>Pause Sim</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-black" />
              <span>Start Sim</span>
            </>
          )}
        </button>

        <button
          onClick={() => onControl('reset', speed, seedInput)}
          className="px-3 py-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white border border-slate-700 font-medium text-xs flex items-center space-x-1.5 transition-all hover:bg-slate-700 active:scale-95"
          title="Reset simulation to initial seed state"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset</span>
        </button>
      </div>

      {/* Speed Slider */}
      <div className="flex items-center space-x-3 bg-slate-950/60 border border-slate-800/80 rounded-lg px-3 py-1.5">
        <FastForward className="w-4 h-4 text-slate-400" />
        <span className="text-xs text-slate-400 font-mono w-10">
          <strong>{speed}x</strong>
        </span>

        <input
          type="range"
          min="1"
          max="30"
          value={speed}
          onChange={(e) => onControl(running ? 'play' : 'pause', Number(e.target.value))}
          className="w-24 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
        />

        <div className="flex space-x-1">
          {[1, 10, 30].map((s) => (
            <button
              key={s}
              onClick={() => onControl(running ? 'play' : 'pause', s)}
              className={`px-2 py-0.5 text-[10px] font-mono rounded ${
                speed === s
                  ? 'bg-emerald-500/30 text-emerald-400 border border-emerald-500/40'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      {/* Seed Input & Export */}
      <div className="flex items-center space-x-3">
        <form onSubmit={handleSeedSubmit} className="flex items-center space-x-1.5">
          <div className="relative flex items-center">
            <Key className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 pointer-events-none" />
            <input
              type="number"
              value={seedInput}
              onChange={(e) => setSeedInput(Number(e.target.value))}
              className="w-20 pl-7 pr-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-amber-400 focus:outline-none focus:border-amber-500/50"
              placeholder="Seed"
            />
          </div>
          <button
            type="submit"
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-medium"
          >
            Apply
          </button>
        </form>

        <button
          onClick={onExport}
          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-medium flex items-center space-x-1.5"
          title="Export Run Metrics to JSON"
        >
          <Download className="w-3.5 h-3.5 text-slate-400" />
          <span>Export JSON</span>
        </button>
      </div>
    </div>
  );
};
