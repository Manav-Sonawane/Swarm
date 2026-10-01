import { CONFIG } from './config';
import { SetupConfig } from './types';

/** Current run settings, as shown on the Setup screen. */
export function getSetup(): SetupConfig {
  return {
    ridersPerStore: CONFIG.RIDERS_PER_STORE,
    ordersPerHour: CONFIG.ORDERS_PER_HOUR,
    packingSlots: CONFIG.PACKING_SLOTS,
    capacity: CONFIG.CAPACITY,
    baseSpeedKmh: CONFIG.BASE_SPEED_KMH,
    shiftPattern: CONFIG.SHIFT_PATTERN,
    baselinePromises10: CONFIG.BASELINE_PROMISES_10_MIN,
  };
}

const clamp = (v: unknown, lo: number, hi: number, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : fallback;
};

/** Applies Setup-screen values (clamped to sane ranges). Takes effect on the next reset. */
export function applySetup(s: Partial<SetupConfig> | undefined): void {
  if (!s) return;
  CONFIG.RIDERS_PER_STORE = clamp(s.ridersPerStore, 2, 12, CONFIG.RIDERS_PER_STORE);
  CONFIG.ORDERS_PER_HOUR = clamp(s.ordersPerHour, 60, 600, CONFIG.ORDERS_PER_HOUR);
  CONFIG.PACKING_SLOTS = clamp(s.packingSlots, 1, 4, CONFIG.PACKING_SLOTS);
  CONFIG.CAPACITY = clamp(s.capacity, 1, 4, CONFIG.CAPACITY);
  CONFIG.BASE_SPEED_KMH = clamp(s.baseSpeedKmh, 8, 20, CONFIG.BASE_SPEED_KMH);
  if (s.shiftPattern === 'all_evening' || s.shiftPattern === 'staggered') CONFIG.SHIFT_PATTERN = s.shiftPattern;
  if (typeof s.baselinePromises10 === 'boolean') CONFIG.BASELINE_PROMISES_10_MIN = s.baselinePromises10;
}
