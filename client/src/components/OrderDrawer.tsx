import React, { useEffect, useState } from 'react';
import { X, CheckCircle, AlertTriangle, ArrowRight, UserCheck, Store, ShieldCheck, Zap } from 'lucide-react';
import { OrderSnapshot, DecisionRecord } from '../types';
import { formatSimTime, formatDuration } from '../lib/format';

interface OrderDrawerProps {
  order: OrderSnapshot | null;
  world: 'baseline' | 'swarm';
  onClose: () => void;
}

export const OrderDrawer: React.FC<OrderDrawerProps> = ({
  order,
  world,
  onClose,
}) => {
  const [decision, setDecision] = useState<DecisionRecord | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!order) {
      setDecision(null);
      return;
    }

    setLoading(true);
    fetch(`/api/decision/${world}/${order.id}`)
      .then((res) => {
        if (!res.ok) throw new Error('Not found');
        return res.json();
      })
      .then((data: DecisionRecord) => {
        setDecision(data);
      })
      .catch(() => {
        setDecision(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [order, world]);

  if (!order) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-md bg-slate-900/95 border-l border-slate-800 shadow-2xl backdrop-blur-xl z-50 flex flex-col transition-all">
      {/* Drawer Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-base font-bold font-mono text-white">{order.id}</h2>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${
                order.priority === 'express'
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                  : 'bg-slate-800 text-slate-300 border-slate-700'
              }`}
            >
              {order.priority}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            World: <strong className="uppercase text-emerald-400 font-mono">{world}</strong>
          </p>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-all"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Drawer Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs font-sans">
        {/* Status Pill */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-500 uppercase font-mono block">Delivery Window</span>
            <div className="flex items-center space-x-2 mt-1">
              <span className="text-slate-300 font-mono">Promised: {formatSimTime(order.promisedBy)}</span>
            </div>
          </div>
          <div>
            {order.isLate ? (
              <span className="flex items-center space-x-1 px-2.5 py-1 rounded bg-rose-950/80 border border-rose-600/40 text-rose-300 font-bold">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>At Risk / Late</span>
              </span>
            ) : (
              <span className="flex items-center space-x-1 px-2.5 py-1 rounded bg-emerald-950/80 border border-emerald-600/40 text-emerald-300 font-bold">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>On Time</span>
              </span>
            )}
          </div>
        </div>

        {/* Explainability Record */}
        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading decision explainability...</div>
        ) : decision ? (
          <div className="space-y-4">
            {/* Natural Language Reason Box */}
            <div className="bg-emerald-950/30 border border-emerald-500/40 rounded-lg p-3 text-emerald-300">
              <div className="flex items-center space-x-1.5 text-xs font-bold text-emerald-400 mb-1">
                <Zap className="w-4 h-4" />
                <span>Decision Rationale</span>
              </div>
              <p className="text-xs leading-relaxed text-emerald-200/90 font-mono">
                "{decision.reason}"
              </p>
            </div>

            {/* Chosen Assignment Details */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 space-y-3">
              <h3 className="font-mono text-xs font-bold text-white flex items-center justify-between border-b border-slate-800 pb-1.5">
                <span>Selected Candidate Pair</span>
                <span className="text-emerald-400 font-mono">
                  Cost Score: {Math.round(decision.chosen.totalCost)}
                </span>
              </h3>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-900 border border-slate-800 p-2 rounded flex items-center space-x-2">
                  <UserCheck className="w-4 h-4 text-emerald-400" />
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase">Rider</span>
                    <strong className="text-white font-mono">{decision.chosen.riderId}</strong>
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-2 rounded flex items-center space-x-2">
                  <Store className="w-4 h-4 text-sky-400" />
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase">Dark Store</span>
                    <strong className="text-white font-mono">{decision.chosen.storeId}</strong>
                  </div>
                </div>
              </div>

              {/* Batching Savings Banner if available */}
              {decision.chosen.breakdown.batchSavingSec > 0 && (
                <div className="bg-teal-950/60 border border-teal-500/30 text-teal-300 p-2 rounded text-[11px] font-mono flex items-center justify-between">
                  <span>✨ Multi-Order Batch Savings:</span>
                  <strong className="text-teal-400 font-bold">
                    -{Math.round(decision.chosen.breakdown.batchSavingSec)}s travel time
                  </strong>
                </div>
              )}

              {/* Breakdown Cards */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[10px] uppercase font-mono text-slate-400">Cost Breakdown:</span>
                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                  <div className="bg-slate-900 p-2 rounded border border-slate-800 flex justify-between">
                    <span className="text-slate-400">Travel Leg:</span>
                    <span className="text-white">{formatDuration(decision.chosen.breakdown.travelSec)}</span>
                  </div>
                  <div className="bg-slate-900 p-2 rounded border border-slate-800 flex justify-between">
                    <span className="text-slate-400">Pack Queue Wait:</span>
                    <span className="text-white">{formatDuration(decision.chosen.breakdown.packWaitSec)}</span>
                  </div>
                  <div className="bg-slate-900 p-2 rounded border border-slate-800 flex justify-between">
                    <span className="text-slate-400">Insertion Extra:</span>
                    <span className="text-white">{formatDuration(decision.chosen.breakdown.insertionSec)}</span>
                  </div>
                  <div className="bg-slate-900 p-2 rounded border border-slate-800 flex justify-between">
                    <span className="text-slate-400">Lateness Penalty:</span>
                    <span className="text-rose-400">{Math.round(decision.chosen.breakdown.latenessPenalty)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Runners-Up Options */}
            {decision.runnersUp && decision.runnersUp.length > 0 && (
              <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 space-y-2">
                <h4 className="font-mono text-xs font-bold text-slate-400">
                  Runner-Up Candidates Evaluated:
                </h4>
                {decision.runnersUp.map((runner, rIdx) => (
                  <div
                    key={rIdx}
                    className="p-2 rounded bg-slate-900 border border-slate-800 flex items-center justify-between text-[11px] font-mono"
                  >
                    <div>
                      <span className="text-slate-400">#{rIdx + 2}: </span>
                      <strong className="text-white">{runner.riderId}</strong> ({runner.storeId})
                    </div>
                    <div className="text-right">
                      <span className="text-slate-400">Cost: </span>
                      <strong className="text-amber-400">{Math.round(runner.totalCost)}</strong>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 bg-slate-950 border border-slate-800 rounded text-slate-400">
            No detailed decision record stored for this order yet.
          </div>
        )}
      </div>
    </div>
  );
};
