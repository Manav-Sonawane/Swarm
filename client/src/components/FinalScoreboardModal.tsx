import React from 'react';
import { X, Trophy, CheckCircle, Clock, Users, Navigation, Scale, Flame } from 'lucide-react';
import { Metrics } from '../types';
import { formatDuration } from '../lib/format';

interface FinalScoreboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  baselineMetrics: Metrics;
  swarmMetrics: Metrics;
}

export const FinalScoreboardModal: React.FC<FinalScoreboardModalProps> = ({
  isOpen,
  onClose,
  baselineMetrics,
  swarmMetrics,
}) => {
  if (!isOpen) return null;

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
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-6 relative overflow-hidden">
        {/* Decorative Background Glow */}
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Trophy className="w-6 h-6 text-black" />
            </div>
            <div>
              <h2 className="text-xl font-black font-mono text-white tracking-tight">
                SWARM vs BASELINE SCORECARD
              </h2>
              <p className="text-xs text-slate-400">
                Identical Seeded Order Stream & Stress Scenarios Comparison
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Headline Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-gradient-to-br from-emerald-950/80 to-slate-900 border border-emerald-500/40 rounded-xl p-4 text-center">
            <span className="text-[10px] uppercase font-mono text-emerald-400 block mb-1">On-Time Rate Delta</span>
            <strong className="text-2xl font-black text-emerald-400 font-mono">
              +{onTimeImprovement.toFixed(1)}%
            </strong>
            <span className="text-[11px] text-slate-400 block mt-1">Swarm vs Baseline</span>
          </div>

          <div className="bg-gradient-to-br from-teal-950/80 to-slate-900 border border-teal-500/40 rounded-xl p-4 text-center">
            <span className="text-[10px] uppercase font-mono text-teal-400 block mb-1">Avg Delivery Time</span>
            <strong className="text-2xl font-black text-teal-400 font-mono">
              -{timeReductionPct}%
            </strong>
            <span className="text-[11px] text-slate-400 block mt-1">Faster fulfillment</span>
          </div>

          <div className="bg-gradient-to-br from-amber-950/80 to-slate-900 border border-amber-500/40 rounded-xl p-4 text-center">
            <span className="text-[10px] uppercase font-mono text-amber-400 block mb-1">Batch Efficiency</span>
            <strong className="text-2xl font-black text-amber-400 font-mono">
              {batchingMultiplier}x
            </strong>
            <span className="text-[11px] text-slate-400 block mt-1">Orders carried per trip</span>
          </div>
        </div>

        {/* Detailed Metrics Table */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl overflow-hidden font-mono text-xs">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900 text-slate-400 text-[11px] uppercase border-b border-slate-800">
                <th className="p-3">Performance Metric</th>
                <th className="p-3 text-slate-300">Baseline (Greedy)</th>
                <th className="p-3 text-emerald-400">Swarm (Rolling-Horizon)</th>
                <th className="p-3 text-right">Advantage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              <tr>
                <td className="p-3 flex items-center space-x-2 text-slate-200">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span>On-Time Fulfillment Rate</span>
                </td>
                <td className="p-3 text-slate-300">{baselineMetrics.onTimeRate}%</td>
                <td className="p-3 font-bold text-emerald-400">{swarmMetrics.onTimeRate}%</td>
                <td className="p-3 text-right font-bold text-emerald-400">
                  +{onTimeImprovement.toFixed(1)}%
                </td>
              </tr>
              <tr>
                <td className="p-3 flex items-center space-x-2 text-slate-200">
                  <Clock className="w-4 h-4 text-sky-400" />
                  <span>Mean Delivery Duration</span>
                </td>
                <td className="p-3 text-slate-300">{formatDuration(baselineMetrics.avgDeliverySec)}</td>
                <td className="p-3 font-bold text-emerald-400">{formatDuration(swarmMetrics.avgDeliverySec)}</td>
                <td className="p-3 text-right font-bold text-teal-400">
                  {formatDuration(timeReductionSec)} faster
                </td>
              </tr>
              <tr>
                <td className="p-3 flex items-center space-x-2 text-slate-200">
                  <Users className="w-4 h-4 text-teal-400" />
                  <span>Trip Batching (Orders/Trip)</span>
                </td>
                <td className="p-3 text-slate-300">{baselineMetrics.ordersPerTrip}</td>
                <td className="p-3 font-bold text-emerald-400">{swarmMetrics.ordersPerTrip}</td>
                <td className="p-3 text-right font-bold text-emerald-400">
                  {batchingMultiplier}x higher
                </td>
              </tr>
              <tr>
                <td className="p-3 flex items-center space-x-2 text-slate-200">
                  <Navigation className="w-4 h-4 text-amber-400" />
                  <span>Distance per Order</span>
                </td>
                <td className="p-3 text-slate-300">{baselineMetrics.kmPerOrder} km</td>
                <td className="p-3 font-bold text-emerald-400">{swarmMetrics.kmPerOrder} km</td>
                <td className="p-3 text-right font-bold text-amber-400">
                  {(baselineMetrics.kmPerOrder - swarmMetrics.kmPerOrder).toFixed(1)} km saved
                </td>
              </tr>
              <tr>
                <td className="p-3 flex items-center space-x-2 text-slate-200">
                  <Scale className="w-4 h-4 text-purple-400" />
                  <span>Rider Workload Fairness (Std Dev)</span>
                </td>
                <td className="p-3 text-slate-300">{baselineMetrics.fairnessStdDev}</td>
                <td className="p-3 font-bold text-emerald-400">{swarmMetrics.fairnessStdDev}</td>
                <td className="p-3 text-right font-bold text-purple-400">
                  {baselineMetrics.fairnessStdDev > swarmMetrics.fairnessStdDev ? 'More Balanced' : 'Equivalenced'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold text-xs uppercase tracking-wider hover:opacity-90 transition-all shadow-lg active:scale-95"
          >
            Close Scoreboard
          </button>
        </div>
      </div>
    </div>
  );
};
