import React, { useMemo, useState } from 'react';
import { Search, Navigation, HelpCircle } from 'lucide-react';
import { OrderSnapshot, TickPayload, WorldName } from '../types';
import { WORLDS, WORLD_ORDER, CLASS_META, ORDER_STATUS_LABEL } from '../lib/theme';
import { findOrder, isTerminal, worldData } from '../lib/lifecycle';
import { formatClock, storeShort } from '../lib/format';
import { getCustomerName, getOrderItems, getRiderName } from '../lib/nameGen';
import { Timeline } from './Timeline';
import { Empty } from './ui';

type Filter = 'all' | 'open' | 'swarm_better' | 'mine';

interface Props {
  tick: TickPayload;
  orderId: string | null;
  onOrder: (id: string) => void;
  onWhy: (world: WorldName, id: string) => void;
  onTrack: (id: string) => void;
  placed: string[];
}

type Outcome = { kind: 'ontime' | 'late' | 'open' | 'risk' | 'failed' | 'none'; min?: number };

function outcome(o: OrderSnapshot | undefined, now: number): Outcome {
  if (!o) return { kind: 'none' };
  if (o.status === 'delivered') {
    const late = (o.deliveredAt! - o.promisedBy) / 60;
    return late > 0 ? { kind: 'late', min: late } : { kind: 'ontime', min: (o.deliveredAt! - o.createdAt) / 60 };
  }
  if (o.status === 'failed' || o.status === 'cancelled' || o.status === 'rejected') return { kind: 'failed' };
  return o.isLate ? { kind: 'risk', min: ((o.projectedEta ?? now) - o.promisedBy) / 60 } : { kind: 'open' };
}

const PILL: Record<Outcome['kind'], string> = {
  ontime: 'bg-good/15 text-good border-good/30',
  late: 'bg-bad/15 text-bad border-bad/30',
  risk: 'bg-warn/15 text-warn border-warn/30',
  open: 'bg-raise text-mute border-line',
  failed: 'bg-bad/10 text-bad/80 border-bad/20',
  none: 'bg-transparent text-dim border-line/60',
};

