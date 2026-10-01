import React from 'react';
import { CloudRain, Zap, UserX, Store, PackageX, XCircle, SunMedium, ShieldAlert } from 'lucide-react';
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
    activeColor: string;
    desc: string;
  }[] = [
    {
      id: 'monsoon',
      label: 'Monsoon Rain',
      icon: <CloudRain className="w-4 h-4 text-sky-400" />,
      color: 'hover:border-sky-500/50 hover:bg-sky-950/40 text-sky-300',
      activeColor: 'bg-sky-950/80 border-sky-500 text-sky-200 ring-1 ring-sky-500/50 shadow-sky-500/20',
      desc: 'Traffic 1.5x / ETAs +50%',
    },
    {
      id: 'spike',
      label: 'IPL Spike',
      icon: <Zap className="w-4 h-4 text-amber-400" />,
      color: 'hover:border-amber-500/50 hover:bg-amber-950/40 text-amber-300',
      activeColor: 'bg-amber-950/80 border-amber-500 text-amber-200 ring-1 ring-amber-500/50 shadow-amber-500/20',
      desc: '3x Orders for 5 min',
    },
    {
      id: 'store_offline',
      label: 'Store Offline',
      icon: <Store className="w-4 h-4 text-rose-400" />,
      color: 'hover:border-rose-500/50 hover:bg-rose-950/40 text-rose-300',
      activeColor: 'bg-rose-950/80 border-rose-500 text-rose-200 ring-1 ring-rose-500/50 shadow-rose-500/20',
      desc: 'Power cut, auto failover',
    },
    {
      id: 'riders_offline',
      label: 'Riders Offline',
      icon: <UserX className="w-4 h-4 text-orange-400" />,
      color: 'hover:border-orange-500/50 hover:bg-orange-950/40 text-orange-300',
      activeColor: 'bg-orange-950/80 border-orange-500 text-orange-200 ring-1 ring-orange-500/50 shadow-orange-500/20',
      desc: '3 active riders drop out',
    },
    {
      id: 'stockout',
      label: 'SKU Stockout',
      icon: <PackageX className="w-4 h-4 text-purple-400" />,
      color: 'hover:border-purple-500/50 hover:bg-purple-950/40 text-purple-300',
      activeColor: 'bg-purple-950/80 border-purple-500 text-purple-200 ring-1 ring-purple-500/50 shadow-purple-500/20',
      desc: 'Top 5 SKUs show out of stock',
    },
    {
      id: 'cancel_burst',
      label: 'Cancel Burst',
      icon: <XCircle className="w-4 h-4 text-red-400" />,
      color: 'hover:border-red-500/50 hover:bg-red-950/40 text-red-300',
      activeColor: 'bg-red-950/80 border-red-500 text-red-200 ring-1 ring-red-500/50 shadow-red-500/20',
      desc: '10% live orders cancel',
    },
    {
      id: 'clear',
      label: 'Clear All',
      icon: <SunMedium className="w-4 h-4 text-emerald-400" />,
      color: 'hover:border-emerald-500/50 hover:bg-emerald-950/40 text-emerald-300',
      activeColor: 'bg-emerald-950/80 border-emerald-500 text-emerald-200 ring-1 ring-emerald-500/50 shadow-emerald-500/20',
      desc: 'Restore stores & weather',
    },
  ];

  return (
    <div className="glass-medium border border-white/10 rounded-2xl p-4 shadow-glass-md transition-all duration-300">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <ShieldAlert className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-200 font-mono">
            Live Scenario Stress-Test Suite
          </span>
          {activeScenario && activeScenario !== 'normal' && (
            <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/40 shadow-[0_0_12px_rgba(245,158,11,0.3)] animate-pulse">
              Active: {activeScenario.toUpperCase()}
            </span>
          )}
        </div>
        <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
          Seeded multi-world synchronized injection
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5">
        {scenarios.map((sc) => {
          const isActive = activeScenario === sc.id || (sc.id === 'clear' && activeScenario === 'normal');
          return (
            <button
              key={sc.id}
              onClick={() => onTriggerScenario(sc.id)}
              className={`p-3 rounded-xl border text-left transition-all duration-300 active:scale-95 flex flex-col justify-between group ${
                isActive
                  ? 'bg-gradient-to-br from-violet-900/60 via-purple-900/40 to-slate-900/80 border-violet-400/60 text-white ring-1 ring-violet-400/40 shadow-[0_0_20px_rgba(124,58,237,0.35)]'
                  : 'glass-light border-white/10 text-slate-300 hover:text-white hover:border-violet-400/30 hover:shadow-[0_0_15px_rgba(124,58,237,0.2)] hover:-translate-y-0.5'
              }`}
            >
              <div className="flex items-center space-x-2 mb-1.5">
                <span className="transition-transform duration-300 group-hover:scale-110">{sc.icon}</span>
                <span className="text-xs font-bold font-mono truncate">{sc.label}</span>
              </div>
              <span className="text-[10px] text-slate-400 group-hover:text-lavender-200/80 font-sans leading-tight line-clamp-1">
                {sc.desc}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

