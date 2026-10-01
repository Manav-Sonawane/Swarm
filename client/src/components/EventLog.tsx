import React, { useRef, useEffect } from 'react';
import { EventPayload } from '../types';
import { formatSimTime } from '../lib/format';
import { Terminal, ShieldAlert, Package, Zap } from 'lucide-react';

interface EventLogProps {
  events: EventPayload[];
}

export const EventLog: React.FC<EventLogProps> = ({ events }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events]);

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 shadow-lg flex flex-col h-48 font-mono text-xs">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
        <div className="flex items-center space-x-2 text-slate-300">
          <Terminal className="w-4 h-4 text-emerald-400" />
          <span className="font-bold">Real-Time Simulation Event Feed</span>
        </div>
        <span className="text-[10px] text-slate-500">
          Showing last {events.length} events
        </span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
        {events.length === 0 ? (
          <div className="text-slate-500 text-center py-6 text-[11px]">
            Simulation event log active. Events will stream here in real time...
          </div>
        ) : (
          events.map((evt, idx) => {
            let badgeColor = 'text-slate-400 border-slate-700 bg-slate-800';
            if (evt.kind.includes('SCENARIO')) {
              badgeColor = 'text-amber-400 border-amber-500/40 bg-amber-950/60 animate-pulse';
            } else if (evt.kind.includes('ORDERS')) {
              badgeColor = 'text-sky-400 border-sky-500/40 bg-sky-950/60';
            } else if (evt.kind.includes('RESET')) {
              badgeColor = 'text-emerald-400 border-emerald-500/40 bg-emerald-950/60';
            }

            return (
              <div
                key={idx}
                className="flex items-start space-x-2.5 p-1.5 rounded bg-slate-950/80 border border-slate-800/60 hover:border-slate-700 transition-all text-[11px]"
              >
                <span className="text-slate-500 shrink-0 select-none">
                  [{formatSimTime(evt.simTime)}]
                </span>
                <span className={`px-1.5 py-0.2 rounded border text-[9px] uppercase font-bold shrink-0 ${badgeColor}`}>
                  {evt.kind}
                </span>
                <span className="text-slate-200 leading-snug flex-1">
                  {evt.message}
                </span>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};
