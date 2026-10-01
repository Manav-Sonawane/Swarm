import React, { useMemo, useState } from 'react';
import { Bike, Store, Package, HelpCircle } from 'lucide-react';
import { OrderSnapshot, TickPayload, WorldName } from '../types';
import { WORLDS, WORLD_ORDER, CLASS_META } from '../lib/theme';
import { findOrder, isTerminal, worldData } from '../lib/lifecycle';
import { formatClock, storeShort } from '../lib/format';
import { getCustomerName, getOrderItems, getRiderName } from '../lib/nameGen';
import { WorldMap } from './WorldMap';
import { Timeline } from './Timeline';
import { Empty } from './ui';

interface Props {
  tick: TickPayload;
  trackId: string | null;
  onTrackId: (id: string) => void;
  placed: string[];
  onWhy: (world: WorldName, id: string) => void;
}

function headline(o: OrderSnapshot, now: number): { big: string; small: string; tone: 'good' | 'bad' | 'ink' } {
  if (o.status === 'delivered') {
    const d = (o.promisedBy - o.deliveredAt!) / 60;
    return d >= 0
      ? { big: `Delivered at ${formatClock(o.deliveredAt!)}`, small: `${d.toFixed(1)} min before the promise`, tone: 'good' }
      : { big: `Delivered at ${formatClock(o.deliveredAt!)}`, small: `${(-d).toFixed(1)} min after the promise`, tone: 'bad' };
  }
  if (o.status === 'failed' || o.status === 'cancelled') return { big: o.status === 'failed' ? 'Could not be delivered' : 'Cancelled', small: o.failReason ?? '', tone: 'bad' };
  const eta = o.projectedEta ?? o.promisedBy;
  const mins = Math.max(0, (eta - now) / 60);
  const late = eta > o.promisedBy;
  return {
    big: mins < 0.5 ? 'Arriving now' : `Arriving in ${Math.ceil(mins)} min`,
    small: late ? `Running ${((eta - o.promisedBy) / 60).toFixed(1)} min behind the promise (${formatClock(o.promisedBy)})` : `On track for the promise of ${formatClock(o.promisedBy)}`,
    tone: late ? 'bad' : 'good',
  };
}

