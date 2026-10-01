import React, { useMemo } from 'react';
import { Download } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Metrics, TickPayload, WorldName } from '../types';
import { WORLDS, WORLD_ORDER } from '../lib/theme';
import { formatClock } from '../lib/format';
import { Delta, Num, SectionTitle } from './ui';

type Row = { label: string; hint: string; get: (m: Metrics) => number; fmt: (v: number) => string; better: 'high' | 'low' | 'none' };

const fmtN = (d: number, suf = '') => (v: number) => `${v.toFixed(d)}${suf}`;
const ROWS: { group: string; rows: Row[] }[] = [
  {
    group: 'Reliability',
    rows: [
      { label: 'On-time rate', hint: 'Delivered within the promise, out of every decided order', get: m => m.onTimeRate, fmt: fmtN(1, '%'), better: 'high' },
      { label: 'P90 lateness', hint: '9 in 10 orders are no later than this', get: m => m.p90LatenessSec / 60, fmt: fmtN(1, ' min'), better: 'low' },
      { label: 'Worst lateness', hint: 'The single latest order', get: m => m.maxLatenessSec / 60, fmt: fmtN(1, ' min'), better: 'low' },
      { label: 'Late right now', hint: 'Open orders past, or projected past, their promise', get: m => m.lateNow, fmt: fmtN(0), better: 'low' },
      { label: 'Failed', hint: 'Orders that could not be delivered', get: m => m.ordersFailed, fmt: fmtN(0), better: 'low' },
    ],
  },
  {
    group: 'Speed & efficiency',
    rows: [
      { label: 'Delivered', hint: 'Orders delivered so far', get: m => m.delivered, fmt: fmtN(0), better: 'high' },
      { label: 'Avg delivery time', hint: 'Order to door', get: m => m.avgDeliverySec / 60, fmt: fmtN(1, ' min'), better: 'low' },
      { label: 'P90 delivery time', hint: 'Order to door, 90th percentile', get: m => m.p90DeliverySec / 60, fmt: fmtN(1, ' min'), better: 'low' },
      { label: 'Orders per trip', hint: 'Batching', get: m => m.ordersPerTrip, fmt: fmtN(2), better: 'high' },
      { label: 'Km per order', hint: 'Rider kilometres per delivered order', get: m => m.kmPerOrder, fmt: fmtN(2, ' km'), better: 'low' },
      { label: 'Rider utilization', hint: 'Share of time riders are busy', get: m => m.utilization, fmt: fmtN(1, '%'), better: 'none' },
      { label: 'Fairness (std-dev)', hint: 'Spread of deliveries per rider; lower is more even', get: m => m.fairnessStdDev, fmt: fmtN(2), better: 'low' },
    ],
  },
  {
    group: 'Adaptation & compute',
    rows: [
      { label: 'Reassignments', hint: 'Orders moved to a better rider before pickup', get: m => m.reassignments, fmt: fmtN(0), better: 'none' },
      { label: 'In-flight re-routes', hint: 'Drop orders re-sequenced on the road', get: m => m.reroutes ?? 0, fmt: fmtN(0), better: 'none' },
      { label: 'Roadside handovers', hint: 'Goods collected after a rider dropped out', get: m => m.handovers ?? 0, fmt: fmtN(0), better: 'none' },
      { label: 'Decision time (avg)', hint: 'Wall-clock per allocator call', get: m => m.decisionMsAvg, fmt: fmtN(2, ' ms'), better: 'none' },
      { label: 'Decision time (max)', hint: 'Slowest allocator call; budget is 200 ms', get: m => m.decisionMsMax, fmt: fmtN(1, ' ms'), better: 'none' },
    ],
  },
];

const metricsOf = (tick: TickPayload): Record<WorldName, Metrics> => ({
  swarm: tick.worlds.swarm.metrics,
  baseline: tick.worlds.baseline.metrics,
  naive: tick.worlds.naive?.metrics ?? tick.worlds.baseline.metrics,
});

const axis = { stroke: 'rgb(var(--line))', tick: { fill: 'rgb(var(--dim))', fontSize: 11, fontFamily: 'Geist Mono' } };

