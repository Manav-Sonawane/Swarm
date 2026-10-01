import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from 'lucide-react';
import { TickPayload } from '../types';
import { WORLDS, WORLD_ORDER } from '../lib/theme';

type Section = { title: string; time: string; say: string[]; show?: string; live?: (t: TickPayload) => React.ReactNode };

const pct = (v: number) => `${v.toFixed(1)}%`;

const SECTIONS: Section[] = [
  {
    title: 'The problem',
    time: '0:00',
    say: [
      'Quick commerce promises 10 minutes. The hard part is not the map; it is that riders are scarce and every order competes for them.',
      'The nearest rider is often the wrong one: they may be on a trip that a new order would make late.',
    ],
    show: 'Live screen, paused, both maps visible.',
  },
  {
    title: 'One fair experiment',
    time: '0:40',
    say: [
      'We run three dispatchers side by side on the same Mumbai: 15 dark stores, the same riders, and the exact same stream of orders from one seed.',
      'Any difference you see comes from the dispatcher, nothing else.',
    ],
    show: 'Switch the map layout to “All three”. Press Play.',
    live: t => <>Seed <b>{t.seed}</b> · {t.setup?.ridersPerStore ?? 6} riders per store · {t.setup?.ordersPerHour ?? 255} orders per hour</>,
  },
  {
    title: 'The three rules',
    time: '1:10',
    say: WORLD_ORDER.slice().reverse().map(w => `${WORLDS[w].label}: ${WORLDS[w].rule}`),
  },
  {
    title: 'An honest promise',
    time: '1:50',
    say: [
      'Before checkout, every order is classified from the nearest store’s distance and queue: Express 10 min, Regular 20 min, or Extended 30 min.',
      'We never promise 10 minutes when the road says 18.',
    ],
    show: 'Click “Place an order”, pick a spot near a store, then one far away. Show the different promises and the live stock.',
  },
  {
    title: 'How Swarm decides',
    time: '2:30',
    say: [
      'For each new order, Swarm tries it in every rider’s bag at every position, and throws out any option that would make anyone late.',
      'Of what is left, it picks the lowest cost: the new order’s wait, the delay it adds to others, and the rider minutes it burns.',
      'It decides in milliseconds, so it re-plans every minute and moves orders to a better rider before pickup.',
    ],
    show: 'Click a Swarm order and open “Why this rider?”.',
    live: t => <>Average decision <b>{t.worlds.swarm.metrics.decisionMsAvg.toFixed(1)} ms</b> · {t.worlds.swarm.metrics.reassignments} reassignments so far</>,
  },
  {
    title: 'Same order, three outcomes',
    time: '3:20',
    say: ['Pick one order and follow it through all three worlds: who took it, when it was packed, picked and delivered, and how late.'],
    show: 'Orders screen, filter “Swarm saved”, pick the top order.',
  },
  {
    title: 'Break it',
    time: '3:50',
    say: [
      'Now we hit all three worlds with the same disruption: monsoon, a gridlock around one store, riders dropping out mid-delivery.',
      'Swarm re-routes riders already on the road, and when a rider drops out with goods in the bag, another rider collects them at the roadside instead of failing the order.',
    ],
    show: 'Trigger Gridlock, then Riders drop out. Point at the event feed.',
    live: t => <>{t.worlds.swarm.metrics.reroutes ?? 0} in-flight re-routes · {t.worlds.swarm.metrics.handovers ?? 0} roadside handovers</>,
  },
  {
    title: 'The customer’s view',
    time: '4:30',
    say: ['This is what the customer sees for the same order under each dispatcher: one honest ETA that holds.'],
    show: 'Track screen with the order you placed. Toggle between dispatchers.',
  },
  {
    title: 'Results',
    time: '5:00',
    say: [
      'On-time rate counts every decided order, including failed ones. P90 lateness is how late the worst 1 in 10 orders gets.',
      'Swarm wins on reliability while carrying more orders per trip.',
    ],
    show: 'Results screen.',
    live: t => (
      <div className="grid grid-cols-3 gap-2">
        {WORLD_ORDER.map(w => {
          const m = (w === 'naive' ? t.worlds.naive ?? t.worlds.baseline : t.worlds[w]).metrics;
          return (
            <div key={w} className="rounded-xl border border-line bg-bg/60 p-3">
              <div className="inline-flex items-center gap-1.5 text-[12px] text-mute"><span className="h-2 w-2 rounded-full" style={{ background: WORLDS[w].hex }} />{WORLDS[w].label}</div>
              <div className="num mt-1 font-display text-[24px] font-extrabold">{pct(m.onTimeRate)}</div>
              <div className="num font-mono text-2xs text-dim">P90 late {(m.p90LatenessSec / 60).toFixed(1)} min · {m.ordersPerTrip.toFixed(2)}/trip</div>
            </div>
          );
        })}
      </div>
    ),
  },
  {
    title: 'Close',
    time: '5:40',
    say: ['Same riders, same orders, same city. A better decision gives more on-time deliveries and fewer broken promises. That is Swarm.'],
  },
];

