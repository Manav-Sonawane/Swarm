import React, { useEffect, useMemo, useState } from 'react';
import { RotateCcw, Shuffle } from 'lucide-react';
import { SetupConfig, TickPayload } from '../types';
import { ORDERABLE_SKUS, skuInfo } from '../lib/nameGen';
import { formatClock, storeShort } from '../lib/format';
import { RIDER_STATUS } from '../lib/theme';
import { SectionTitle } from './ui';

const DEFAULTS: SetupConfig = {
  ridersPerStore: 6,
  ordersPerHour: 255,
  packingSlots: 2,
  capacity: 3,
  baseSpeedKmh: 12,
  shiftPattern: 'all_evening',
  baselinePromises10: false,
};

type NumKey = 'ridersPerStore' | 'ordersPerHour' | 'packingSlots' | 'capacity' | 'baseSpeedKmh';
const FIELDS: { key: NumKey; label: string; hint: string; min: number; max: number; step: number; unit: string }[] = [
  { key: 'ridersPerStore', label: 'Riders per store', hint: '15 stores, so ×15 riders in the city', min: 2, max: 12, step: 1, unit: '' },
  { key: 'ordersPerHour', label: 'Orders per hour', hint: 'City-wide arrival rate before surges', min: 60, max: 600, step: 15, unit: '/h' },
  { key: 'packingSlots', label: 'Packers per store', hint: 'Orders a store can pack at the same time', min: 1, max: 4, step: 1, unit: '' },
  { key: 'capacity', label: 'Bag capacity', hint: 'Most orders one rider can carry (Swarm only batches)', min: 1, max: 4, step: 1, unit: '' },
  { key: 'baseSpeedKmh', label: 'Rider speed', hint: 'Average city speed before rain and gridlock', min: 8, max: 20, step: 1, unit: ' km/h' },
];

interface Props {
  tick: TickPayload;
  onApply: (setup: SetupConfig, seed: number) => void;
}

