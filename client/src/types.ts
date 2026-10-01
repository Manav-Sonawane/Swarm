export type RiderStatus = 'idle' | 'to_store' | 'at_store' | 'delivering' | 'returning' | 'offline';
export type OrderStatus = 'placed' | 'assigned' | 'packing' | 'packed' | 'picked' | 'delivered' | 'cancelled';

export interface RiderSnapshot {
  id: string;
  lat: number;
  lng: number;
  status: RiderStatus;
  load: number;
  routeLine: [number, number][];
  homeStoreId: string;
  deliveries: number; // count this shift
}

export interface OrderSnapshot {
  id: string;
  lat: number;
  lng: number;
  status: OrderStatus;
  priority: 'express' | 'regular';
  class: 'express' | 'regular' | 'infeasible';
  isLate: boolean;
  riderId?: string;
  storeId?: string;
  promisedBy: number;
  projectedEta?: number;
  createdAt: number;
  deliveredAt?: number;
  zoneId?: string;
}

export interface StoreSnapshot {
  id: string;
  name: string;
  lat: number;
  lng: number;
  queue: number;
  packingQueue?: { orderId: string; status: 'waiting' | 'packing' | 'ready' }[];
  inventory?: Record<string, number>;
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
  // extended contract fields
  p90LatenessSec: number;
  maxLatenessSec: number;
  ordersFailed: number;
  ordersRejected: number;
  reassignments: number;
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
}

export interface EventPayload {
  simTime: number;
  world: 'naive' | 'baseline' | 'swarm' | 'both' | 'all';
  kind: string;
  message: string;
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

export type ScenarioName = 'normal' | 'monsoon' | 'spike' | 'riders_offline' | 'stockout' | 'cancel_burst' | 'clear_weather';
