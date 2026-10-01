import { OrderStatus, RiderStatus, WorldName } from '../types';

/** One fixed identity per dispatcher, used on every screen. */
export const WORLDS: Record<WorldName, { label: string; short: string; rule: string; hex: string; text: string; bg: string; border: string }> = {
  swarm: {
    label: 'Swarm',
    short: 'S',
    rule: 'Picks the rider and drop order together, never breaks a promise, batches when it saves rider time.',
    hex: '#12a39b',
    text: 'text-swarm',
    bg: 'bg-swarm',
    border: 'border-swarm',
  },
  baseline: {
    label: 'Baseline',
    short: 'B',
    rule: "The store's nearest free rider, one order per trip, first come first served.",
    hex: '#e5604f',
    text: 'text-coral',
    bg: 'bg-coral',
    border: 'border-coral',
  },
  naive: {
    label: 'Naive',
    short: 'N',
    rule: 'The nearest free rider anywhere in the city, who first rides to the store.',
    hex: '#8a7fd6',
    text: 'text-naive',
    bg: 'bg-naive',
    border: 'border-naive',
  },
};

export const WORLD_ORDER: WorldName[] = ['swarm', 'baseline', 'naive'];

export const RIDER_STATUS: Record<RiderStatus, { label: string; hex: string }> = {
  idle: { label: 'Free at store', hex: '#606e80' },
  returning: { label: 'Riding back', hex: '#5ab8ff' },
  to_store: { label: 'Heading to pickup', hex: '#f6b73c' },
  at_store: { label: 'At pickup', hex: '#f6b73c' },
  delivering: { label: 'Out for delivery', hex: '#34e0a1' },
  offline: { label: 'Dropped out', hex: '#ff5b70' },
  off_shift: { label: 'Off shift', hex: '#3a4656' },
};

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  placed: 'Waiting for a rider',
  assigned: 'Rider assigned',
  packing: 'Being packed',
  packed: 'Packed',
  picked: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  failed: 'Failed',
  rejected: 'Rejected',
};

export const CLASS_META = {
  express: { label: 'Express', promise: '10 min', cls: 'text-brand border-brand/40 bg-brand/10' },
  regular: { label: 'Regular', promise: '20 min', cls: 'text-info border-info/40 bg-info/10' },
  infeasible: { label: 'Extended', promise: '30 min', cls: 'text-mute border-edge bg-raise' },
} as const;
