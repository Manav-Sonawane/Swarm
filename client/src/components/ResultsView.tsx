import React, { useState } from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip,
  BarChart, Bar, ReferenceLine,
} from 'recharts';
import { Metrics } from '../types';
import { formatDuration } from '../lib/format';
import {
  Trophy, CheckCircle2, Clock, TrendingUp, Navigation,
  BarChart2, Scale, ChevronDown, ChevronUp, Timer
} from 'lucide-react';

interface ResultsViewProps {
  baselineMetrics: Metrics;
  swarmMetrics: Metrics;
  naiveMetrics: Metrics;
}

// ─── helpers ───────────────────────────────────────────────────────────
function winnerCls(val: number, vals: number[], higherIsBetter: boolean): string {
  const best = higherIsBetter ? Math.max(...vals) : Math.min(...vals);
  return val === best ? 'text-emerald-400 font-black' : 'text-slate-300';
}

function Delta({ swarm, baseline, higherIsBetter = true }: { swarm: number; baseline: number; higherIsBetter?: boolean }) {
  const diff = swarm - baseline;
  if (Math.abs(diff) < 0.05) return <span className="text-slate-500 text-[10px]">—</span>;
  const isGood = higherIsBetter ? diff > 0 : diff < 0;
  const sign = diff > 0 ? '+' : '';
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isGood
      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
      : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'}`}>
      {sign}{diff.toFixed(1)}
    </span>
  );
}

function buildChartData(naive: Metrics, baseline: Metrics, swarm: Metrics) {
  const map = new Map<number, {
    time: string;
    naiveOnTime: number; baselineOnTime: number; swarmOnTime: number;
    naiveQueue: number;  baselineQueue: number;  swarmQueue: number;
  }>();

  const toTime = (t: number) => {
    const h = Math.floor((t / 3600) % 24);
    const m = Math.floor((t % 3600) / 60);
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  };

  const merge = (hist: Metrics['history'], key: 'naive' | 'baseline' | 'swarm') => {
    for (const h of hist) {
      if (!map.has(h.t)) {
        map.set(h.t, { time: toTime(h.t), naiveOnTime: 100, baselineOnTime: 100, swarmOnTime: 100, naiveQueue: 0, baselineQueue: 0, swarmQueue: 0 });
      }
      const e = map.get(h.t)!;
      const q = (h as { packingQueueDepth?: number }).packingQueueDepth ?? 0;
      if (key === 'naive')    { e.naiveOnTime    = h.onTimeRate; e.naiveQueue    = q; }
      if (key === 'baseline') { e.baselineOnTime = h.onTimeRate; e.baselineQueue = q; }
      if (key === 'swarm')    { e.swarmOnTime    = h.onTimeRate; e.swarmQueue    = q; }
    }
  };

  merge(naive.history, 'naive');
  merge(baseline.history, 'baseline');
  merge(swarm.history, 'swarm');

  return Array.from(map.values())
    .sort((a, b) => {
      const [ah, am] = a.time.split(':').map(Number);
      const [bh, bm] = b.time.split(':').map(Number);
      return (ah * 60 + am) - (bh * 60 + bm);
    })
    .slice(-40);
}

