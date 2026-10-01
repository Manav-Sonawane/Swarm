import React, { useRef, useEffect } from 'react';
import { EventPayload } from '../types';
import { formatSimTime } from '../lib/format';
import { Terminal, PackageCheck, Truck, AlertOctagon, CheckCircle2, XCircle, RefreshCcw, Zap, CloudRain, Package } from 'lucide-react';

interface EventLogProps {
  events: EventPayload[];
}

interface KindConfig { label: string; className: string; icon: React.ReactNode }

const KIND_CONFIG: Record<string, KindConfig> = {
  ORDER_PLACED:         { label: 'Placed',        className: 'text-sky-400    border-sky-500/40    bg-sky-950/60',    icon: <Package className="w-3 h-3" /> },
  ORDERS_PLACED:        { label: 'Placed (batch)', className: 'text-sky-400    border-sky-500/40    bg-sky-950/60',    icon: <Package className="w-3 h-3" /> },
  ORDER_ASSIGNED:       { label: 'Assigned',       className: 'text-indigo-400 border-indigo-500/40 bg-indigo-950/60', icon: <Truck className="w-3 h-3" /> },
  ORDER_BATCHED:        { label: 'Batched',        className: 'text-teal-400   border-teal-500/40   bg-teal-950/60',   icon: <PackageCheck className="w-3 h-3" /> },
  ORDER_REASSIGNED:     { label: 'Reassigned',     className: 'text-purple-400 border-purple-500/40 bg-purple-950/60', icon: <RefreshCcw className="w-3 h-3" /> },
  ORDER_AT_RISK:        { label: 'At Risk',        className: 'text-amber-400  border-amber-500/40  bg-amber-950/60',  icon: <AlertOctagon className="w-3 h-3" /> },
  ORDER_DELIVERED:      { label: 'Delivered',      className: 'text-emerald-400 border-emerald-500/40 bg-emerald-950/60', icon: <CheckCircle2 className="w-3 h-3" /> },
  ORDER_DELIVERED_LATE: { label: 'Late!',          className: 'text-rose-400   border-rose-500/40   bg-rose-950/60',   icon: <AlertOctagon className="w-3 h-3" /> },
  ORDER_REJECTED:       { label: 'Rejected',       className: 'text-orange-400 border-orange-500/40 bg-orange-950/60', icon: <XCircle className="w-3 h-3" /> },
  ORDER_FAILED:         { label: 'Failed',         className: 'text-red-400    border-red-500/50    bg-red-950/70',    icon: <XCircle className="w-3 h-3" /> },
  ORDER_CANCELLED:      { label: 'Cancelled',      className: 'text-slate-400  border-slate-600     bg-slate-800',     icon: <XCircle className="w-3 h-3" /> },
  SYSTEM_RESET:         { label: 'Reset',          className: 'text-cyan-400   border-cyan-500/40   bg-cyan-950/60',   icon: <RefreshCcw className="w-3 h-3" /> },
};

const SCENARIO_KINDS: Record<string, KindConfig> = {
  SCENARIO_MONSOON:         { label: 'Monsoon',       className: 'text-blue-300    border-blue-500/40   bg-blue-950/60',   icon: <CloudRain className="w-3 h-3" /> },
  SCENARIO_SPIKE:           { label: 'IPL Spike',     className: 'text-amber-300   border-amber-500/40  bg-amber-950/60',  icon: <Zap className="w-3 h-3" /> },
  SCENARIO_RIDERS_OFFLINE:  { label: 'Riders Offline',className: 'text-rose-300    border-rose-500/40   bg-rose-950/60',   icon: <AlertOctagon className="w-3 h-3" /> },
  SCENARIO_CANCEL:          { label: 'Cancel Burst',  className: 'text-orange-300  border-orange-500/40 bg-orange-950/60', icon: <XCircle className="w-3 h-3" /> },
  SCENARIO_STORE_OFFLINE:   { label: 'Store Offline', className: 'text-rose-300    border-rose-500/40   bg-rose-950/60',   icon: <AlertOctagon className="w-3 h-3" /> },
  SCENARIO_CLEAR:           { label: 'All Clear',     className: 'text-emerald-300 border-emerald-500/40 bg-emerald-950/60', icon: <RefreshCcw className="w-3 h-3" /> },
  FORECAST_SURGE:           { label: 'Surge Forecast', className: 'text-orange-300 border-orange-500/40 bg-orange-950/60', icon: <Zap className="w-3 h-3" /> },
  FORECAST_NORMAL:          { label: 'Demand Normal', className: 'text-slate-300   border-slate-600     bg-slate-800',     icon: <Zap className="w-3 h-3" /> },
  SCENARIO_STOCKOUT:        { label: 'Stock-Out',     className: 'text-red-300     border-red-500/40    bg-red-950/60',    icon: <XCircle className="w-3 h-3" /> },
};

