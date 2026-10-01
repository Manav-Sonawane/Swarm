import React from 'react';
import { Metrics, TickPayload, WorldName } from '../types';
import { WORLDS } from '../lib/theme';
import { Delta, Num, Spark } from './ui';

type Row = {
  label: string;
  hint: string;
  get: (m: Metrics) => number;
  decimals: number;
  suffix?: string;
  higherIsBetter: boolean;
};

const ROWS: Row[] = [
  { label: 'On time', hint: 'Share of decided orders delivered within the promise', get: m => m.onTimeRate, decimals: 1, suffix: '%', higherIsBetter: true },
  { label: 'P90 late', hint: '9 in 10 orders are no later than this past their promise', get: m => m.p90LatenessSec / 60, decimals: 1, suffix: 'm', higherIsBetter: false },
  { label: 'Late now', hint: 'Open orders already past, or projected past, their promise', get: m => m.lateNow, decimals: 0, higherIsBetter: false },
  { label: 'Delivered', hint: 'Orders delivered so far', get: m => m.delivered, decimals: 0, higherIsBetter: true },
  { label: 'Per trip', hint: 'Orders carried per trip (batching)', get: m => m.ordersPerTrip, decimals: 2, higherIsBetter: true },
  { label: 'Km/order', hint: 'Rider kilometres per delivered order', get: m => m.kmPerOrder, decimals: 2, higherIsBetter: false },
];

const COLS: WorldName[] = ['swarm', 'baseline', 'naive'];

export const Scoreboard: React.FC<{ tick: TickPayload }> = ({ tick }) => {
  const m = {
    swarm: tick.worlds.swarm.metrics,
    baseline: tick.worlds.baseline.metrics,
    naive: tick.worlds.naive?.metrics ?? tick.worlds.baseline.metrics,
  };
  const lead = m.swarm.onTimeRate - m.baseline.onTimeRate;
  const hist = (w: WorldName) => m[w].history.map(h => h.onTimeRate);

  return (
    <section className="panel p-4" aria-label="Live scoreboard">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="eyebrow">Same orders, three dispatchers</div>
          <div className="mt-1 font-display text-[22px] font-extrabold leading-none tracking-[-0.02em]">
            <span className="text-swarm">Swarm</span>{' '}
            <span className="text-mute">{lead >= 0 ? 'leads' : 'trails'} by</span>{' '}
            <Num value={Math.abs(lead)} decimals={1} className={lead >= 0 ? 'text-swarm' : 'text-bad'} />
            <span className="text-mute"> pts</span>
          </div>
        </div>
        <Delta diff={lead} higherIsBetter unit=" pts" />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {(['swarm', 'baseline'] as WorldName[]).map(w => (
          <div key={w} className="rounded-xl border border-line bg-bg/60 px-2.5 pb-1 pt-2">
            <div className="flex items-baseline justify-between">
              <span className={`text-[11.5px] font-medium ${WORLDS[w].text}`}>{WORLDS[w].label}</span>
              <Num value={m[w].onTimeRate} decimals={1} suffix="%" className="font-mono text-[13px] font-semibold" />
            </div>
            <Spark values={hist(w)} color={WORLDS[w].hex} min={0} max={100} />
          </div>
        ))}
      </div>

      <table className="mt-3 w-full text-[12.5px]">
        <thead>
          <tr className="text-left">
            <th className="pb-1.5 font-normal"><span className="eyebrow">Metric</span></th>
            {COLS.map(w => (
              <th key={w} className="pb-1.5 text-right font-medium">
                <span className={`text-[11px] ${WORLDS[w].text}`}>{WORLDS[w].label}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map(r => {
            const vals = COLS.map(w => r.get(m[w]));
            const best = r.higherIsBetter ? Math.max(...vals) : Math.min(...vals);
            return (
              <tr key={r.label} className="border-t border-line/70" title={r.hint}>
                <td className="py-1.5 text-mute">{r.label}</td>
                {COLS.map((w, i) => (
                  <td key={w} className="py-1.5 text-right font-mono">
                    <Num
                      value={vals[i]}
                      decimals={r.decimals}
                      suffix={r.suffix}
                      className={Math.abs(vals[i] - best) < 1e-9 ? 'font-semibold text-ink' : 'text-mute'}
                    />
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 border-t border-line/70 pt-2.5 font-mono text-2xs text-mute">
        <span title="Wall-clock time per Swarm decision">
          decision <span className="text-ink">{m.swarm.decisionMsAvg.toFixed(1)}</span> ms avg · <span className="text-ink">{m.swarm.decisionMsMax.toFixed(0)}</span> max
        </span>
        <span title="Orders moved to a better rider before pickup">reassigned <span className="text-ink">{m.swarm.reassignments}</span></span>
        <span title="Drops re-ordered for riders already on the road">re-routed <span className="text-ink">{m.swarm.reroutes ?? 0}</span></span>
        <span title="Goods collected at the roadside after a rider dropped out">handovers <span className="text-ink">{m.swarm.handovers ?? 0}</span></span>
      </div>
    </section>
  );
};
