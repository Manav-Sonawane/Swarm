import React from 'react';
import { useTween } from '../lib/useTween';
import { WORLDS } from '../lib/theme';
import { WorldName } from '../types';

/** A number that glides to its new value each tick. */
export const Num: React.FC<{ value: number; decimals?: number; suffix?: string; className?: string }> = ({ value, decimals = 0, suffix = '', className = '' }) => {
  const v = useTween(value);
  return (
    <span className={`num ${className}`}>
      {v.toFixed(decimals)}
      {suffix}
    </span>
  );
};

/** Colored dot + name for a dispatcher. */
export const WorldTag: React.FC<{ world: WorldName; className?: string; dotOnly?: boolean }> = ({ world, className = '', dotOnly }) => (
  <span className={`inline-flex items-center gap-1.5 ${className}`}>
    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: WORLDS[world].hex }} />
    {!dotOnly && <span className={WORLDS[world].text}>{WORLDS[world].label}</span>}
  </span>
);

/** Difference chip: green when the change is good, red when bad. */
export const Delta: React.FC<{ diff: number; higherIsBetter: boolean; unit?: string; decimals?: number }> = ({ diff, higherIsBetter, unit = '', decimals = 1 }) => {
  if (!Number.isFinite(diff) || Math.abs(diff) < Math.pow(10, -decimals) / 2) {
    return <span className="chip border-line text-dim">even</span>;
  }
  const good = higherIsBetter ? diff > 0 : diff < 0;
  return (
    <span className={`chip num ${good ? 'border-good/30 bg-good/10 text-good' : 'border-bad/30 bg-bad/10 text-bad'}`}>
      {diff > 0 ? '+' : '−'}
      {Math.abs(diff).toFixed(decimals)}
      {unit}
    </span>
  );
};

export const SectionTitle: React.FC<{ eyebrow?: string; title: string; right?: React.ReactNode; className?: string }> = ({ eyebrow, title, right, className = '' }) => (
  <div className={`flex items-end justify-between gap-3 ${className}`}>
    <div className="min-w-0">
      {eyebrow && <div className="eyebrow mb-1">{eyebrow}</div>}
      <h2 className="font-display text-[17px] font-bold tracking-[-0.01em] text-ink">{title}</h2>
    </div>
    {right}
  </div>
);

export const Empty: React.FC<{ title: string; hint?: string; icon?: React.ReactNode }> = ({ title, hint, icon }) => (
  <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
    {icon && <div className="text-dim">{icon}</div>}
    <div className="text-[13px] font-medium text-mute">{title}</div>
    {hint && <div className="max-w-xs text-xs text-dim">{hint}</div>}
  </div>
);

/** Tiny line chart for a KPI's recent history. */
export const Spark: React.FC<{ values: number[]; color: string; height?: number; min?: number; max?: number }> = ({ values, color, height = 28, min, max }) => {
  if (values.length < 2) return <div style={{ height }} />;
  const w = 100;
  const lo = min ?? Math.min(...values);
  const hi = max ?? Math.max(...values);
  const span = hi - lo || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${height - 2 - ((v - lo) / span) * (height - 4)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className="block w-full" style={{ height }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
};
