// Wire types: must stay assignable from server/src/types.ts (what the server sends).
export type WorldName = 'naive' | 'baseline' | 'swarm';
export type RiderStatus = 'idle' | 'to_store' | 'at_store' | 'delivering' | 'returning' | 'offline' | 'off_shift';
export type OrderStatus = 'placed' | 'assigned' | 'packing' | 'packed' | 'picked' | 'delivered' | 'cancelled' | 'failed' | 'rejected';
export type OrderClass = 'express' | 'regular' | 'infeasible';

export interface RiderSnapshot {
  id: string;
  lat: number;
  lng: number;
  status: RiderStatus;
  load: number;
  routeLine: [number, number][];
  homeStoreId: string;
  deliveries: number;
  shiftStartsAt?: number;
  shiftEndsAt?: number;
}

export interface OrderSnapshot {
  id: string;
  lat: number;
  lng: number;
  status: OrderStatus;
  priority: 'express' | 'regular';
  class: OrderClass;
  isLate: boolean;
  riderId?: string;
  storeId?: string;
  promisedBy: number;
  projectedEta?: number;
  createdAt: number;
  deliveredAt?: number;
  zoneId?: string;
  servingStoreId?: string;
  assignedAt?: number;
  packedAt?: number;
  pickedAt?: number;
  tripSize?: number;
  riderHomeStoreId?: string;
  failReason?: string;
  items?: { sku: string; qty: number }[];
  handover?: boolean;
  manual?: boolean;
}

export interface StoreSnapshot {
  id: string;
  name: string;
  lat: number;
  lng: number;
  queue: number;
  offline?: boolean;
}

export interface Metrics {
  onTimeRate: number;
  avgDeliverySec: number;
  p90DeliverySec: number;
  ordersPerTrip: number;
  kmPerOrder: number;
  kmTotal: number;
  utilization: number;
  fairnessStdDev: number;
  lateNow: number;
  delivered: number;
  pending: number;
  p90LatenessSec: number;
  maxLatenessSec: number;
  ordersFailed: number;
  ordersRejected: number;
  reassignments: number;
  handovers?: number;
  reroutes?: number;
  decisionMsAvg: number;
  decisionMsMax: number;
  ordersByClass: { express: number; regular: number; infeasible: number };
  ordersPerZone: Record<string, number>;
  packingQueueDepth: number;
  maxPackingQueueAcrossStores: number;
  history: { t: number; onTimeRate: number; avgDeliverySec: number; packingQueueDepth: number }[];
}

export interface WorldSnapshot {
  riders: RiderSnapshot[];
  orders: OrderSnapshot[];
  stores: StoreSnapshot[];
  metrics: Metrics;
}

export interface SetupConfig {
  ridersPerStore: number;
  ordersPerHour: number;
  packingSlots: number;
  capacity: number;
  baseSpeedKmh: number;
  shiftPattern: 'all_evening' | 'staggered';
  baselinePromises10: boolean;
}

export interface TrafficJam {
  storeId: string;
  name: string;
  lat: number;
  lng: number;
  radiusKm: number;
  mult: number;
}

export interface TickPayload {
  simTime: number;
  speed: number;
  running: boolean;
  seed: number;
  activeScenario: string;
  weatherMult: number;
  worlds: {
    baseline: WorldSnapshot;
    swarm: WorldSnapshot;
    naive?: WorldSnapshot;
  };
  forecast?: { ordersPerHourLast5Min: number; surge: boolean };
  setup?: SetupConfig;
  stock?: Record<string, Record<string, number>>;
  trafficJam?: TrafficJam | null;
}

export interface EventPayload {
  simTime: number;
  world: 'naive' | 'baseline' | 'swarm' | 'both' | 'all';
  kind: string;
  message: string;
}

export interface Stop {
  type: 'pickup' | 'drop';
  orderId?: string;
  storeId?: string;
  loc: { lat: number; lng: number };
  eta: number;
}

export interface CandidateScore {
  riderId: string;
  storeId: string;
  totalCost: number;
  breakdown: {
    travelSec: number;
    insertionSec: number;
    latenessPenalty: number;
    loadPenalty: number;
    packWaitSec: number;
    batchSavingSec: number;
  };
  eta: number;
  feasible: boolean;
  maxLatenessSec?: number;
  minSlackSec?: number;
  riderSec?: number;
  tripStops?: Stop[];
}

export interface DecisionRecord {
  decidedAt: number;
  chosen: CandidateScore;
  runnersUp: CandidateScore[];
  reason: string;
  chosenStore?: string;
  chosenRider?: string;
  storeOptions?: { storeId: string; eta: number; queueDepth: number; feasible: boolean }[];
  riderOptions?: { riderId: string; insertionTime: number; tripEta: number; feasible: boolean }[];
  batchSavingSec?: number;
  rejectedInfeasible?: number;
  decisionMs?: number;
}

export type ScenarioName =
  | 'normal' | 'monsoon' | 'store_offline' | 'rider_offline' | 'surge' | 'cancel_burst' | 'stockout' | 'clear'
  | 'spike' | 'riders_offline' | 'clear_weather' | 'traffic_jam';

export type QuoteResult =
  | { ok: true; storeId: string; storeName: string; distanceKm: number; class: OrderClass; promiseMin: number; stock: Record<string, number> }
  | { ok: false; reason: string };

export type PlaceResult =
  | { ok: true; orderId: string; storeId: string; storeName: string; class: OrderClass; promiseMin: number; promisedBy: number }
  | { ok: false; reason: string };
