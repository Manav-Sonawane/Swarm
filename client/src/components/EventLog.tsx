import React from 'react';
import { EventPayload } from '../types';
import { formatSimTime } from '../lib/format';
import { Terminal } from 'lucide-react';

interface EventLogProps {
  events: EventPayload[];
}

// Badge text + colour per event kind; unknown kinds fall back to grey with the raw kind
const KIND_STYLE: Record<string, { label: string; className: string }> = {
  ORDER_DELIVERED: { label: 'Delivered', className: 'text-emerald-400 border-emerald-500/40 bg-emerald-950/60' },
  ORDER_DELIVERED_LATE: { label: 'Delivered Late', className: 'text-rose-400 border-rose-500/40 bg-rose-950/60' },
  ORDER_REJECTED: { label: 'Rejected', className: 'text-orange-400 border-orange-500/40 bg-orange-950/60' },
  ORDER_FAILED: { label: 'Failed', className: 'text-red-400 border-red-500/50 bg-red-950/70' },
  ORDERS_PLACED: { label: 'Placed', className: 'text-sky-400 border-sky-500/40 bg-sky-950/60' },
  SYSTEM_RESET: { label: 'Reset', className: 'text-emerald-400 border-emerald-500/40 bg-emerald-950/60' },
};

const WORLD_STYLE: Record<string, { label: string; className: string }> = {
  baseline: { label: 'Baseline', className: 'text-slate-300 border-slate-600 bg-slate-800' },
  swarm: { label: 'Swarm', className: 'text-teal-300 border-teal-600/50 bg-teal-950/60' },
};

export const EventLog: React.FC<EventLogProps> = ({ events }) => {
  // Newest first, so new events appear at the top without scrolling the page
  const ordered = [...events].reverse();

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 shadow-lg flex flex-col h-48 font-mono text-xs">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
        <div className="flex items-center space-x-2 text-slate-300">
          <Terminal className="w-4 h-4 text-emerald-400" />
          <span className="font-bold">Real-Time Simulation Event Feed</span>
        </div>
        <span className="text-[10px] text-slate-500">
          Showing last {events.length} events · newest first
        </span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
        {ordered.length === 0 ? (
          <div className="text-slate-500 text-center py-6 text-[11px]">
            Simulation event log active. Events will stream here in real time...
          </div>
        ) : (
          ordered.map((evt, idx) => {
            const kind = KIND_STYLE[evt.kind] ??
              (evt.kind.includes('SCENARIO')
                ? { label: evt.kind, className: 'text-amber-400 border-amber-500/40 bg-amber-950/60' }
                : { label: evt.kind, className: 'text-slate-400 border-slate-700 bg-slate-800' });
            const world = WORLD_STYLE[evt.world];

            return (
              <div
                key={`${evt.simTime}-${evt.kind}-${events.length - idx}`}
                className="flex items-start space-x-2.5 p-1.5 rounded bg-slate-950/80 border border-slate-800/60 hover:border-slate-700 transition-all text-[11px]"
              >
                <span className="text-slate-500 shrink-0 select-none">
                  [{formatSimTime(evt.simTime)}]
                </span>
                <span className={`px-1.5 py-0.2 rounded border text-[9px] uppercase font-bold shrink-0 ${kind.className}`}>
                  {kind.label}
                </span>
                {world && (
                  <span className={`px-1.5 py-0.2 rounded border text-[9px] uppercase font-bold shrink-0 ${world.className}`}>
                    {world.label}
                  </span>
                )}
                <span className="text-slate-200 leading-snug flex-1">
                  {evt.message}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
