import React, { useEffect, useMemo, useState } from 'react';
import { X, Minus, Plus, MapPin, Loader2, CheckCircle2 } from 'lucide-react';
import { PlaceResult, QuoteResult } from '../types';
import { ORDERABLE_SKUS, skuInfo } from '../lib/nameGen';
import { CLASS_META } from '../lib/theme';
import { formatClock, storeShort } from '../lib/format';

interface Props {
  pick: { lat: number; lng: number };
  quote: (lat: number, lng: number) => Promise<QuoteResult>;
  place: (lat: number, lng: number, items: { sku: string; qty: number }[]) => Promise<PlaceResult>;
  onClose: () => void;
  onTrack: (orderId: string) => void;
}

/** Zepto-style checkout for a spot picked on the map: nearest store, honest promise, only in-stock items. */
export const OrderComposer: React.FC<Props> = ({ pick, quote, place, onClose, onTrack }) => {
  const [q, setQ] = useState<QuoteResult | null>(null);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PlaceResult | null>(null);

  useEffect(() => {
    let live = true;
    setQ(null);
    setCart({});
    setResult(null);
    quote(pick.lat, pick.lng).then(r => live && setQ(r));
    return () => {
      live = false;
    };
  }, [pick.lat, pick.lng, quote]);

  const stock = q && q.ok ? q.stock : {};
  const inStock = useMemo(() => ORDERABLE_SKUS.filter(s => (stock[s] ?? 0) > 0), [stock]);
  const outOfStock = ORDERABLE_SKUS.length - inStock.length;
  const items = Object.entries(cart).filter(([, n]) => n > 0).map(([sku, qty]) => ({ sku, qty }));
  const total = items.reduce((a, i) => a + skuInfo(i.sku).price * i.qty, 0);

  const bump = (sku: string, d: number) =>
    setCart(c => ({ ...c, [sku]: Math.max(0, Math.min((stock[sku] ?? 0), 10, (c[sku] ?? 0) + d)) }));

  const submit = async () => {
    setBusy(true);
    const r = await place(pick.lat, pick.lng, items);
    setBusy(false);
    setResult(r);
  };

  return (
    <div className="absolute bottom-3 left-3 z-[600] flex max-h-[min(78%,560px)] w-[min(360px,calc(100%-1.5rem))] animate-rise flex-col overflow-hidden rounded-2xl border border-edge bg-panel shadow-[0_24px_60px_rgb(0_0_0/0.55)]">
      <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
        <div>
          <div className="eyebrow flex items-center gap-1"><MapPin size={11} /> New order at {pick.lat.toFixed(4)}, {pick.lng.toFixed(4)}</div>
          <h3 className="mt-1 font-display text-[15px] font-bold">
            {!q ? 'Finding your dark store…' : q.ok ? `Served by ${storeShort(q.storeName)}` : 'Can’t deliver here'}
          </h3>
        </div>
        <button className="btn btn-ghost h-8 px-2" onClick={onClose} aria-label="Close"><X size={16} /></button>
      </div>

      {!q && (
        <div className="flex items-center gap-2 px-4 py-6 text-mute"><Loader2 size={16} className="animate-spin" /> Checking the nearest store and stock</div>
      )}

      {q && !q.ok && (
        <div className="space-y-3 px-4 py-4">
          <p className="text-[13px] text-mute">{q.reason}</p>
          <p className="text-xs text-dim">Click another spot on the map.</p>
        </div>
      )}

      {q && q.ok && result?.ok && (
        <div className="space-y-3 px-4 py-4">
          <div className="flex items-center gap-2 text-good"><CheckCircle2 size={18} /> <span className="font-medium">Order {result.orderId} placed</span></div>
          <p className="text-[13px] text-mute">
            {CLASS_META[result.class].label}, promised in <span className="text-ink">{result.promiseMin} min</span> (by {formatClock(result.promisedBy)}).
            It entered all three worlds at the same moment, so you can watch each dispatcher handle it.
          </p>
          <div className="flex gap-2">
            <button className="btn btn-brand flex-1 justify-center" onClick={() => onTrack(result.orderId)}>Track this order</button>
            <button className="btn" onClick={() => { setResult(null); setCart({}); }}>Order again</button>
          </div>
        </div>
      )}

      {q && q.ok && !result?.ok && (
        <>
          <div className="flex flex-wrap items-center gap-2 px-4 pt-3 text-[12.5px] text-mute">
            <span className={`chip ${CLASS_META[q.class].cls}`}>{CLASS_META[q.class].label}</span>
            <span>Promise <span className="text-ink">{q.promiseMin} min</span></span>
            <span className="text-dim">·</span>
            <span className="num">{q.distanceKm.toFixed(2)} km away</span>
          </div>
          <ul className="mt-2 min-h-0 flex-1 overflow-y-auto px-2">
            {inStock.map(sku => {
              const info = skuInfo(sku);
              const n = cart[sku] ?? 0;
              return (
                <li key={sku} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-raise">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12.5px]">{info.name}</div>
                    <div className="num font-mono text-2xs text-dim">₹{info.price} · {stock[sku]} in stock</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button className="btn h-7 w-7 justify-center px-0" onClick={() => bump(sku, -1)} disabled={n === 0} aria-label={`Remove one ${info.name}`}><Minus size={13} /></button>
                    <span className="num w-5 text-center font-mono text-[13px]">{n}</span>
                    <button className="btn h-7 w-7 justify-center px-0" onClick={() => bump(sku, 1)} aria-label={`Add one ${info.name}`}><Plus size={13} /></button>
                  </div>
                </li>
              );
            })}
          </ul>
          {outOfStock > 0 && <div className="px-4 pt-1 text-2xs text-dim">{outOfStock} item(s) out of stock at this store aren’t offered.</div>}
          {result && !result.ok && <div className="mx-4 mt-2 rounded-lg border border-bad/30 bg-bad/10 px-3 py-2 text-xs text-bad">{result.reason}</div>}
          <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3">
            <div className="num font-mono text-[13px]">₹{total} <span className="text-dim">· {items.reduce((a, i) => a + i.qty, 0)} item(s)</span></div>
            <button className="btn btn-brand" disabled={items.length === 0 || busy} onClick={submit}>
              {busy && <Loader2 size={14} className="animate-spin" />} Place order
            </button>
          </div>
        </>
      )}
    </div>
  );
};