const ChartTip: React.FC<{ active?: boolean; payload?: { dataKey: string; value: number }[]; label?: number; unit: string; decimals: number }> = ({ active, payload, label, unit, decimals }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-edge bg-raise px-3 py-2 text-xs shadow-xl">
      <div className="num mb-1 font-mono text-dim">{formatClock(label ?? 0)}</div>
      {WORLD_ORDER.map(w => {
        const p = payload.find(x => x.dataKey === w);
        if (!p) return null;
        return (
          <div key={w} className="flex items-center justify-between gap-4">
            <span className="inline-flex items-center gap-1.5 text-mute"><span className="h-2 w-2 rounded-full" style={{ background: WORLDS[w].hex }} />{WORLDS[w].label}</span>
            <span className="num font-mono text-ink">{p.value.toFixed(decimals)}{unit}</span>
          </div>
        );
      })}
    </div>
  );
};

const Legend: React.FC = () => (
  <div className="flex items-center gap-3 text-[11.5px] text-mute">
    {WORLD_ORDER.map(w => (
      <span key={w} className="inline-flex items-center gap-1.5"><span className="h-[3px] w-3.5 rounded" style={{ background: WORLDS[w].hex }} />{WORLDS[w].label}</span>
    ))}
  </div>
);

const HistoryChart: React.FC<{ m: Record<WorldName, Metrics>; field: 'onTimeRate' | 'packingQueueDepth'; unit: string; decimals: number; domain?: [number, number] }> = ({ m, field, unit, decimals, domain }) => {
  const data = useMemo(() => {
    const byT = new Map<number, Record<string, number>>();
    for (const w of WORLD_ORDER) for (const h of m[w].history) {
      const row = byT.get(h.t) ?? { t: h.t };
      row[w] = h[field];
      byT.set(h.t, row);
    }
    return [...byT.values()].sort((a, b) => a.t - b.t);
  }, [m, field]);
  if (data.length < 2) return <div className="grid h-[220px] place-items-center text-[12.5px] text-dim">The chart fills in as the run plays.</div>;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <CartesianGrid stroke="rgb(var(--line))" strokeOpacity={0.6} vertical={false} />
        <XAxis dataKey="t" {...axis} tickFormatter={formatClock} minTickGap={40} />
        <YAxis {...axis} domain={domain ?? ['auto', 'auto']} width={44} tickFormatter={v => `${v}${unit === '%' ? '%' : ''}`} />
        <Tooltip content={<ChartTip unit={unit} decimals={decimals} />} cursor={{ stroke: 'rgb(var(--edge))', strokeWidth: 1 }} isAnimationActive={false} />
        {WORLD_ORDER.map(w => (
          <Line key={w} dataKey={w} stroke={WORLDS[w].hex} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: 'rgb(var(--panel))' }} isAnimationActive={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
};

export const ResultsView: React.FC<{ tick: TickPayload }> = ({ tick }) => {
  const m = metricsOf(tick);
  const exportJson = () => {
    fetch('/api/export')
      .then(r => r.json())
      .then(data => {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `swarm-results-seed-${tick.seed}.json`;
        a.click();
        URL.revokeObjectURL(url);
      });
  };
  const lead = m.swarm.onTimeRate - m.baseline.onTimeRate;
  const p90 = (m.baseline.p90LatenessSec - m.swarm.p90LatenessSec) / 60;
  const km = m.baseline.kmPerOrder - m.swarm.kmPerOrder;

  return (
    <div className="screen h-full overflow-y-auto">
      <div className="mx-auto max-w-[1400px] space-y-3 p-3 lg:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="eyebrow">Seed {tick.seed} · {formatClock(tick.simTime)} · same orders and disruptions for all three</div>
            <h1 className="mt-1 font-display text-[26px] font-extrabold tracking-[-0.02em]">Results</h1>
          </div>
          <button className="btn" onClick={exportJson}><Download size={15} /> Export JSON</button>
        </div>

        {/* Headline numbers */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="panel p-4">
            <div className="eyebrow">On-time rate, Swarm vs Baseline</div>
            <div className="mt-2 flex items-baseline gap-2">
              <Num value={m.swarm.onTimeRate} decimals={1} suffix="%" className="font-display text-[34px] font-extrabold" />
              <span className="num font-mono text-mute">vs {m.baseline.onTimeRate.toFixed(1)}%</span>
            </div>
            <div className="mt-1"><Delta diff={lead} higherIsBetter unit=" pts" /></div>
          </div>
          <div className="panel p-4">
            <div className="eyebrow">P90 lateness, Swarm vs Baseline</div>
            <div className="mt-2 flex items-baseline gap-2">
              <Num value={m.swarm.p90LatenessSec / 60} decimals={1} suffix=" min" className="font-display text-[34px] font-extrabold" />
              <span className="num font-mono text-mute">vs {(m.baseline.p90LatenessSec / 60).toFixed(1)} min</span>
            </div>
            <div className="mt-1"><Delta diff={-p90} higherIsBetter={false} unit=" min" /></div>
          </div>
          <div className="panel p-4">
            <div className="eyebrow">Km per order, Swarm vs Baseline</div>
            <div className="mt-2 flex items-baseline gap-2">
              <Num value={m.swarm.kmPerOrder} decimals={2} suffix=" km" className="font-display text-[34px] font-extrabold" />
              <span className="num font-mono text-mute">vs {m.baseline.kmPerOrder.toFixed(2)} km</span>
            </div>
            <div className="mt-1"><Delta diff={-km} higherIsBetter={false} unit=" km" decimals={2} /></div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          <div className="panel p-4">
            <SectionTitle eyebrow="Cumulative, every 10 sim-seconds" title="On-time rate over time" right={<Legend />} />
            <div className="mt-3"><HistoryChart m={m} field="onTimeRate" unit="%" decimals={1} domain={[0, 100]} /></div>
          </div>
          <div className="panel p-4">
            <SectionTitle eyebrow="Orders waiting or being packed, all stores" title="Packing queue" right={<Legend />} />
            <div className="mt-3"><HistoryChart m={m} field="packingQueueDepth" unit="" decimals={0} /></div>
          </div>
        </div>

        {/* Full table */}
        <div className="panel overflow-x-auto p-4">
          <SectionTitle eyebrow="Best value in each row in bold" title="All metrics" />
          <table className="mt-3 w-full min-w-[560px] text-[13px]">
            <thead>
              <tr className="text-left">
                <th className="w-[38%] pb-2 font-normal"><span className="eyebrow">Metric</span></th>
                {WORLD_ORDER.map(w => (
                  <th key={w} className="pb-2 text-right font-medium">
                    <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: WORLDS[w].hex }} />{WORLDS[w].label}</span>
                  </th>
                ))}
              </tr>
            </thead>
            {ROWS.map(g => (
              <tbody key={g.group}>
                <tr><td colSpan={4} className="pb-1 pt-4"><span className="eyebrow">{g.group}</span></td></tr>
                {g.rows.map(r => {
                  const vals = WORLD_ORDER.map(w => r.get(m[w]));
                  const best = r.better === 'high' ? Math.max(...vals) : r.better === 'low' ? Math.min(...vals) : NaN;
                  return (
                    <tr key={r.label} className="border-t border-line/70" title={r.hint}>
                      <td className="py-2 text-mute">{r.label}</td>
                      {vals.map((v, i) => (
                        <td key={i} className={`num py-2 text-right font-mono ${Math.abs(v - best) < 1e-9 ? 'font-semibold text-ink' : 'text-mute'}`}>{r.fmt(v)}</td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            ))}
          </table>
        </div>

        {/* Order mix */}
        <div className="panel p-4">
          <SectionTitle eyebrow="Classified once, identical in every world" title="Order mix" />
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-4">
            {([
              ['Express (10 min)', m.swarm.ordersByClass.express],
              ['Regular (20 min)', m.swarm.ordersByClass.regular],
              ['Extended (30 min)', Math.max(0, m.swarm.ordersByClass.infeasible - m.swarm.ordersRejected)],
              ['Outside service area', m.swarm.ordersRejected],
            ] as [string, number][]).map(([l, n]) => (
              <div key={l} className="rounded-xl border border-line bg-bg/60 p-3">
                <div className="eyebrow">{l}</div>
                <div className="num mt-1 font-display text-[22px] font-bold">{n}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