export const TrackView: React.FC<Props> = ({ tick, trackId, onTrackId, placed, onWhy }) => {
  const [world, setWorld] = useState<WorldName>('swarm');
  const now = tick.simTime;

  const live = useMemo(
    () => tick.worlds.swarm.orders.filter(o => !isTerminal(o) || o.manual).sort((a, b) => b.createdAt - a.createdAt).slice(0, 40),
    [tick]
  );
  const mine = placed.filter(id => findOrder(tick, 'swarm', id) || findOrder(tick, 'baseline', id));
  const id = trackId ?? mine[0] ?? live[0]?.id ?? null;
  const order = id ? findOrder(tick, world, id) : undefined;
  const anyOrder = id ? WORLD_ORDER.map(w => findOrder(tick, w, id)).find(Boolean) : undefined;
  const stores = worldData(tick, world).stores;
  const storeName = (sid?: string) => storeShort(stores.find(s => s.id === sid)?.name ?? sid);
  const meta = WORLDS[world];

  return (
    <div className="screen grid h-full min-h-0 grid-cols-1 gap-3 overflow-y-auto p-3 lg:grid-cols-[300px_minmax(0,1fr)] lg:overflow-hidden">
      {/* Picker */}
      <section className="panel flex min-h-[300px] flex-col lg:min-h-0">
        <div className="border-b border-line px-4 py-3">
          <div className="eyebrow">What the customer sees</div>
          <h2 className="mt-1 font-display text-[15px] font-bold">Track an order</h2>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
          {mine.length > 0 && <div className="eyebrow px-2.5 pb-1 pt-2">Placed by you</div>}
          {mine.map(oid => <PickRow key={oid} id={oid} tick={tick} active={oid === id} onClick={() => onTrackId(oid)} />)}
          <div className="eyebrow px-2.5 pb-1 pt-3">Live orders</div>
          {live.length === 0 && <Empty title="No live orders" hint="Press Play, or place one from the Live screen." />}
          {live.filter(o => !mine.includes(o.id)).map(o => <PickRow key={o.id} id={o.id} tick={tick} active={o.id === id} onClick={() => onTrackId(o.id)} />)}
        </div>
      </section>

      {/* Tracking */}
      {!id || !anyOrder ? (
        <section className="panel grid place-items-center"><Empty title="Pick an order to track" hint="Or place one from the Live screen with “Place an order”, then press Track." /></section>
      ) : (
        <section className="grid min-h-0 grid-cols-1 gap-3 xl:grid-cols-[400px_minmax(0,1fr)]">
          <div className="flex min-h-0 flex-col gap-3 xl:overflow-y-auto">
            <div className="panel p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="eyebrow">Experience under</div>
                <div className="seg" role="group" aria-label="Dispatcher">
                  {WORLD_ORDER.map(w => (
                    <button key={w} aria-pressed={world === w} onClick={() => setWorld(w)} className="!h-7 !px-2.5 !text-[12px]">{WORLDS[w].label}</button>
                  ))}
                </div>
              </div>
              {!order ? (
                <p className="mt-4 text-[13px] text-mute">This order has left {meta.label}’s live window.</p>
              ) : (
                (() => {
                  const h = headline(order, now);
                  const used = Math.min(1.25, ((order.deliveredAt ?? now) - order.createdAt) / Math.max(1, order.promisedBy - order.createdAt));
                  return (
                    <>
                      <div className="mt-4 flex items-center gap-2">
                        <span className={`chip ${CLASS_META[order.class].cls}`}>{CLASS_META[order.class].label} · {Math.round((order.promisedBy - order.createdAt) / 60)} min promise</span>
                        <span className="font-mono text-2xs text-dim">{order.id}</span>
                      </div>
                      <div className={`mt-2 font-display text-[28px] font-extrabold leading-tight tracking-[-0.02em] ${h.tone === 'bad' ? 'text-bad' : 'text-ink'}`}>{h.big}</div>
                      <div className={`text-[13px] ${h.tone === 'good' ? 'text-good' : h.tone === 'bad' ? 'text-bad' : 'text-mute'}`}>{h.small}</div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-raise" title="Time used of the promised window">
                        <div className={`h-full rounded-full transition-[width] duration-1000 ease-linear ${used > 1 ? 'bg-bad' : ''}`} style={{ width: `${Math.min(100, used * 100)}%`, background: used > 1 ? undefined : meta.hex }} />
                      </div>
                      <div className="mt-1 flex justify-between font-mono text-2xs text-dim"><span>{formatClock(order.createdAt)}</span><span>promise {formatClock(order.promisedBy)}</span></div>
                      <div className="mt-4"><Timeline order={order} accent={meta.hex} /></div>
                    </>
                  );
                })()
              )}
            </div>

            {order && (
              <div className="panel space-y-2.5 p-4 text-[12.5px]">
                <div className="flex items-start gap-2.5">
                  <Bike size={16} className="mt-0.5 shrink-0 text-mute" />
                  <div>
                    <div className="text-ink">{order.riderId ? getRiderName(order.riderId) : 'Finding a rider…'}</div>
                    <div className="text-dim">
                      {order.riderId && order.riderHomeStoreId && order.riderHomeStoreId !== order.servingStoreId ? `Rode in from ${storeName(order.riderHomeStoreId)}` : order.riderId ? 'From your dark store' : 'Assigned as soon as one is free'}
                      {(order.tripSize ?? 1) > 1 ? ` · sharing the trip with ${order.tripSize! - 1} other order(s)` : ''}
                      {order.handover ? ' · picking your order up from another rider' : ''}
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <Store size={16} className="mt-0.5 shrink-0 text-mute" />
                  <div><div className="text-ink">{storeName(order.servingStoreId)}</div><div className="text-dim">Your nearest dark store</div></div>
                </div>
                <div className="flex items-start gap-2.5">
                  <Package size={16} className="mt-0.5 shrink-0 text-mute" />
                  <div className="text-mute">{getOrderItems(order.id, order.items).map(i => `${i.qty}× ${i.name}`).join(', ')}</div>
                </div>
                <div className="text-dim">{getCustomerName(order.id, tick.seed)}</div>
                <button className="btn w-full justify-center" onClick={() => onWhy(world, order.id)}><HelpCircle size={15} /> Why this rider?</button>
              </div>
            )}

            <div className="panel p-4">
              <div className="eyebrow mb-2">Same order, other dispatchers</div>
              <div className="space-y-1.5">
                {WORLD_ORDER.map(w => {
                  const o = findOrder(tick, w, id);
                  const h = o ? headline(o, now) : null;
                  return (
                    <button key={w} onClick={() => setWorld(w)} className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-[12.5px] ${w === world ? 'bg-lift' : 'hover:bg-raise'}`}>
                      <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: WORLDS[w].hex }} />{WORLDS[w].label}</span>
                      <span className={`truncate ${h?.tone === 'bad' ? 'text-bad' : h?.tone === 'good' ? 'text-good' : 'text-dim'}`}>{h ? h.big : 'not in live window'}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="min-h-[420px] xl:min-h-0">
            <WorldMap
              world={world}
              data={worldData(tick, world)}
              jam={tick.trafficJam}
              focusOrderId={id}
              flyTo={anyOrder ? [anyOrder.lat, anyOrder.lng] : null}
            />
          </div>
        </section>
      )}
    </div>
  );
};

const PickRow: React.FC<{ id: string; tick: TickPayload; active: boolean; onClick: () => void }> = ({ id, tick, active, onClick }) => {
  const o = findOrder(tick, 'swarm', id) ?? findOrder(tick, 'baseline', id);
  if (!o) return null;
  return (
    <button onClick={onClick} className={`flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left transition-colors ${active ? 'bg-lift shadow-[inset_0_0_0_1px_rgb(var(--edge))]' : 'hover:bg-raise'}`}>
      <div className="min-w-0">
        <div className="font-mono text-[12.5px]">{id}</div>
        <div className="truncate text-[11.5px] text-dim">{getCustomerName(id, tick.seed)}</div>
      </div>
      <span className={`chip ${CLASS_META[o.class].cls}`}>{CLASS_META[o.class].label}</span>
    </button>
  );
};