// ─── component ─────────────────────────────────────────────────────────
export const ResultsView: React.FC<ResultsViewProps> = ({ baselineMetrics, swarmMetrics, naiveMetrics }) => {
  const [open, setOpen] = useState<string | null>('reliability');
  const chartData = buildChartData(naiveMetrics, baselineMetrics, swarmMetrics);

  const swarmWins    = swarmMetrics.onTimeRate >= baselineMetrics.onTimeRate && swarmMetrics.onTimeRate >= naiveMetrics.onTimeRate;
  const baselineWins = !swarmWins && baselineMetrics.onTimeRate >= naiveMetrics.onTimeRate;
  const advantage    = swarmMetrics.onTimeRate - baselineMetrics.onTimeRate;

  const TT = { backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '11px', border: '1px solid #334155' };

  const sections: {
    id: string; label: string; icon: React.ReactNode;
    rows: { label: string; n: string; b: string; s: string; nr: number; br: number; sr: number; h: boolean }[];
  }[] = [
    {
      id: 'reliability', label: 'Reliability  (wins the demo)', icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
      rows: [
        { label: 'On-Time Rate',           n:`${naiveMetrics.onTimeRate}%`,                     b:`${baselineMetrics.onTimeRate}%`,                     s:`${swarmMetrics.onTimeRate}%`,                     nr:naiveMetrics.onTimeRate,                   br:baselineMetrics.onTimeRate,                   sr:swarmMetrics.onTimeRate,                   h:true  },
        { label: 'P90 Lateness',           n:formatDuration(naiveMetrics.p90LatenessSec??0),    b:formatDuration(baselineMetrics.p90LatenessSec??0),    s:formatDuration(swarmMetrics.p90LatenessSec??0),    nr:naiveMetrics.p90LatenessSec??0,            br:baselineMetrics.p90LatenessSec??0,            sr:swarmMetrics.p90LatenessSec??0,            h:false },
        { label: 'Max Lateness',           n:formatDuration(naiveMetrics.maxLatenessSec??0),    b:formatDuration(baselineMetrics.maxLatenessSec??0),    s:formatDuration(swarmMetrics.maxLatenessSec??0),    nr:naiveMetrics.maxLatenessSec??0,            br:baselineMetrics.maxLatenessSec??0,            sr:swarmMetrics.maxLatenessSec??0,            h:false },
        { label: 'Orders Failed',          n:`${naiveMetrics.ordersFailed??0}`,                 b:`${baselineMetrics.ordersFailed??0}`,                 s:`${swarmMetrics.ordersFailed??0}`,                 nr:naiveMetrics.ordersFailed??0,              br:baselineMetrics.ordersFailed??0,              sr:swarmMetrics.ordersFailed??0,              h:false },
        { label: 'Late / At-Risk Now',     n:`${naiveMetrics.lateNow}`,                         b:`${baselineMetrics.lateNow}`,                         s:`${swarmMetrics.lateNow}`,                         nr:naiveMetrics.lateNow,                      br:baselineMetrics.lateNow,                      sr:swarmMetrics.lateNow,                      h:false },
      ],
    },
    {
      id: 'speed', label: 'Speed', icon: <Clock className="w-4 h-4 text-sky-400" />,
      rows: [
        { label: 'Avg Delivery Time',      n:formatDuration(naiveMetrics.avgDeliverySec),       b:formatDuration(baselineMetrics.avgDeliverySec),       s:formatDuration(swarmMetrics.avgDeliverySec),       nr:naiveMetrics.avgDeliverySec,               br:baselineMetrics.avgDeliverySec,               sr:swarmMetrics.avgDeliverySec,               h:false },
        { label: 'P90 Delivery Time',      n:formatDuration(naiveMetrics.p90DeliverySec),       b:formatDuration(baselineMetrics.p90DeliverySec),       s:formatDuration(swarmMetrics.p90DeliverySec),       nr:naiveMetrics.p90DeliverySec,               br:baselineMetrics.p90DeliverySec,               sr:swarmMetrics.p90DeliverySec,               h:false },
        { label: 'Delivered',              n:`${naiveMetrics.delivered}`,                       b:`${baselineMetrics.delivered}`,                       s:`${swarmMetrics.delivered}`,                       nr:naiveMetrics.delivered,                    br:baselineMetrics.delivered,                    sr:swarmMetrics.delivered,                    h:true  },
      ],
    },
    {
      id: 'efficiency', label: 'Efficiency', icon: <Navigation className="w-4 h-4 text-amber-400" />,
      rows: [
        { label: 'Km per Order',           n:`${naiveMetrics.kmPerOrder} km`,                   b:`${baselineMetrics.kmPerOrder} km`,                   s:`${swarmMetrics.kmPerOrder} km`,                   nr:naiveMetrics.kmPerOrder,                   br:baselineMetrics.kmPerOrder,                   sr:swarmMetrics.kmPerOrder,                   h:false },
        { label: 'Total Km Driven',        n:`${naiveMetrics.kmTotal??0} km`,                   b:`${baselineMetrics.kmTotal??0} km`,                   s:`${swarmMetrics.kmTotal??0} km`,                   nr:naiveMetrics.kmTotal??0,                   br:baselineMetrics.kmTotal??0,                   sr:swarmMetrics.kmTotal??0,                   h:false },
        { label: 'Orders / Trip (Batch)',  n:`${naiveMetrics.ordersPerTrip}×`,                  b:`${baselineMetrics.ordersPerTrip}×`,                  s:`${swarmMetrics.ordersPerTrip}×`,                  nr:naiveMetrics.ordersPerTrip,                br:baselineMetrics.ordersPerTrip,                sr:swarmMetrics.ordersPerTrip,                h:true  },
        { label: 'Rider Utilization',      n:`${naiveMetrics.utilization}%`,                    b:`${baselineMetrics.utilization}%`,                    s:`${swarmMetrics.utilization}%`,                    nr:naiveMetrics.utilization,                  br:baselineMetrics.utilization,                  sr:swarmMetrics.utilization,                  h:true  },
        { label: 'Fairness Std-Dev (σ)',   n:`${naiveMetrics.fairnessStdDev}`,                  b:`${baselineMetrics.fairnessStdDev}`,                  s:`${swarmMetrics.fairnessStdDev}`,                  nr:naiveMetrics.fairnessStdDev,               br:baselineMetrics.fairnessStdDev,               sr:swarmMetrics.fairnessStdDev,               h:false },
      ],
    },
    {
      id: 'compute', label: 'Compute & Stability', icon: <Timer className="w-4 h-4 text-purple-400" />,
      rows: [
        { label: 'Avg Decision Time',      n:`${naiveMetrics.decisionMsAvg??0}ms`,              b:`${baselineMetrics.decisionMsAvg??0}ms`,              s:`${swarmMetrics.decisionMsAvg??0}ms`,              nr:naiveMetrics.decisionMsAvg??0,             br:baselineMetrics.decisionMsAvg??0,             sr:swarmMetrics.decisionMsAvg??0,             h:false },
        { label: 'Max Decision Time',      n:`${naiveMetrics.decisionMsMax??0}ms`,              b:`${baselineMetrics.decisionMsMax??0}ms`,              s:`${swarmMetrics.decisionMsMax??0}ms`,              nr:naiveMetrics.decisionMsMax??0,             br:baselineMetrics.decisionMsMax??0,             sr:swarmMetrics.decisionMsMax??0,             h:false },
        { label: 'Reassignments',          n:`${naiveMetrics.reassignments??0}`,                b:`${baselineMetrics.reassignments??0}`,                s:`${swarmMetrics.reassignments??0}`,                nr:naiveMetrics.reassignments??0,             br:baselineMetrics.reassignments??0,             sr:swarmMetrics.reassignments??0,             h:false },
        { label: 'Pack Queue Depth',       n:`${naiveMetrics.packingQueueDepth??0}`,            b:`${baselineMetrics.packingQueueDepth??0}`,            s:`${swarmMetrics.packingQueueDepth??0}`,            nr:naiveMetrics.packingQueueDepth??0,         br:baselineMetrics.packingQueueDepth??0,         sr:swarmMetrics.packingQueueDepth??0,         h:false },
      ],
    },
  ];

  const classBarData = [
    { class: 'Express',    naive: naiveMetrics.ordersByClass?.express??0,    baseline: baselineMetrics.ordersByClass?.express??0,    swarm: swarmMetrics.ordersByClass?.express??0    },
    { class: 'Regular',    naive: naiveMetrics.ordersByClass?.regular??0,    baseline: baselineMetrics.ordersByClass?.regular??0,    swarm: swarmMetrics.ordersByClass?.regular??0    },
    { class: 'Infeasible', naive: naiveMetrics.ordersByClass?.infeasible??0, baseline: baselineMetrics.ordersByClass?.infeasible??0, swarm: swarmMetrics.ordersByClass?.infeasible??0 },
  ];

  return (
    <div className="space-y-4 font-sans">

      {/* Winner banner */}
      <div className={`rounded-xl p-4 border flex items-center justify-between ${
        swarmWins
          ? 'bg-gradient-to-r from-emerald-950/80 to-teal-950/60 border-emerald-500/40'
          : 'bg-gradient-to-r from-rose-950/80 to-slate-950/60 border-rose-500/40'
      }`}>
        <div className="flex items-center space-x-3">
          <Trophy className={`w-6 h-6 ${swarmWins ? 'text-emerald-400' : 'text-rose-400'}`} />
          <div>
            <div className={`font-black text-lg font-mono ${swarmWins ? 'text-emerald-300' : 'text-rose-300'}`}>
              {swarmWins ? '🏆 SWARM WINS' : baselineWins ? '📊 Baseline Leads — tune config.ts' : '⚡ Naive Leads — tune config.ts!'}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              Swarm: <strong className="text-emerald-400">{swarmMetrics.onTimeRate}%</strong> &nbsp;·&nbsp;
              Baseline: <strong className="text-slate-300">{baselineMetrics.onTimeRate}%</strong> &nbsp;·&nbsp;
              Naive: <strong className="text-slate-400">{naiveMetrics.onTimeRate}%</strong>
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[11px] text-slate-500 font-mono">Swarm vs Baseline</div>
          <div className={`text-2xl font-black font-mono ${advantage >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {advantage >= 0 ? '+' : ''}{advantage.toFixed(1)}%
          </div>
          <div className="text-[10px] text-slate-500">on-time advantage</div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* On-time chart */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold font-mono text-white flex items-center space-x-1.5">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span>On-Time Rate Over Time</span>
            </h3>
            <div className="flex space-x-3 text-[10px]">
              <span className="flex items-center space-x-1"><span className="w-2 h-2 rounded-full bg-slate-500 inline-block" /><span className="text-slate-400">Naive</span></span>
              <span className="flex items-center space-x-1"><span className="w-2 h-2 rounded-full bg-rose-500 inline-block" /><span className="text-slate-400">Baseline</span></span>
              <span className="flex items-center space-x-1"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /><span className="text-emerald-400 font-bold">Swarm</span></span>
            </div>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                <XAxis dataKey="time" stroke="#475569" fontSize={9} tickLine={false} interval="preserveStartEnd" />
                <YAxis domain={[0, 100]} stroke="#475569" fontSize={9} tickLine={false} unit="%" />
                <Tooltip contentStyle={TT} formatter={(v: any) => [`${v ?? 0}%`]} />
                <ReferenceLine y={90} stroke="#10b981" strokeDasharray="3 3" strokeOpacity={0.35} />
                <Line type="monotone" dataKey="naiveOnTime"    name="Naive"    stroke="#64748b" strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="baselineOnTime" name="Baseline" stroke="#ef4444" strokeWidth={2}   dot={false} />
                <Line type="monotone" dataKey="swarmOnTime"    name="Swarm"    stroke="#10b981" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Queue depth chart */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold font-mono text-white flex items-center space-x-1.5">
              <BarChart2 className="w-4 h-4 text-amber-400" />
              <span>Pack Queue Depth Over Time</span>
            </h3>
            <div className="flex space-x-3 text-[10px]">
              <span className="flex items-center space-x-1"><span className="w-2 h-2 rounded-full bg-slate-500 inline-block" /><span className="text-slate-400">Naive</span></span>
              <span className="flex items-center space-x-1"><span className="w-2 h-2 rounded-full bg-rose-500 inline-block" /><span className="text-slate-400">Baseline</span></span>
              <span className="flex items-center space-x-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /><span className="text-amber-400 font-bold">Swarm</span></span>
            </div>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                <XAxis dataKey="time" stroke="#475569" fontSize={9} tickLine={false} interval="preserveStartEnd" />
                <YAxis stroke="#475569" fontSize={9} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={TT} formatter={(v: any) => [`${v ?? 0} orders`]} />
                <Line type="monotone" dataKey="naiveQueue"    name="Naive"    stroke="#64748b" strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="baselineQueue" name="Baseline" stroke="#ef4444" strokeWidth={2}   dot={false} />
                <Line type="monotone" dataKey="swarmQueue"    name="Swarm"    stroke="#f59e0b" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Collapsible metrics table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden">
        <div className="grid grid-cols-[1fr_90px_90px_90px_110px] bg-slate-950/80 border-b border-slate-800 px-4 py-2 text-[10px] font-mono font-bold uppercase tracking-wider">
          <span className="text-slate-500">Metric</span>
          <span className="text-center text-slate-500">Naive</span>
          <span className="text-center text-slate-500">Baseline</span>
          <span className="text-center text-emerald-400">Swarm ★</span>
          <span className="text-right text-slate-500">vs Baseline</span>
        </div>

        {sections.map((sec) => (
          <div key={sec.id}>
            <button
              id={`results-section-${sec.id}`}
              onClick={() => setOpen(open === sec.id ? null : sec.id)}
              className="w-full grid grid-cols-[1fr_auto] items-center px-4 py-2.5 bg-slate-900/60 border-b border-slate-800/60 hover:bg-slate-800/50 transition-all text-left"
            >
              <div className="flex items-center space-x-2 text-xs font-bold text-slate-300">
                {sec.icon}
                <span>{sec.label}</span>
              </div>
              {open === sec.id ? <ChevronUp className="w-3.5 h-3.5 text-slate-500" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />}
            </button>

            {open === sec.id && sec.rows.map((row, rIdx) => {
              const vals = [row.nr, row.br, row.sr];
              return (
                <div key={rIdx} className="grid grid-cols-[1fr_90px_90px_90px_110px] items-center px-4 py-2.5 border-b border-slate-800/40 hover:bg-slate-800/30 transition-all">
                  <span className="text-slate-400 font-mono text-[11px]">{row.label}</span>
                  <span className={`text-center font-mono text-[11px] ${winnerCls(row.nr, vals, row.h)}`}>{row.n}</span>
                  <span className={`text-center font-mono text-[11px] ${winnerCls(row.br, vals, row.h)}`}>{row.b}</span>
                  <span className={`text-center font-mono text-[12px] ${winnerCls(row.sr, vals, row.h)}`}>{row.s}</span>
                  <div className="flex justify-end"><Delta swarm={row.sr} baseline={row.br} higherIsBetter={row.h} /></div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Order class mix */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
        <h3 className="text-xs font-bold font-mono text-white flex items-center space-x-1.5 mb-3">
          <Scale className="w-4 h-4 text-purple-400" />
          <span>Order Class Mix (Express / Regular / Infeasible)</span>
        </h3>
        <div className="h-32">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={classBarData} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
              <XAxis type="number" stroke="#475569" fontSize={9} tickLine={false} />
              <YAxis dataKey="class" type="category" stroke="#475569" fontSize={10} width={64} tickLine={false} />
              <Tooltip contentStyle={TT} />
              <Bar dataKey="naive"    name="Naive"    fill="#64748b" radius={[0,0,0,0]} />
              <Bar dataKey="baseline" name="Baseline" fill="#ef4444" radius={[0,0,0,0]} />
              <Bar dataKey="swarm"    name="Swarm"    fill="#10b981" radius={[0,4,4,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