export const PitchView: React.FC<{ tick: TickPayload | null }> = ({ tick }) => {
  const [i, setI] = useState(0);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setElapsed(e => e + 1), 1000);
    return () => window.clearInterval(id);
  }, [running]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') setI(v => Math.min(SECTIONS.length - 1, v + 1));
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') setI(v => Math.max(0, v - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const s = SECTIONS[i];
  const mm = String(Math.floor(elapsed / 60));
  const ss = String(elapsed % 60).padStart(2, '0');

  return (
    <div className="screen grid h-full min-h-0 grid-cols-1 gap-3 overflow-y-auto p-3 lg:grid-cols-[280px_minmax(0,1fr)] lg:overflow-hidden lg:p-5">
      <nav className="panel flex min-h-0 flex-col p-2" aria-label="Pitch sections">
        <div className="flex items-center justify-between px-2 py-2">
          <div>
            <div className="eyebrow">Presenter timer</div>
            <div className="num font-mono text-[22px] font-semibold">{mm}:{ss}</div>
          </div>
          <div className="flex gap-1">
            <button className="btn h-8 px-2" onClick={() => setRunning(r => !r)} aria-label={running ? 'Pause timer' : 'Start timer'}>{running ? <Pause size={14} /> : <Play size={14} />}</button>
            <button className="btn h-8 px-2" onClick={() => { setElapsed(0); setRunning(false); }} aria-label="Reset timer"><RotateCcw size={14} /></button>
          </div>
        </div>
        <ol className="min-h-0 flex-1 overflow-y-auto">
          {SECTIONS.map((x, n) => (
            <li key={x.title}>
              <button onClick={() => setI(n)} className={`flex w-full items-baseline gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13px] transition-colors ${n === i ? 'bg-lift text-ink' : 'text-mute hover:bg-raise'}`}>
                <span className="num w-9 shrink-0 font-mono text-2xs text-dim">{x.time}</span>
                {x.title}
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <article key={i} className="panel flex min-h-0 animate-rise flex-col p-6 lg:p-10">
        <div className="eyebrow">{String(i + 1).padStart(2, '0')} / {SECTIONS.length} · around {s.time}</div>
        <h1 className="mt-2 font-display text-[clamp(28px,3.4vw,46px)] font-extrabold leading-[1.05] tracking-[-0.03em]">{s.title}</h1>
        <div className="mt-6 max-w-[70ch] space-y-4 text-[clamp(16px,1.35vw,20px)] leading-relaxed text-ink/90">
          {s.say.map(p => <p key={p}>{p}</p>)}
        </div>
        {s.live && tick && <div className="mt-6 max-w-[70ch] rounded-xl border border-brand/30 bg-brand/5 px-4 py-3 text-[14px] text-mute">{s.live(tick)}</div>}
        {s.show && (
          <div className="mt-6 max-w-[70ch] border-l-2 border-brand pl-4 text-[14px] text-mute">
            <span className="eyebrow mr-2 text-brand">Show</span>{s.show}
          </div>
        )}
        <div className="mt-auto flex items-center justify-between pt-8">
          <button className="btn" onClick={() => setI(v => Math.max(0, v - 1))} disabled={i === 0}><ChevronLeft size={15} /> Back</button>
          <span className="text-2xs text-dim">← → keys move between sections</span>
          <button className="btn btn-brand" onClick={() => setI(v => Math.min(SECTIONS.length - 1, v + 1))} disabled={i === SECTIONS.length - 1}>Next <ChevronRight size={15} /></button>
        </div>
      </article>
    </div>
  );
};
