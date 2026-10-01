import { useEffect, useRef, useState } from 'react';

const reduceMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Smoothly animates a number toward `target` (ease-out), so live KPIs glide instead of jumping each tick. */
export function useTween(target: number, ms = 650): number {
  const [value, setValue] = useState(target);
  const from = useRef(target);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (reduceMotion || !Number.isFinite(target)) {
      setValue(target);
      return;
    }
    const start = performance.now();
    const v0 = from.current;
    if (Math.abs(target - v0) < 1e-9) return;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const e = 1 - Math.pow(1 - t, 3);
      const v = v0 + (target - v0) * e;
      from.current = v;
      setValue(v);
      if (t < 1) raf.current = requestAnimationFrame(step);
    };
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(step);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [target, ms]);

  return value;
}