const WORLD_STYLE: Record<string, string> = {
  baseline: 'text-slate-300 border-slate-600 bg-slate-800',
  swarm:    'text-teal-300 border-teal-600/50 bg-teal-950/60',
  naive:    'text-slate-500 border-slate-700 bg-slate-900',
  both:     'text-indigo-300 border-indigo-600/50 bg-indigo-950/60',
  all:      'text-indigo-300 border-indigo-600/50 bg-indigo-950/60',
};

function getKindConfig(kind: string): KindConfig {
  if (KIND_CONFIG[kind]) return KIND_CONFIG[kind];
  for (const [k, v] of Object.entries(SCENARIO_KINDS)) {
    if (kind.toUpperCase().includes(k.replace('SCENARIO_', ''))) return v;
  }
  if (kind.includes('SCENARIO')) return { label: kind.replace('SCENARIO_','').toLowerCase(), className: 'text-amber-400 border-amber-500/40 bg-amber-950/60', icon: <Zap className="w-3 h-3" /> };
  return { label: kind, className: 'text-slate-400 border-slate-700 bg-slate-800', icon: null };
}

export const EventLog: React.FC<EventLogProps> = ({ events }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const ordered = [...events].reverse();

  // Auto-scroll to top when new events arrive (newest first)
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [events.length]);

  return (
    <div className="glass-medium border border-white/10 rounded-2xl p-4 shadow-glass-md flex flex-col font-mono text-xs transition-all duration-300 relative overflow-hidden" style={{ height: '230px' }}>
      {/* Top sheen */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.08] pb-2.5 mb-2.5 shrink-0">
        <div className="flex items-center gap-2 text-slate-200">
          <Terminal className="w-3.5 h-3.5 text-cyan-accent" />
          <span className="text-[0.8rem] font-bold tracking-[-0.01em]" style={{ fontFamily: 'var(--font-primary)' }}>Real-Time Event Feed</span>
          <span className="text-[9px] font-bold font-mono text-cyan-300 bg-cyan-950/60 border border-cyan-400/30 px-2 py-0.5 rounded-full shadow-[0_0_10px_rgba(6,182,212,0.3)] animate-pulse tracking-wider uppercase">
            LIVE
          </span>
        </div>
        <span className="text-[10px] text-slate-500 font-mono">{events.length} events · newest first</span>
      </div>

      {/* Event list */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-1.5 pr-1">
        {ordered.length === 0 ? (
          <div className="text-slate-400 text-center py-8 text-[11px]">
            Simulation event log active. Events will stream here when the sim is running…
          </div>
        ) : (
          ordered.map((evt, idx) => {
            const kind = getKindConfig(evt.kind);
            const worldCls = WORLD_STYLE[evt.world] ?? 'text-slate-400 border-white/10 bg-white/[0.04]';

            return (
              <div
                key={`${evt.simTime}-${evt.kind}-${idx}`}
                className="flex items-start space-x-2.5 p-2 rounded-xl glass-light border border-white/10 hover:border-violet-400/30 hover:bg-white/[0.06] transition-all duration-200 text-[11px]"
              >
                {/* Timestamp */}
                <span className="text-slate-400 shrink-0 select-none tabular-nums font-mono">[{formatSimTime(evt.simTime)}]</span>

                {/* Kind badge */}
                <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full border text-[9px] uppercase font-bold shrink-0 shadow-sm ${kind.className}`}>
                  {kind.icon}
                  <span>{kind.label}</span>
                </span>

                {/* World badge — only for single-world events */}
                {evt.world !== 'both' && evt.world !== 'all' && (
                  <span className={`px-2 py-0.5 rounded-full border text-[9px] uppercase font-bold shrink-0 ${worldCls}`}>
                    {evt.world}
                  </span>
                )}

                {/* Message */}
                <span className="text-slate-200 leading-snug flex-1 min-w-0">{evt.message}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};