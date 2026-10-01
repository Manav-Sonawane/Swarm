import React, { useEffect, useState } from 'react';
import { X, CheckCircle, AlertTriangle, UserCheck, Store, ShieldCheck, Zap, Timer, Filter } from 'lucide-react';
import { OrderSnapshot, DecisionRecord } from '../types';
import { formatSimTime, formatDuration } from '../lib/format';

interface OrderDrawerProps {
  order: OrderSnapshot | null;
  world: 'naive' | 'baseline' | 'swarm';
  onClose: () => void;
}

const STATUS_COLOR: Record<string, string> = {
  placed:    'bg-sky-950 text-sky-300 border-sky-600/40',
  assigned:  'bg-indigo-950 text-indigo-300 border-indigo-600/40',
  packing:   'bg-amber-950 text-amber-300 border-amber-600/40',
  packed:    'bg-teal-950 text-teal-300 border-teal-600/40',
  picked:    'bg-purple-950 text-purple-300 border-purple-600/40',
  delivered: 'bg-emerald-950 text-emerald-300 border-emerald-600/40',
  cancelled: 'bg-rose-950 text-rose-300 border-rose-600/40',
};

export const OrderDrawer: React.FC<OrderDrawerProps> = ({ order, world, onClose }) => {
  const [decision, setDecision] = useState<DecisionRecord | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!order) { setDecision(null); return; }
    setLoading(true);
    fetch(`/api/decision/${world}/${order.id}`)
      .then(r => { if (!r.ok) throw new Error('Not found'); return r.json(); })
      .then((data: DecisionRecord) => setDecision(data))
      .catch(() => setDecision(null))
      .finally(() => setLoading(false));
  }, [order, world]);

  if (!order) return null;

  const classBadge = order.class === 'express'
    ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
    : order.class === 'infeasible'
    ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
    : 'bg-slate-800 text-slate-300 border-slate-700';

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-md glass-heavy border-l border-white/15 shadow-[0_0_50px_rgba(0,0,0,0.8)] z-50 flex flex-col transition-all duration-300">
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between glass-light shrink-0">
        <div>
          <div className="flex items-center flex-wrap gap-2">
            <h2 className="text-base font-bold font-mono text-white">{order.id}</h2>
            <span className={`text-[10px] font-bold font-mono px-2.5 py-0.5 rounded-full border uppercase ${classBadge}`}>
              {order.class ?? order.priority}
            </span>
            <span className={`text-[10px] font-bold font-mono px-2.5 py-0.5 rounded-full border uppercase ${STATUS_COLOR[order.status] ?? 'bg-white/10 text-slate-300 border-white/10'}`}>
              {order.status}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            World: <strong className={`uppercase font-mono ${world === 'swarm' ? 'text-cyan-accent' : 'text-slate-300'}`}>{world}</strong>
          </p>
        </div>
        <button id="order-drawer-close" onClick={onClose} className="p-2 rounded-xl glass-light text-slate-400 hover:text-white hover:border-white/20 transition-all">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs font-sans">

        {/* Delivery window */}
        <div className="glass-light border border-white/10 rounded-xl p-4 flex items-center justify-between shadow-glass-sm">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 uppercase font-mono">Delivery Window</span>
            <div className="font-mono text-slate-300">Created: {formatSimTime(order.createdAt)}</div>
            <div className="font-mono text-slate-300">Promised: <strong className="text-white">{formatSimTime(order.promisedBy)}</strong></div>
            {order.projectedEta != null && (
              <div className={`font-mono ${order.projectedEta > order.promisedBy ? 'text-rose-400' : 'text-cyan-accent'}`}>
                ETA: {formatSimTime(order.projectedEta)}{' '}
                ({order.projectedEta > order.promisedBy
                  ? `+${Math.round(order.projectedEta - order.promisedBy)}s late`
                  : `${Math.round(order.promisedBy - order.projectedEta)}s slack`})
              </div>
            )}
            {order.deliveredAt != null && (
              <div className="font-mono text-cyan-accent">Delivered: {formatSimTime(order.deliveredAt)}</div>
            )}
          </div>
          {order.isLate ? (
            <span className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-rose-950/70 border border-rose-500/40 text-rose-300 font-bold shadow-[0_0_12px_rgba(244,63,94,0.3)]">
              <AlertTriangle className="w-3.5 h-3.5" /><span>At Risk</span>
            </span>
          ) : (
            <span className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-cyan-950/70 border border-cyan-500/40 text-cyan-300 font-bold shadow-[0_0_12px_rgba(6,182,212,0.3)]">
              <CheckCircle className="w-3.5 h-3.5" /><span>On Time</span>
            </span>
          )}
        </div>

        {/* Decision explainability */}
        {loading ? (
          <div className="p-8 text-center text-slate-400 animate-pulse">Loading explainability record…</div>
        ) : decision ? (
          <div className="space-y-4">

            {/* Rationale */}
            <div className="glass-light border border-cyan-500/30 rounded-xl p-4 shadow-[0_0_15px_rgba(6,182,212,0.15)]">
              <div className="flex items-center space-x-2 text-xs font-bold text-cyan-accent mb-2">
                <Zap className="w-4 h-4" /><span>Decision Rationale</span>
              </div>
              <p className="text-xs leading-relaxed text-cyan-100 font-mono">"{decision.reason}"</p>
            </div>

            {/* Meta badges */}
            <div className="flex flex-wrap gap-2">
              {decision.decisionMs != null && (
                <span className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg border text-xs font-mono ${
                  decision.decisionMs < 100 ? 'bg-emerald-950/40 border-emerald-600/40 text-emerald-300'
                  : decision.decisionMs < 200 ? 'bg-amber-950/40 border-amber-600/40 text-amber-300'
                  : 'bg-rose-950/40 border-rose-600/40 text-rose-300'}`}>
                  <Timer className="w-3.5 h-3.5" /><span>Decision: <strong>{decision.decisionMs.toFixed(1)}ms</strong></span>
                </span>
              )}
              {(decision.batchSavingSec ?? decision.chosen.breakdown.batchSavingSec ?? 0) > 0 && (
                <span className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg border bg-teal-950/40 border-teal-600/40 text-teal-300 text-xs font-mono">
                  <ShieldCheck className="w-3.5 h-3.5" /><span>Batch saving: <strong>-{formatDuration(decision.batchSavingSec ?? decision.chosen.breakdown.batchSavingSec)}</strong></span>
                </span>
              )}
              {(decision.rejectedInfeasible ?? 0) > 0 && (
                <span className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg border bg-rose-950/40 border-rose-600/40 text-rose-300 text-xs font-mono">
                  <Filter className="w-3.5 h-3.5" /><span><strong>{decision.rejectedInfeasible}</strong> infeasible filtered</span>
                </span>
              )}
            </div>

            {/* Chosen pair + breakdown */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 space-y-3">
              <h3 className="font-mono text-xs font-bold text-white flex items-center justify-between border-b border-slate-800 pb-1.5">
                <span>Selected Assignment</span>
                <span className="text-emerald-400">Score: {Math.round(decision.chosen.totalCost)}</span>
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-900 border border-slate-800 p-2 rounded flex items-center space-x-2">
                  <UserCheck className="w-4 h-4 text-emerald-400" />
                  <div><span className="text-[10px] text-slate-500 block uppercase">Rider</span><strong className="text-white font-mono text-xs">{decision.chosen.riderId}</strong></div>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-2 rounded flex items-center space-x-2">
                  <Store className="w-4 h-4 text-sky-400" />
                  <div><span className="text-[10px] text-slate-500 block uppercase">Dark Store</span><strong className="text-white font-mono text-xs">{decision.chosen.storeId}</strong></div>
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-slate-500 uppercase font-mono">Cost Breakdown:</span>
                <div className="grid grid-cols-2 gap-1.5 text-[11px] font-mono">
                  {[
                    ['Travel', formatDuration(decision.chosen.breakdown.travelSec), 'text-white'],
                    ['Pack Wait', formatDuration(decision.chosen.breakdown.packWaitSec), 'text-white'],
                    ['Insertion Extra', formatDuration(decision.chosen.breakdown.insertionSec), 'text-white'],
                    ['Lateness Penalty', String(Math.round(decision.chosen.breakdown.latenessPenalty)), 'text-rose-400'],
                  ].map(([label, value, color]) => (
                    <div key={label} className="bg-slate-900 p-2 rounded border border-slate-800 flex justify-between">
                      <span className="text-slate-400">{label}:</span><span className={color}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Store options table */}
            {decision.storeOptions && decision.storeOptions.length > 0 && (
              <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 space-y-2">
                <h4 className="font-mono text-xs font-bold text-slate-300 flex items-center space-x-1.5">
                  <Store className="w-3.5 h-3.5 text-sky-400" /><span>{decision.storeOptions.length === 1 ? 'Serving Store (fixed by address)' : `Store Options (${decision.storeOptions.length})`}</span>
                </h4>
                <div className="grid grid-cols-[1fr_60px_48px_52px] text-[9px] uppercase font-mono text-slate-500 pb-1 border-b border-slate-800">
                  <span>Store</span><span className="text-center">ETA</span><span className="text-center">Queue</span><span className="text-center">OK?</span>
                </div>
                {decision.storeOptions.map((opt, i) => (
                  <div key={i} className={`grid grid-cols-[1fr_60px_48px_52px] items-center text-[11px] font-mono py-1 px-1 rounded ${opt.storeId === decision.chosen.storeId ? 'bg-emerald-950/30 border border-emerald-600/30' : ''}`}>
                    <span className="text-slate-300 truncate">{opt.storeId}</span>
                    <span className="text-center text-slate-400">{formatSimTime(opt.eta)}</span>
                    <span className="text-center text-slate-400">{opt.queueDepth}</span>
                    <span className={`text-center font-bold ${opt.feasible ? 'text-emerald-400' : 'text-rose-400'}`}>{opt.feasible ? '✓' : '✗'}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Rider options table */}
            {decision.riderOptions && decision.riderOptions.length > 0 && (
              <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 space-y-2">
                <h4 className="font-mono text-xs font-bold text-slate-300 flex items-center space-x-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-emerald-400" /><span>Rider Options ({decision.riderOptions.length})</span>
                </h4>
                <div className="grid grid-cols-[1fr_72px_72px_52px] text-[9px] uppercase font-mono text-slate-500 pb-1 border-b border-slate-800">
                  <span>Rider</span><span className="text-center">Insertion</span><span className="text-center">Trip ETA</span><span className="text-center">OK?</span>
                </div>
                {decision.riderOptions.map((opt, i) => (
                  <div key={i} className={`grid grid-cols-[1fr_72px_72px_52px] items-center text-[11px] font-mono py-1 px-1 rounded ${opt.riderId === decision.chosen.riderId ? 'bg-emerald-950/30 border border-emerald-600/30' : ''}`}>
                    <span className="text-slate-300 truncate">{opt.riderId}</span>
                    <span className="text-center text-slate-400">{formatDuration(opt.insertionTime)}</span>
                    <span className="text-center text-slate-400">{formatSimTime(opt.tripEta)}</span>
                    <span className={`text-center font-bold ${opt.feasible ? 'text-emerald-400' : 'text-rose-400'}`}>{opt.feasible ? '✓' : '✗'}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Runners-up */}
            {decision.runnersUp && decision.runnersUp.length > 0 && (
              <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 space-y-2">
                <h4 className="font-mono text-xs font-bold text-slate-400">Runner-Up Candidates:</h4>
                {decision.runnersUp.map((runner, i) => (
                  <div key={i} className="p-2 rounded bg-slate-900 border border-slate-800 flex items-center justify-between text-[11px] font-mono">
                    <div><span className="text-slate-500">#{i + 2}: </span><strong className="text-white">{runner.riderId}</strong><span className="text-slate-500"> @ {runner.storeId}</span></div>
                    <div><span className="text-slate-400">Cost: </span><strong className="text-amber-400">{Math.round(runner.totalCost)}</strong></div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 bg-slate-950 border border-slate-800 rounded text-slate-400">
            No decision record for this order yet. Orders in <em>placed</em> status have not been assigned.
          </div>
        )}
      </div>
    </div>
  );
};