export const OrdersView: React.FC<Props> = ({ tick, orderId, onOrder, onWhy, onTrack, placed }) => {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const now = tick.simTime;

  const rows = useMemo(() => {
    const ids = new Map<string, number>();
    for (const w of WORLD_ORDER) for (const o of worldData(tick, w).orders) if (!ids.has(o.id)) ids.set(o.id, o.createdAt);
    return [...ids.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => ({ id, o: Object.fromEntries(WORLD_ORDER.map(w => [w, findOrder(tick, w, id)])) as Record<WorldName, OrderSnapshot | undefined> }));
  }, [tick]);

  const filtered = rows.filter(({ id, o }) => {
    const s = o.swarm ?? o.baseline ?? o.naive!;
    if (q && !`${id} ${getCustomerName(id, tick.seed)}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (filter === 'open') return !isTerminal(s);
    if (filter === 'mine') return placed.includes(id) || !!s.manual;
    if (filter === 'swarm_better') {
      const a = outcome(o.swarm, now), b = outcome(o.baseline, now);
      return a.kind === 'ontime' && (b.kind === 'late' || b.kind === 'risk');
    }
    return true;
  });

  const sel = orderId ?? filtered[0]?.id ?? null;
  const selRow = rows.find(r => r.id === sel);

  return (
    <div className="screen grid h-full min-h-0 grid-cols-1 gap-3 overflow-y-auto p-3 lg:grid-cols-[380px_minmax(0,1fr)] lg:overflow-hidden">
      {/* List */}
      <section className="panel flex min-h-[420px] min-w-0 flex-col lg:min-h-0">
        <div className="space-y-2.5 border-b border-line p-3">
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-dim" />
            <input id="order-search" className="field pl-9" placeholder="Search order id or customer" value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <div className="seg w-full" role="group" aria-label="Filter orders">
            {([['all', 'All'], ['open', 'Open'], ['swarm_better', 'Swarm won'], ['mine', 'Yours']] as [Filter, string][]).map(([f, l]) => (
              <button key={f} className="flex-1 whitespace-nowrap !px-2" aria-pressed={filter === f} onClick={() => setFilter(f)}>{l}</button>
            ))}
          </div>
          <div className="flex items-center gap-3 text-2xs text-dim">
            {WORLD_ORDER.map(w => <span key={w} className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full" style={{ background: WORLDS[w].hex }} />{WORLDS[w].short} = {WORLDS[w].label}</span>)}
          </div>
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto p-1.5">
          {filtered.length === 0 && <Empty title="No orders match" hint={filter === 'mine' ? 'Place one from the Live screen with “Place an order”.' : 'Press Play to start the order stream.'} />}
          {filtered.slice(0, 200).map(({ id, o }) => {
            const s = o.swarm ?? o.baseline ?? o.naive!;
            return (
              <li key={id}>
                <button
                  onClick={() => onOrder(id)}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors ${sel === id ? 'bg-lift shadow-[inset_0_0_0_1px_rgb(var(--edge))]' : 'hover:bg-raise'}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[12.5px] font-medium">{id}</span>
                      {s.manual && <span className="chip h-5 border-brand/40 px-1.5 text-[10px] text-brand">yours</span>}
                    </div>
                    <div className="truncate text-[11.5px] text-dim">{getCustomerName(id, tick.seed)} · {CLASS_META[s.class].label} · {formatClock(s.createdAt)}</div>
                  </div>
                  <div className="flex gap-1">
                    {WORLD_ORDER.map(w => {
                      const r = outcome(o[w], now);
                      return (
                        <span key={w} className={`grid h-6 w-6 place-items-center rounded-md border font-mono text-[10px] font-semibold ${PILL[r.kind]}`} title={`${WORLDS[w].label}: ${r.kind}`}>
                          {WORLDS[w].short}
                        </span>
                      );
                    })}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Detail */}
      <section className="min-w-0 lg:min-h-0 lg:overflow-y-auto">
        {!selRow ? (
          <div className="panel"><Empty title="Pick an order" hint="Every order goes to all three dispatchers at the same moment. Pick one to see how each handled it." /></div>
        ) : (
          <OrderCompare tick={tick} id={selRow.id} o={selRow.o} onWhy={onWhy} onTrack={onTrack} />
        )}
      </section>
    </div>
  );
};

const OrderCompare: React.FC<{ tick: TickPayload; id: string; o: Record<WorldName, OrderSnapshot | undefined>; onWhy: Props['onWhy']; onTrack: Props['onTrack'] }> = ({ tick, id, o, onWhy, onTrack }) => {
  const any = (o.swarm ?? o.baseline ?? o.naive)!;
  const stores = tick.worlds.swarm.stores;
  const storeName = (sid?: string) => storeShort(stores.find(s => s.id === sid)?.name ?? sid);
  const items = getOrderItems(id, any.items);
  const total = items.reduce((a, i) => a + i.price, 0);
  const sw = outcome(o.swarm, tick.simTime), bl = outcome(o.baseline, tick.simTime);
  const sTime = o.swarm?.deliveredAt, bTime = o.baseline?.deliveredAt;
  const verdict =
    sTime !== undefined && bTime !== undefined
      ? `Swarm delivered ${Math.abs((bTime - sTime) / 60).toFixed(1)} min ${sTime <= bTime ? 'earlier' : 'later'} than Baseline.`
      : sw.kind === 'ontime' && bl.kind === 'risk'
      ? 'Swarm delivered on time; Baseline is running late.'
      : 'Still in progress in at least one world.';

  return (
    <div className="space-y-3">
      <div className="panel p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="eyebrow">Same order, three dispatchers</div>
            <h2 className="mt-1 font-display text-[22px] font-extrabold tracking-[-0.02em]">{id} <span className="font-sans text-[15px] font-medium text-mute">{getCustomerName(id, tick.seed)}</span></h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[12.5px] text-mute">
              <span className={`chip ${CLASS_META[any.class].cls}`}>{CLASS_META[any.class].label} · {Math.round((any.promisedBy - any.createdAt) / 60)} min</span>
              <span>Served by <span className="text-ink">{storeName(any.servingStoreId)}</span></span>
              <span>· placed {formatClock(any.createdAt)}, promised by <span className="text-ink">{formatClock(any.promisedBy)}</span></span>
            </div>
          </div>
          <button className="btn" onClick={() => onTrack(id)}><Navigation size={15} /> Track as customer</button>
        </div>
        <div className="mt-3 rounded-xl border border-line bg-bg/60 px-3 py-2 text-[12.5px] text-mute">
          {items.map(i => `${i.qty}× ${i.name}`).join(', ')} <span className="num ml-1 font-mono text-ink">₹{total}</span>
        </div>
        <div className="mt-3 font-display text-[15px] font-bold text-ink">{verdict}</div>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        {WORLD_ORDER.map(w => {
          const ord = o[w];
          const meta = WORLDS[w];
          const r = outcome(ord, tick.simTime);
          return (
            <div key={w} className="panel flex flex-col p-4" style={{ boxShadow: `inset 0 3px 0 ${meta.hex}` }}>
              <div className="flex items-center justify-between">
                <span className={`font-display text-[15px] font-bold ${meta.text}`}>{meta.label}</span>
                {ord && (ord.tripSize ?? 1) > 1 && <span className="chip border-swarm/30 bg-swarm/10 text-swarm">Batched ×{ord.tripSize}</span>}
              </div>
              <p className="mt-1 text-[11.5px] leading-snug text-dim">{meta.rule}</p>
              {!ord ? (
                <p className="mt-4 text-[12.5px] text-dim">Not in this world’s live window any more.</p>
              ) : (
                <>
                  <div className={`mt-3 rounded-xl border px-3 py-2 ${PILL[r.kind]}`}>
                    <div className="text-[13px] font-semibold">
                      {r.kind === 'ontime' && `On time · ${r.min!.toFixed(1)} min door to door`}
                      {r.kind === 'late' && `Late by ${r.min!.toFixed(1)} min`}
                      {r.kind === 'risk' && `Running late · ETA ${formatClock(ord.projectedEta ?? tick.simTime)}`}
                      {r.kind === 'open' && `${ORDER_STATUS_LABEL[ord.status]} · ETA ${formatClock(ord.projectedEta ?? ord.promisedBy)}`}
                      {r.kind === 'failed' && ORDER_STATUS_LABEL[ord.status]}
                    </div>
                  </div>
                  <div className="mt-3 text-[12px] text-mute">
                    Rider <span className="text-ink">{ord.riderId ? getRiderName(ord.riderId) : '—'}</span>
                    {ord.riderHomeStoreId && ord.riderHomeStoreId !== ord.servingStoreId && <span className="text-warn"> · from {storeName(ord.riderHomeStoreId)}</span>}
                  </div>
                  <div className="mt-3 flex-1"><Timeline order={ord} accent={meta.hex} compact /></div>
                  <button className="btn mt-2 w-full justify-center" onClick={() => onWhy(w, id)}><HelpCircle size={15} /> Why this rider?</button>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
