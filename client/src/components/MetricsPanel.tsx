import React from 'react';
import { Metrics } from '../types';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { formatDuration } from '../lib/format';
import { Clock, CheckCircle2, TrendingUp, ShieldAlert, Navigation, Scale, Users } from 'lucide-react';

interface MetricsPanelProps {
  baselineMetrics: Metrics;
  swarmMetrics: Metrics;
}

export const MetricsPanel: React.FC<MetricsPanelProps> = ({
  baselineMetrics,
  swarmMetrics,
}) => {
  // Combine historical data for live trend charts
  const historyMap = new Map<number, { time: string; baselineOnTime: number; swarmOnTime: number; baselineAvgSec: number; swarmAvgSec: number }>();

  baselineMetrics.history.forEach((h) => {
    const hours = Math.floor((h.t / 3600) % 24);
    const mins = Math.floor((h.t % 3600) / 60);
    const timeStr = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
    historyMap.set(h.t, {
      time: timeStr,
      baselineOnTime: h.onTimeRate,
      swarmOnTime: 100, // fallback if missing
      baselineAvgSec: h.avgDeliverySec,
      swarmAvgSec: 0,
    });
  });

  swarmMetrics.history.forEach((h) => {
    const hours = Math.floor((h.t / 3600) % 24);
    const mins = Math.floor((h.t % 3600) / 60);
    const timeStr = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;

    if (historyMap.has(h.t)) {
      const entry = historyMap.get(h.t)!;
      entry.swarmOnTime = h.onTimeRate;
      entry.swarmAvgSec = h.avgDeliverySec;
    } else {
      historyMap.set(h.t, {
        time: timeStr,
        baselineOnTime: 0,
        swarmOnTime: h.onTimeRate,
        baselineAvgSec: 0,
        swarmAvgSec: h.avgDeliverySec,
      });
    }
  });

  const chartData = Array.from(historyMap.values()).slice(-30);

  const calculateDelta = (swarmVal: number, baseVal: number, higherIsBetter: boolean = true) => {
    const diff = swarmVal - baseVal;
    if (Math.abs(diff) < 0.1) return null;
    const isGood = higherIsBetter ? diff > 0 : diff < 0;
    const sign = diff > 0 ? '+' : '';

    return (
      <span
        className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${
          isGood ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
        }`}
      >
        {sign}{diff.toFixed(1)}
      </span>
    );
  };

  const metricItems = [
    {
      label: 'On-Time Delivery Rate',
      icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
      baseVal: `${baselineMetrics.onTimeRate}%`,
      swarmVal: `${swarmMetrics.onTimeRate}%`,
      delta: calculateDelta(swarmMetrics.onTimeRate, baselineMetrics.onTimeRate, true),
    },
    {
      label: 'Avg Delivery Time',
      icon: <Clock className="w-4 h-4 text-sky-400" />,
      baseVal: formatDuration(baselineMetrics.avgDeliverySec),
      swarmVal: formatDuration(swarmMetrics.avgDeliverySec),
      delta: calculateDelta(
        swarmMetrics.avgDeliverySec,
        baselineMetrics.avgDeliverySec,
        false
      ),
    },
    {
      label: 'P90 Delivery Time',
      icon: <TrendingUp className="w-4 h-4 text-purple-400" />,
      baseVal: formatDuration(baselineMetrics.p90DeliverySec),
      swarmVal: formatDuration(swarmMetrics.p90DeliverySec),
      delta: calculateDelta(
        swarmMetrics.p90DeliverySec,
        baselineMetrics.p90DeliverySec,
        false
      ),
    },
    {
      label: 'Batching Rate (Orders/Trip)',
      icon: <Users className="w-4 h-4 text-teal-400" />,
      baseVal: `${baselineMetrics.ordersPerTrip} x`,
      swarmVal: `${swarmMetrics.ordersPerTrip} x`,
      delta: calculateDelta(swarmMetrics.ordersPerTrip, baselineMetrics.ordersPerTrip, true),
    },
    {
      label: 'Km Traveled per Order',
      icon: <Navigation className="w-4 h-4 text-amber-400" />,
      baseVal: `${baselineMetrics.kmPerOrder} km`,
      swarmVal: `${swarmMetrics.kmPerOrder} km`,
      delta: calculateDelta(swarmMetrics.kmPerOrder, baselineMetrics.kmPerOrder, false),
    },
    {
      label: 'Workload Fairness (Std Dev)',
      icon: <Scale className="w-4 h-4 text-indigo-400" />,
      baseVal: `${baselineMetrics.fairnessStdDev}`,
      swarmVal: `${swarmMetrics.fairnessStdDev}`,
      delta: calculateDelta(
        swarmMetrics.fairnessStdDev,
        baselineMetrics.fairnessStdDev,
        false
      ),
    },
    {
      label: 'Orders Late / At-Risk Now',
      icon: <ShieldAlert className="w-4 h-4 text-rose-400" />,
      baseVal: `${baselineMetrics.lateNow}`,
      swarmVal: `${swarmMetrics.lateNow}`,
      delta: calculateDelta(swarmMetrics.lateNow, baselineMetrics.lateNow, false),
    },
  ];

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-xl space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <h3 className="font-mono text-sm font-bold text-white flex items-center space-x-2">
          <span>📊 Real-Time Scorecard: Baseline vs Swarm</span>
        </h3>
        <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-600/40 px-2.5 py-0.5 rounded">
          Live Divergence Monitor
        </span>
      </div>

      {/* Metric Scorecards Table */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {metricItems.map((item, idx) => (
          <div
            key={idx}
            className="bg-slate-950/80 border border-slate-800/80 rounded-lg p-3 hover:border-slate-700 transition-all"
          >
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
              <span className="flex items-center space-x-1.5 font-medium truncate">
                {item.icon}
                <span className="truncate">{item.label}</span>
              </span>
              {item.delta}
            </div>

            <div className="grid grid-cols-2 gap-2 mt-1 pt-1 border-t border-slate-800/50">
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-mono block">Baseline</span>
                <span className="text-sm font-bold text-slate-300 font-mono">{item.baseVal}</span>
              </div>
              <div className="border-l border-slate-800/80 pl-2">
                <span className="text-[10px] text-emerald-400 uppercase font-mono block">Swarm</span>
                <span className="text-base font-black text-emerald-400 font-mono">{item.swarmVal}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Live Recharts Line Chart */}
      <div className="bg-slate-950/80 border border-slate-800/80 rounded-lg p-3">
        <h4 className="text-xs font-semibold text-slate-300 mb-2 font-mono flex items-center justify-between">
          <span>📈 On-Time Delivery % Over Sim Time</span>
          <div className="flex items-center space-x-3 text-[11px]">
            <span className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 bg-rose-500 rounded-full inline-block" />
              <span className="text-slate-400">Baseline</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 bg-emerald-400 rounded-full inline-block" />
              <span className="text-emerald-400 font-bold">Swarm</span>
            </span>
          </div>
        </h4>

        <div className="h-44 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <XAxis dataKey="time" stroke="#64748b" fontSize={10} tickLine={false} />
              <YAxis domain={[0, 100]} stroke="#64748b" fontSize={10} tickLine={false} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '11px' }}
              />
              <Line
                type="monotone"
                dataKey="baselineOnTime"
                name="Baseline On-Time %"
                stroke="#ef4444"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="swarmOnTime"
                name="Swarm On-Time %"
                stroke="#10b981"
                strokeWidth={2.5}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
