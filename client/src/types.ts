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
}

export interface OrderSnapshot {
  id: string;
  lat: number;
  lng: number;
  status: OrderStatus;
  priority: 'express' | 'regular';
  isLate: boolean;
  riderId?: string;
  storeId?: string;
  promisedBy: number;
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
}

export interface Metrics {
  onTimeRate: number;
  avgDeliverySec: number;
  p90DeliverySec: number;
  ordersPerTrip: number;
  kmPerOrder: number;
  utilization: number;
  fairnessStdDev: number;
  lateNow: number;
  delivered: number;
  pending: number;
  history: { t: number; onTimeRate: number; avgDeliverySec: number }[];
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
}

export interface DecisionRecord {
  decidedAt: number;
  chosen: CandidateScore;
  runnersUp: CandidateScore[];
  reason: string;
}

export type ScenarioName = 'normal' | 'monsoon' | 'spike' | 'riders_offline' | 'stockout' | 'cancel_burst' | 'clear_weather';
