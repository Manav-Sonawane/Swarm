export type LatLng = { lat: number; lng: number };

export interface DarkStore {
  id: string;
  name: string;
  loc: LatLng;
  inventory: Record<string, number>; // sku -> qty
  packingSlots: number;
  packQueue: string[]; // orderIds waiting to be packed or currently packing
  packTimeSec: number;
}

export type RiderStatus = 'idle' | 'to_store' | 'at_store' | 'delivering' | 'returning' | 'offline';

export interface Stop {
  type: 'pickup' | 'drop';
  orderId?: string;
  storeId?: string;
  loc: LatLng;
  eta: number; // projected sim-time of arrival
}

export interface Rider {
  id: string;
  loc: LatLng;
  status: RiderStatus;
  capacity: number; // default 3
  homeStoreId: string;
  route: Stop[]; // remaining stops in order
  assignedOrderIds: string[];
  stats: {
    delivered: number;
    activeSec: number;
    km: number;
  };
}

export type OrderStatus = 'placed' | 'assigned' | 'packing' | 'packed' | 'picked' | 'delivered' | 'cancelled';

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
  tripStops?: Stop[];
}

export interface DecisionRecord {
  decidedAt: number;
  chosen: CandidateScore;
  runnersUp: CandidateScore[]; // top 2
  reason: string; // human readable explanation
}

export interface Order {
  id: string;
  loc: LatLng;
  items: { sku: string; qty: number }[];
  priority: 'express' | 'regular';
  createdAt: number;
  promisedBy: number;
  status: OrderStatus;
  storeId?: string;
  riderId?: string;
  deliveredAt?: number;
  isLate?: boolean;
  decision?: DecisionRecord;
  holdUntil?: number; // for delayed commitment
  packStartedAt?: number;
  orderClass?: 'express' | 'regular' | 'infeasible';
  zoneId?: string;
}

export interface Assignment {
  orderId: string;
  storeId: string;
  riderId: string;
  decision: DecisionRecord;
  newRoute: Stop[];
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
  world: 'baseline' | 'swarm' | 'both';
  kind: string;
  message: string;
}

export type ScenarioName = 'normal' | 'monsoon' | 'spike' | 'riders_offline' | 'stockout' | 'cancel_burst' | 'clear_weather';