export const SetupView: React.FC<Props> = ({ tick, onApply }) => {
  const [form, setForm] = useState<SetupConfig>(tick.setup ?? DEFAULTS);
  const [seed, setSeed] = useState(String(tick.seed));
  const [applied, setApplied] = useState(false);

  // Follow the server after a reset from elsewhere, unless the user is mid-edit
  const serverKey = JSON.stringify(tick.setup) + tick.seed;
  useEffect(() => {
    if (tick.setup) setForm(tick.setup);
    setSeed(String(tick.seed));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverKey]);

  const dirty = JSON.stringify(form) !== JSON.stringify(tick.setup ?? DEFAULTS) || seed !== String(tick.seed);
  const seedNum = Number(seed);
  const seedOk = Number.isInteger(seedNum) && seedNum >= 0;

  const apply = () => {
    onApply(form, seedNum);
    setApplied(true);
    window.setTimeout(() => setApplied(false), 2200);
  };

  const riders = tick.worlds.swarm.riders;
  const roster = useMemo(() => {
    const byStatus = new Map<string, number>();
    for (const r of riders) byStatus.set(r.status, (byStatus.get(r.status) ?? 0) + 1);
    return byStatus;
  }, [riders]);
  const shiftEnds = useMemo(
    () => riders.filter(r => r.shiftEndsAt !== undefined && r.shiftEndsAt > tick.simTime).sort((a, b) => a.shiftEndsAt! - b.shiftEndsAt!).slice(0, 3),
    [riders, tick.simTime]
  );
  const shiftStarts = useMemo(
    () => riders.filter(r => r.shiftStartsAt !== undefined && r.shiftStartsAt > tick.simTime).sort((a, b) => a.shiftStartsAt! - b.shiftStartsAt!).slice(0, 3),
    [riders, tick.simTime]
  );

  const stores = tick.worlds.swarm.stores;
  const stock = tick.stock ?? {};

  return (
    <div className="screen h-full overflow-y-auto">
      <div className="mx-auto max-w-[1400px] space-y-3 p-3 lg:p-5">
        <div>
          <div className="eyebrow">Changes take effect when the run restarts</div>
          <h1 className="mt-1 font-display text-[26px] font-extrabold tracking-[-0.02em]">Setup</h1>
        </div>

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_420px]">
          {/* Run settings */}
          <div className="panel p-4">
            <SectionTitle eyebrow="Same settings for all three dispatchers" title="City and fleet" />
            <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2">
              {FIELDS.map(f => (
                <label key={f.key} className="block">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[13px] font-medium">{f.label}</span>
                    <span className="num font-mono text-[14px] font-semibold">{form[f.key]}{f.unit}</span>
                  </div>
                  <input
                    type="range"
                    min={f.min}
                    max={f.max}
                    step={f.step}
                    value={form[f.key]}
                    onChange={e => setForm(s => ({ ...s, [f.key]: Number(e.target.value) }))}
                    className="mt-2 w-full accent-[rgb(var(--brand))]"
                  />
                  <div className="mt-0.5 flex justify-between text-2xs text-dim"><span>{f.hint}</span><span className="num font-mono">{f.min}–{f.max}</span></div>
                </label>
              ))}

              <div>
                <div className="text-[13px] font-medium">Rider shifts</div>
                <div className="seg mt-2 w-full" role="group" aria-label="Rider shifts">
                  <button className="flex-1" aria-pressed={form.shiftPattern === 'all_evening'} onClick={() => setForm(s => ({ ...s, shiftPattern: 'all_evening' }))}>Everyone on</button>
                  <button className="flex-1" aria-pressed={form.shiftPattern === 'staggered'} onClick={() => setForm(s => ({ ...s, shiftPattern: 'staggered' }))}>Staggered</button>
                </div>
                <div className="mt-1 text-2xs text-dim">
                  {form.shiftPattern === 'staggered' ? 'One rider per store starts 30 min in, another clocks off at 90 min. Riders finish their bag before going off shift.' : 'The whole fleet works the full evening.'}
                </div>
              </div>

              <div>
                <div className="text-[13px] font-medium">Baseline’s promise</div>
                <div className="seg mt-2 w-full" role="group" aria-label="Baseline promise">
                  <button className="flex-1" aria-pressed={!form.baselinePromises10} onClick={() => setForm(s => ({ ...s, baselinePromises10: false }))}>Honest, by distance</button>
                  <button className="flex-1" aria-pressed={form.baselinePromises10} onClick={() => setForm(s => ({ ...s, baselinePromises10: true }))}>10 min to everyone</button>
                </div>
                <div className="mt-1 text-2xs text-dim">The second mimics the “10 minutes for all” marketing promise.</div>
              </div>

              <label className="block">
                <div className="text-[13px] font-medium">Seed</div>
                <div className="mt-2 flex gap-2">
                  <input className="field font-mono" inputMode="numeric" value={seed} onChange={e => setSeed(e.target.value.replace(/[^0-9]/g, ''))} aria-invalid={!seedOk} />
                  <button className="btn shrink-0" onClick={() => setSeed(String(Math.floor(Math.random() * 100000)))} title="Random seed"><Shuffle size={15} /></button>
                </div>
                <div className="mt-1 text-2xs text-dim">The same seed replays the exact same orders, weather and disruptions.</div>
              </label>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
              <button className="btn btn-ghost" onClick={() => { setForm(DEFAULTS); setSeed('42'); }}>Default settings</button>
              <div className="flex items-center gap-3">
                {applied && <span className="animate-fade text-[12.5px] text-good">Restarted with these settings</span>}
                <button className="btn btn-brand" disabled={!seedOk} onClick={apply}>
                  <RotateCcw size={15} /> {dirty ? 'Apply and restart' : 'Restart'}
                </button>
              </div>
            </div>
          </div>

          {/* Fleet now */}
          <div className="panel p-4">
            <SectionTitle eyebrow={`Swarm world · ${riders.length} riders`} title="Fleet right now" />
            <div className="mt-3 grid grid-cols-2 gap-2">
              {Object.entries(RIDER_STATUS).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between rounded-xl border border-line bg-bg/60 px-3 py-2">
                  <span className="inline-flex items-center gap-2 text-[12.5px] text-mute"><span className="h-2.5 w-2.5 rounded-full" style={{ background: v.hex }} />{v.label}</span>
                  <span className="num font-mono text-[14px] font-semibold">{roster.get(k) ?? 0}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-3 text-[12.5px]">
              <div>
                <div className="eyebrow mb-1">Next to clock off</div>
                {shiftEnds.length === 0 ? <div className="text-dim">Nobody during this run.</div> : shiftEnds.map(r => (
                  <div key={r.id} className="flex justify-between text-mute"><span>{r.id} · {storeShort(stores.find(s => s.id === r.homeStoreId)?.name)}</span><span className="num font-mono">{formatClock(r.shiftEndsAt!)}</span></div>
                ))}
              </div>
              <div>
                <div className="eyebrow mb-1">Next to clock on</div>
                {shiftStarts.length === 0 ? <div className="text-dim">Everyone is already on shift.</div> : shiftStarts.map(r => (
                  <div key={r.id} className="flex justify-between text-mute"><span>{r.id} · {storeShort(stores.find(s => s.id === r.homeStoreId)?.name)}</span><span className="num font-mono">{formatClock(r.shiftStartsAt!)}</span></div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Stock */}
        <div className="panel p-4">
          <SectionTitle eyebrow="Live, Swarm world · checkout only offers what’s on the shelf" title="Dark store stock" />
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[900px] text-[12px]">
              <thead>
                <tr>
                  <th className="sticky left-0 bg-panel pb-2 pr-3 text-left font-normal"><span className="eyebrow">Store</span></th>
                  {ORDERABLE_SKUS.map(s => (
                    <th key={s} className="pb-2 font-normal" title={skuInfo(s).name}>
                      <span className="block max-w-[64px] truncate text-2xs text-dim">{skuInfo(s).name}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stores.map(st => (
                  <tr key={st.id} className="border-t border-line/70">
                    <td className="sticky left-0 whitespace-nowrap bg-panel py-1.5 pr-3">
                      <span className={st.offline ? 'text-bad line-through' : 'text-ink'}>{storeShort(st.name)}</span>
                    </td>
                    {ORDERABLE_SKUS.map(s => {
                      const n = stock[st.id]?.[s] ?? 0;
                      return (
                        <td key={s} className="py-1.5 text-center">
                          <span className={`num inline-block min-w-[30px] rounded-md px-1 py-0.5 font-mono ${n === 0 ? 'bg-bad/15 text-bad' : n <= 5 ? 'bg-warn/10 text-warn' : 'text-mute'}`}>{n}</span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-2 flex gap-4 text-2xs text-dim">
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-bad/60" /> Out of stock</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-warn/60" /> 5 or fewer left</span>
          </div>
        </div>
      </div>
    </div>
  );
};
