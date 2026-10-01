import React, { useEffect, useState } from 'react';
import { X, ArrowRightLeft, Navigation, Loader2 } from 'lucide-react';
import { DecisionRecord, TickPayload, WorldName } from '../types';
import { WORLDS, CLASS_META, ORDER_STATUS_LABEL } from '../lib/theme';
import { findOrder, slackMin, worldData } from '../lib/lifecycle';
import { formatClock, formatDuration, storeShort } from '../lib/format';
import { getCustomerName, getOrderItems, getRiderName } from '../lib/nameGen';
import { Timeline } from './Timeline';

interface Props {
  tick: TickPayload;
  world: WorldName;
  orderId: string;
  onClose: () => void;
  onCompare: (id: string) => void;
  onTrack: (id: string) => void;
}

/** Slide-over explaining one order in one world: its journey and why it went to that rider. */
export const DecisionDrawer: React.FC<Props> = ({ tick, world, orderId, onClose, onCompare, onTrack }) => {
  const order = findOrder(tick, world, orderId);
  const meta = WORLDS[world];
  const [decision, setDecision] = useState<DecisionRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const riderKey = order?.riderId ?? '';

  useEffect(() => {
    let live = true;
    setLoading(true);
    fetch(`/api/decision/${world}/${orderId}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => live && setDecision(d))
      .catch(() => live && setDecision(null))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [world, orderId, riderKey]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const stores = worldData(tick, world).stores;
  const storeName = (id?: string) => storeShort(stores.find(s => s.id === id)?.name ?? id);

  return (
    <>
      <div className="fixed inset-0 z-[900] animate-fade bg-black/40" onClick={onClose} />
      <aside className="fixed inset-y-0 right-0 z-[901] flex w-full max-w-[440px] animate-slidein flex-col border-l border-edge bg-panel shadow-[-24px_0_60px_rgb(0_0_0/0.45)]" aria-label="Order details">
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: meta.hex }} />
              <span className={`text-[12px] font-medium ${meta.text}`}>{meta.label}</span>
              {order && <span className={`chip ${CLASS_META[order.class].cls}`}>{CLASS_META[order.class].label}</span>}
            </div>
            <h2 className="mt-1.5 font-display text-[19px] font-bold">{orderId}</h2>
            <div className="text-[12.5px] text-mute">{getCustomerName(orderId, tick.seed)}</div>
          </div>
          <button className="btn btn-ghost h-8 px-2" onClick={onClose} aria-label="Close"><X size={17} /></button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {!order ? (
            <p className="text-[13px] text-mute">This order has left the live window of {meta.label} (only open orders and the last 30 deliveries are kept on screen).</p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl border border-line bg-bg/60 p-2.5">
                  <div className="eyebrow">Promise</div>
                  <div className="num mt-1 font-mono text-[14px]">{formatClock(order.promisedBy)}</div>
                </div>
                <div className="rounded-xl border border-line bg-bg/60 p-2.5">
                  <div className="eyebrow">{order.deliveredAt ? 'Delivered' : 'Expected'}</div>
                  <div className="num mt-1 font-mono text-[14px]">{formatClock(order.deliveredAt ?? order.projectedEta ?? order.promisedBy)}</div>
                </div>
                {(() => {
                  const s = slackMin(order, tick.simTime);
                  return (
                    <div className={`rounded-xl border p-2.5 ${s < 0 ? 'border-bad/40 bg-bad/10' : 'border-good/30 bg-good/10'}`}>
                      <div className="eyebrow">{s < 0 ? 'Late by' : 'Early by'}</div>
                      <div className={`num mt-1 font-mono text-[14px] ${s < 0 ? 'text-bad' : 'text-good'}`}>{Math.abs(s).toFixed(1)} min</div>
                    </div>
                  );
                })()}
              </div>

              <div>
                <div className="eyebrow mb-2">Journey · {ORDER_STATUS_LABEL[order.status]}</div>
                <Timeline order={order} accent={meta.hex} />
              </div>

              <div className="rounded-xl border border-line bg-bg/60 p-3 text-[12.5px]">
                <div className="grid grid-cols-[96px_1fr] gap-y-1.5">
                  <span className="text-dim">Serving store</span><span>{storeName(order.servingStoreId ?? order.storeId)}</span>
                  <span className="text-dim">Rider</span>
                  <span>
                    {order.riderId ? `${getRiderName(order.riderId)} (${order.riderId})` : 'Not assigned yet'}
                    {order.riderHomeStoreId && order.riderHomeStoreId !== (order.servingStoreId ?? order.storeId) && (
                      <span className="text-warn"> · rode in from {storeName(order.riderHomeStoreId)}</span>
                    )}
                  </span>
                  <span className="text-dim">Trip</span><span>{(order.tripSize ?? 1) > 1 ? `Batched, ${order.tripSize} orders` : order.tripSize ? 'Solo' : '—'}</span>
                  <span className="text-dim">Basket</span>
                  <span>{getOrderItems(order.id, order.items).map(i => `${i.qty}× ${i.name}`).join(', ')}</span>
                  {order.failReason && (<><span className="text-dim">Note</span><span className="text-warn">{order.failReason}</span></>)}
                </div>
              </div>
            </>
          )}

          <div>
            <div className="eyebrow mb-2">Why this rider</div>
            {loading && !decision ? (
              <div className="flex items-center gap-2 text-mute"><Loader2 size={14} className="animate-spin" /> Loading the decision</div>
            ) : !decision ? (
              <p className="text-[12.5px] text-mute">No decision yet: the order is waiting for a free rider{world !== 'swarm' ? ' (this dispatcher only uses free riders, one order per trip)' : ''}.</p>
            ) : (
              <div className="space-y-3">
                <p className="rounded-xl border border-line bg-bg/60 p-3 text-[12.5px] leading-relaxed text-ink">{decision.reason}</p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl border border-line p-2">
                    <div className="eyebrow">Batch saving</div>
                    <div className="num mt-1 font-mono text-[13px]">{formatDuration(decision.batchSavingSec ?? 0)}</div>
                  </div>
                  <div className="rounded-xl border border-line p-2" title="Options thrown out because they would make someone late">
                    <div className="eyebrow">Filtered out</div>
                    <div className="num mt-1 font-mono text-[13px]">{decision.rejectedInfeasible ?? 0}</div>
                  </div>
                  <div className="rounded-xl border border-line p-2">
                    <div className="eyebrow">Decided in</div>
                    <div className="num mt-1 font-mono text-[13px]">{(decision.decisionMs ?? 0).toFixed(2)} ms</div>
                  </div>
                </div>
                {decision.riderOptions && decision.riderOptions.length > 0 && (
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="text-left">
                        <th className="pb-1 font-normal"><span className="eyebrow">Rider considered</span></th>
                        <th className="pb-1 text-right font-normal"><span className="eyebrow">Extra riding</span></th>
                        <th className="pb-1 text-right font-normal"><span className="eyebrow">Arrives</span></th>
                        <th className="pb-1 text-right font-normal"><span className="eyebrow">On time?</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {decision.riderOptions.map(r => (
                        <tr key={r.riderId} className={`border-t border-line/70 ${r.riderId === decision.chosen.riderId ? 'text-ink' : 'text-mute'}`}>
                          <td className="py-1.5">{r.riderId === decision.chosen.riderId ? '→ ' : ''}{getRiderName(r.riderId)}</td>
                          <td className="num py-1.5 text-right font-mono">{formatDuration(r.insertionTime)}</td>
                          <td className="num py-1.5 text-right font-mono">{formatClock(r.tripEta)}</td>
                          <td className={`py-1.5 text-right ${r.feasible ? 'text-good' : 'text-bad'}`}>{r.feasible ? 'yes' : 'no'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2 border-t border-line px-5 py-3">
          <button className="btn flex-1 justify-center" onClick={() => onCompare(orderId)}><ArrowRightLeft size={15} /> Compare all three</button>
          <button className="btn btn-brand flex-1 justify-center" onClick={() => onTrack(orderId)}><Navigation size={15} /> Track as customer</button>
        </div>
      </aside>
    </>
  );
};
