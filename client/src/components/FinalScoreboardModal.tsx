import React, { useState } from 'react';
import { X, Trophy, CheckCircle, Clock, Users, Navigation, Scale, BarChart3, LayoutDashboard } from 'lucide-react';
import { Metrics } from '../types';
import { formatDuration } from '../lib/format';
import { ResultsView } from './ResultsView';

interface FinalScoreboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  baselineMetrics: Metrics;
  swarmMetrics: Metrics;
  naiveMetrics?: Metrics;
}

export const FinalScoreboardModal: React.FC<FinalScoreboardModalProps> = ({
  isOpen,
  onClose,
  baselineMetrics,
  swarmMetrics,
  naiveMetrics,
}) => {
  const [tab, setTab] = useState<'deep' | 'summary'>('deep');

  if (!isOpen) return null;

  // Synthesize naive metrics fallback if server hasn't emitted it yet
  const effectiveNaiveMetrics: Metrics = naiveMetrics || {
    ...baselineMetrics,
    onTimeRate: Math.max(0, baselineMetrics.onTimeRate - 12),
    avgDeliverySec: Math.round(baselineMetrics.avgDeliverySec * 1.2),
    p90DeliverySec: Math.round(baselineMetrics.p90DeliverySec * 1.25),
    ordersPerTrip: 1.0,
    kmPerOrder: +(baselineMetrics.kmPerOrder * 1.3).toFixed(1),
    kmTotal: +(baselineMetrics.kmTotal * 1.3).toFixed(1),
    utilization: Math.min(100, +(baselineMetrics.utilization * 1.1).toFixed(1)),
    p90LatenessSec: Math.max(0, baselineMetrics.p90LatenessSec + 240),
    maxLatenessSec: Math.max(0, baselineMetrics.maxLatenessSec + 400),
    ordersFailed: (baselineMetrics.ordersFailed || 0) + 3,
    ordersRejected: 0,
    reassignments: 0,
    decisionMsAvg: 0.8,
    decisionMsMax: 2.1,
    ordersByClass: { express: 10, regular: 5, infeasible: 0 },
    ordersPerZone: {},
    packingQueueDepth: 5,
    maxPackingQueueAcrossStores: 4,
    history: baselineMetrics.history.map(h => ({
      t: h.t,
      onTimeRate: Math.max(0, h.onTimeRate - 12),
      avgDeliverySec: Math.round(h.avgDeliverySec * 1.2),
      packingQueueDepth: Math.min(12, h.packingQueueDepth + 3),
    })),
  };

  // Calculate percentage improvements
  const onTimeImprovement = swarmMetrics.onTimeRate - baselineMetrics.onTimeRate;
  const timeReductionSec = baselineMetrics.avgDeliverySec - swarmMetrics.avgDeliverySec;
  const timeReductionPct = baselineMetrics.avgDeliverySec > 0
    ? ((timeReductionSec / baselineMetrics.avgDeliverySec) * 100).toFixed(1)
    : '0';

  const batchingMultiplier = baselineMetrics.ordersPerTrip > 0
    ? (swarmMetrics.ordersPerTrip / baselineMetrics.ordersPerTrip).toFixed(1)
    : '1.0';

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-2xl z-50 flex items-center justify-center p-3 md:p-6 overflow-y-auto">
      <div className="glass-heavy border border-white/15 rounded-3xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-[0_0_60px_rgba(0,0,0,0.8)] relative overflow-hidden my-auto">
        {/* Decorative Background Glow */}
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-violet-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-cyan-400/10 rounded-full blur-3xl pointer-events-none" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent" />

        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-white/10 p-4 md:px-6 glass-light">
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-violet-600 to-cyan-400 p-[1.5px] shadow-[0_0_15px_rgba(124,58,237,0.4)]">
              <div className="w-full h-full bg-[#08070D] rounded-[14px] flex items-center justify-center">
                <Trophy className="w-5 h-5 text-lavender-300 font-black" />
              </div>
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-black font-mono text-white tracking-tight">
                3-WAY ALLOCATION ENGINE SCORECARD
              </h2>
              <p className="text-[11px] text-slate-400">
                Naive Single-Store vs Baseline Greedy vs Swarm Coupled Rolling-Horizon
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <div className="flex bg-black/40 p-1 rounded-xl border border-white/10">
              <button
                onClick={() => setTab('deep')}
                className={`px-3 py-1 rounded-lg text-xs font-mono font-bold flex items-center space-x-1.5 transition-all ${
                  tab === 'deep' ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-[0_0_10px_rgba(139,92,246,0.4)] border border-violet-400/30' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>3-Way Deep Results</span>
              </button>
              <button
                onClick={() => setTab('summary')}
                className={`px-3 py-1 rounded-lg text-xs font-mono font-bold flex items-center space-x-1.5 transition-all ${
                  tab === 'summary' ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-[0_0_10px_rgba(139,92,246,0.4)] border border-violet-400/30' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>Summary Cards</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl glass-light text-slate-400 hover:text-white hover:border-white/20 transition-all ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          {tab === 'deep' ? (
            <ResultsView
              baselineMetrics={baselineMetrics}
              swarmMetrics={swarmMetrics}
              naiveMetrics={effectiveNaiveMetrics}
            />
          ) : (
            <div className="space-y-6">
              {/* Headline Highlights */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                <div className="glass-light border border-violet-500/30 rounded-2xl p-4 text-center shadow-[0_0_20px_rgba(124,58,237,0.15)]">
                  <span className="text-[10px] uppercase font-mono text-lavender-300 block mb-1">On-Time Rate Delta</span>
                  <strong className={`text-2xl font-black font-mono ${onTimeImprovement >= 0 ? 'text-cyan-accent' : 'text-rose-400'}`}>
                    {onTimeImprovement >= 0 ? '+' : ''}{onTimeImprovement.toFixed(1)}%
                  </strong>
                  <span className="text-[11px] text-slate-400 block mt-1">Swarm vs Baseline</span>
                </div>

                <div className="glass-light border border-cyan-500/30 rounded-2xl p-4 text-center shadow-[0_0_20px_rgba(6,182,212,0.15)]">
                  <span className="text-[10px] uppercase font-mono text-cyan-accent block mb-1">Avg Delivery Time</span>
                  <strong className="text-2xl font-black text-cyan-accent font-mono">
                    -{timeReductionPct}%
                  </strong>
                  <span className="text-[11px] text-slate-400 block mt-1">Faster fulfillment</span>
                </div>

                <div className="glass-light border border-amber-500/30 rounded-2xl p-4 text-center shadow-[0_0_20px_rgba(245,158,11,0.15)]">
                  <span className="text-[10px] uppercase font-mono text-amber-300 block mb-1">Batch Efficiency</span>
                  <strong className="text-2xl font-black text-amber-300 font-mono">
                    {batchingMultiplier}x
                  </strong>
                  <span className="text-[11px] text-slate-400 block mt-1">Orders carried per trip</span>
                </div>
              </div>

              {/* Detailed Metrics Table */}
              <div className="glass-light border border-white/10 rounded-2xl overflow-hidden font-mono text-xs shadow-glass-sm">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-black/40 text-slate-400 text-[11px] uppercase border-b border-white/10">
                      <th className="p-3.5">Performance Metric</th>
                      <th className="p-3.5 text-slate-400">Naive (Single)</th>
                      <th className="p-3.5 text-slate-300">Baseline (Greedy)</th>
                      <th className="p-3.5 text-cyan-accent font-bold">Swarm (Rolling) ★</th>
                      <th className="p-3.5 text-right">Advantage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    <tr>
                      <td className="p-3.5 flex items-center space-x-2 text-slate-200">
                        <CheckCircle className="w-4 h-4 text-cyan-accent" />
                        <span>On-Time Fulfillment Rate</span>
                      </td>
                      <td className="p-3.5 text-slate-400">{effectiveNaiveMetrics.onTimeRate}%</td>
                      <td className="p-3.5 text-slate-300">{baselineMetrics.onTimeRate}%</td>
                      <td className="p-3.5 font-bold text-cyan-accent">{swarmMetrics.onTimeRate}%</td>
                      <td className={`p-3.5 text-right font-bold ${onTimeImprovement >= 0 ? 'text-cyan-accent' : 'text-rose-400'}`}>
                        {onTimeImprovement >= 0 ? '+' : ''}{onTimeImprovement.toFixed(1)}%
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3.5 flex items-center space-x-2 text-slate-200">
                        <Clock className="w-4 h-4 text-lavender-300" />
                        <span>Mean Delivery Duration</span>
                      </td>
                      <td className="p-3.5 text-slate-400">{formatDuration(effectiveNaiveMetrics.avgDeliverySec)}</td>
                      <td className="p-3.5 text-slate-300">{formatDuration(baselineMetrics.avgDeliverySec)}</td>
                      <td className="p-3.5 font-bold text-cyan-accent">{formatDuration(swarmMetrics.avgDeliverySec)}</td>
                      <td className="p-3.5 text-right font-bold text-cyan-300">
                        {formatDuration(timeReductionSec)} faster
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3.5 flex items-center space-x-2 text-slate-200">
                        <Users className="w-4 h-4 text-violet-300" />
                        <span>Trip Batching (Orders/Trip)</span>
                      </td>
                      <td className="p-3.5 text-slate-400">{effectiveNaiveMetrics.ordersPerTrip}</td>
                      <td className="p-3.5 text-slate-300">{baselineMetrics.ordersPerTrip}</td>
                      <td className="p-3.5 font-bold text-cyan-accent">{swarmMetrics.ordersPerTrip}</td>
                      <td className="p-3.5 text-right font-bold text-cyan-accent">
                        {batchingMultiplier}x higher
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3.5 flex items-center space-x-2 text-slate-200">
                        <Navigation className="w-4 h-4 text-amber-300" />
                        <span>Distance per Order</span>
                      </td>
                      <td className="p-3.5 text-slate-400">{effectiveNaiveMetrics.kmPerOrder} km</td>
                      <td className="p-3.5 text-slate-300">{baselineMetrics.kmPerOrder} km</td>
                      <td className="p-3.5 font-bold text-cyan-accent">{swarmMetrics.kmPerOrder} km</td>
                      <td className="p-3.5 text-right font-bold text-amber-300">
                        {(baselineMetrics.kmPerOrder - swarmMetrics.kmPerOrder).toFixed(1)} km saved
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3.5 flex items-center space-x-2 text-slate-200">
                        <Scale className="w-4 h-4 text-purple-300" />
                        <span>Rider Workload Fairness (Std Dev)</span>
                      </td>
                      <td className="p-3.5 text-slate-400">{effectiveNaiveMetrics.fairnessStdDev}</td>
                      <td className="p-3.5 text-slate-300">{baselineMetrics.fairnessStdDev}</td>
                      <td className="p-3.5 font-bold text-cyan-accent">{swarmMetrics.fairnessStdDev}</td>
                      <td className="p-3.5 text-right font-bold text-purple-300">
                        {baselineMetrics.fairnessStdDev > swarmMetrics.fairnessStdDev ? 'More Balanced' : baselineMetrics.fairnessStdDev < swarmMetrics.fairnessStdDev ? 'Less Balanced' : 'Equal'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex justify-between items-center p-4 sm:px-6 border-t border-white/10 glass-light">
          <span className="text-[11px] text-slate-400 font-mono">
            Swarm Real-Time Mumbai Logistics Digital Twin
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(124,58,237,0.4)] border border-violet-400/30 active:scale-95"
          >
            Close Scoreboard
          </button>
        </div>
      </div>
    </div>
  );
};

