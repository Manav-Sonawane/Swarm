import React from 'react';
import { CloudRain, Zap, UserX, PackageX, XCircle, Sun } from 'lucide-react';
import { ScenarioName } from '../types';

interface ScenarioBarProps {
  activeScenario: string;
  onTriggerScenario: (name: ScenarioName) => void;
}

export const ScenarioBar: React.FC<ScenarioBarProps> = ({
  activeScenario,
  onTriggerScenario,
}) => {
  const scenarios: {
    id: ScenarioName;
    label: string;
    icon: React.ReactNode;
    color: string;
    desc: string;
  }[] = [
    {
      id: 'monsoon',
      label: 'Monsoon',
      icon: <CloudRain className="w-4 h-4 text-sky-400" />,
      color: 'hover:border-sky-500/50 hover:bg-sky-950/40 text-sky-300',
      desc: 'ETAs +50%',
    },
    {
      id: 'spike',
      label: 'IPL Spike',
      icon: <Zap className="w-4 h-4 text-amber-400" />,
      color: 'hover:border-amber-500/50 hover:bg-amber-950/40 text-amber-300',
      desc: '3x Order Rate',
    },
    {
      id: 'riders_offline',
      label: 'Riders Offline',
      icon: <UserX className="w-4 h-4 text-rose-400" />,
      color: 'hover:border-rose-500/50 hover:bg-rose-950/40 text-rose-300',
      desc: '3 Riders Drop Out',
    },
    {
      id: 'stockout',
      label: 'Stockout',
      icon: <PackageX className="w-4 h-4 text-purple-400" />,
      color: 'hover:border-purple-500/50 hover:bg-purple-950/40 text-purple-300',
      desc: 'Top 5 SKUs zeroed',
    },
    {
      id: 'cancel_burst',
      label: 'Cancel Burst',
      icon: <XCircle className="w-4 h-4 text-red-400" />,
      color: 'hover:border-red-500/50 hover:bg-red-950/40 text-red-300',
      desc: '10% Active Cancel',
    },
    {
      id: 'clear_weather',
      label: 'Clear Weather',
      icon: <Sun className="w-4 h-4 text-emerald-400" />,
      color: 'hover:border-emerald-500/50 hover:bg-emerald-950/40 text-emerald-300',
      desc: 'Reset Weather',
    },
  ];

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 shadow-lg">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono flex items-center space-x-1.5">
          <span>⚡ Live Scenario Stress-Test Controls</span>
        </span>
        <span className="text-[10px] text-slate-500">
          Applies to both worlds simultaneously
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
        {scenarios.map((sc) => {
          const isActive = activeScenario === sc.id;
          return (
            <button
              key={sc.id}
              onClick={() => onTriggerScenario(sc.id)}
              className={`p-2 rounded-lg border text-left transition-all active:scale-95 flex flex-col justify-between ${
                isActive
                  ? 'bg-slate-800 border-emerald-500/80 shadow-md ring-1 ring-emerald-500/40'
                  : 'bg-slate-950/60 border-slate-800/80 ' + sc.color
              }`}
            >
              <div className="flex items-center space-x-1.5 mb-1">
                {sc.icon}
                <span className="text-xs font-bold font-mono">{sc.label}</span>
              </div>
              <span className="text-[10px] text-slate-400 font-sans leading-tight">
                {sc.desc}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
