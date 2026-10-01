import React, { useMemo, useState } from 'react';
import { EventPayload } from '../types';
import { formatClock } from '../lib/format';
import { WORLDS } from '../lib/theme';
import { Empty } from './ui';

const KIND: Record<string, { label: string; cls: string }> = {
  ORDER_DELIVERED: { label: 'Delivered', cls: 'text-good' },
  ORDER_DELIVERED_LATE: { label: 'Late', cls: 'text-bad' },
  ORDER_REASSIGNED: { label: 'Reassigned', cls: 'text-plum' },
  ORDER_REROUTED: { label: 'Re-routed', cls: 'text-plum' },
  ORDER_STRANDED: { label: 'Stranded', cls: 'text-warn' },
  ORDER_HANDOVER: { label: 'Handover', cls: 'text-plum' },
  ORDER_FAILED: { label: 'Failed', cls: 'text-bad' },
  ORDER_REJECTED: { label: 'Rejected', cls: 'text-warn' },
  ORDER_PLACED: { label: 'New order', cls: 'text-brand' },
  ORDERS_PLACED: { label: 'Arrivals', cls: 'text-dim' },
  FORECAST_SURGE: { label: 'Forecast', cls: 'text-warn' },
  FORECAST_NORMAL: { label: 'Forecast', cls: 'text-mute' },
  SYSTEM_RESET: { label: 'Reset', cls: 'text-brand' },
};
const kindOf = (k: string) => KIND[k] ?? (k.startsWith('SCENARIO') ? { label: 'Disruption', cls: 'text-jam' } : { label: k.toLowerCase(), cls: 'text-mute' });

type Filter = 'all' | 'swarm' | 'baseline' | 'naive';

/** Strip the leading emoji the server adds; the colored label carries the meaning here. */
const clean = (msg: string) => msg.replace(/^[^\p{L}\p{N}]+/u, '');

export const EventFeed: React.FC<{ events: EventPayload[]; className?: string }> = ({ events, className = '' }) => {
  const [filter, setFilter] = useState<Filter>('all');
  const [arrivals, setArrivals] = useState(false);

  const shown = useMemo(() => {
    const out: EventPayload[] = [];
    for (let i = events.length - 1; i >= 0 && out.length < 120; i--) {
      const e = events[i];
      if (!arrivals && e.kind === 'ORDERS_PLACED') continue;
      if (filter !== 'all' && e.world !== filter && e.world !== 'all' && e.world !== 'both') continue;
      out.push(e);
    }
    return out;
  }, [events, filter, arrivals]);

  return (
    <section className={`panel flex min-h-0 flex-col ${className}`} aria-label="Event feed">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
        <h2 className="font-display text-[15px] font-bold">What just happened</h2>
        <div className="flex items-center gap-1.5">
          <div className="seg" role="group" aria-label="Filter events">
            {(['all', 'swarm', 'baseline', 'naive'] as Filter[]).map(f => (
              <button key={f} aria-pressed={filter === f} onClick={() => setFilter(f)} className="!h-7 !px-2 !text-[11.5px]">
                {f === 'all' ? 'All' : WORLDS[f].label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setArrivals(a => !a)}
            aria-pressed={arrivals}
            className={`h-7 rounded-lg border px-2 text-[11.5px] transition-colors ${arrivals ? 'border-edge bg-lift text-ink' : 'border-line text-dim hover:text-mute'}`}
            title="Show or hide the order-arrival lines"
          >
            Arrivals
          </button>
        </div>
      </div>
      <ol className="min-h-0 flex-1 overflow-y-auto px-2 py-1.5">
        {shown.length === 0 && <Empty title="Quiet so far" hint="Press Play. Deliveries, late orders, re-plans and disruptions appear here, newest first." />}
        {shown.map((e, i) => {
          const k = kindOf(e.kind);
          const w = e.world === 'swarm' || e.world === 'baseline' || e.world === 'naive' ? e.world : null;
          return (
            <li key={`${e.simTime}-${e.kind}-${events.length - i}`} className={`grid grid-cols-[38px_74px_1fr] items-baseline gap-2 rounded-lg px-2 py-1.5 text-[12px] ${i === 0 ? 'animate-fade' : ''} hover:bg-raise`}>
              <span className="num font-mono text-2xs text-dim">{formatClock(e.simTime)}</span>
              <span className={`flex items-center gap-1.5 truncate font-medium ${k.cls}`}>
                {w && <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: WORLDS[w].hex }} title={WORLDS[w].label} />}
                {k.label}
              </span>
              <span className="min-w-0 text-mute">{clean(e.message)}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
};
