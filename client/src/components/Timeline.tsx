import React from 'react';
import { OrderSnapshot } from '../types';
import { lifecycle } from '../lib/lifecycle';
import { formatClock, formatDuration } from '../lib/format';

/** Vertical journey of one order with real event times; the current step pulses. */
export const Timeline: React.FC<{ order: OrderSnapshot; accent: string; compact?: boolean }> = ({ order, accent, compact }) => {
  const steps = lifecycle(order);
  return (
    <ol className="relative space-y-0">
      {steps.map((s, i) => {
        const last = i === steps.length - 1;
        const color = s.state === 'todo' ? 'rgb(var(--edge))' : accent;
        const delta = s.at !== undefined && i > 0 && steps[i - 1].at !== undefined ? s.at - steps[i - 1].at! : undefined;
        return (
          <li key={s.key} className={`relative flex gap-3 ${compact ? 'pb-2' : 'pb-3'}`}>
            {!last && <span className="absolute left-[5px] top-3 h-full w-[2px]" style={{ background: steps[i + 1].state === 'todo' ? 'rgb(var(--line))' : accent, opacity: 0.6 }} />}
            <span
              className={`relative z-10 mt-[3px] h-3 w-3 shrink-0 rounded-full ${s.state === 'now' ? 'animate-pulse2' : ''}`}
              style={{ background: s.state === 'todo' ? 'rgb(var(--bg))' : color, boxShadow: `0 0 0 2px ${color}` }}
            />
            <div className="flex min-w-0 flex-1 items-baseline justify-between gap-2">
              <span className={`text-[12.5px] ${s.state === 'todo' ? 'text-dim' : 'text-ink'}`}>{s.label}</span>
              <span className="num shrink-0 font-mono text-2xs text-mute">
                {s.at !== undefined ? formatClock(s.at) : '—'}
                {delta !== undefined && delta > 0 && !compact && <span className="ml-1.5 text-dim">+{formatDuration(delta)}</span>}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
};
