export type LatLng = { lat: number; lng: number };

export type WorldName = 'naive' | 'baseline' | 'swarm';

export interface DarkStore {
  id: string;
  name: string;
  loc: LatLng;
  packingSlots: number;
  packQueue: string[]; // orderIds waiting to be packed or currently packing (FIFO)
  packTimeSec: number;
  offline?: boolean; // store_offline scenario: takes no new orders, unpicked orders are re-routed
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
  capacity: number;
  homeStoreId: string;
  originalHomeStoreId?: string; // set while the home store is offline and the rider is lent to another pool
  route: Stop[]; // remaining stops in order
  assignedOrderIds: string[];
  readyAtStoreSince?: number; // sim-time the rider was at the store with every order packed
  stats: {
    delivered: number;
    activeSec: number;
    km: number;
    deliveryTimes: number[]; // sim-times of recent deliveries (fatigue window)
  };
}

export type OrderStatus =
  | 'placed'
  | 'assigned'
  | 'packing'
  | 'packed'
  | 'picked'
  | 'delivered'
  | 'cancelled'
  | 'failed' // accepted but could not be delivered (stock-out at a naive store, rider lost mid-trip)
  | 'rejected'; // no stocked store within the geofence

export type OrderClass = 'express' | 'regular' | 'infeasible';

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
  eta: number; // projected drop time of this order (expected, unpadded)
  feasible: boolean; // every order on the trip meets its promise under the padded ETA
  maxLatenessSec: number; // worst padded lateness across the trip (0 if feasible)
  minSlackSec: number; // smallest padded slack across the trip
  riderSec?: number; // marginal rider-busy time of this assignment (ride legs + return to the store)
  tripStops?: Stop[];
}

export interface DecisionRecord {
  decidedAt: number;
  chosen: CandidateScore;
  runnersUp: CandidateScore[]; // top 2
  reason: string; // human readable explanation
  // contract fields (IMPLEMENTATION.md)
  chosenStore: string;
  chosenRider: string;
  storeOptions: { storeId: string; eta: number; queueDepth: number; feasible: boolean }[];
  riderOptions: { riderId: string; insertionTime: number; tripEta: number; feasible: boolean }[];
  batchSavingSec: number;
  rejectedInfeasible: number; // options removed by the hard deadline filter
  decisionMs: number; // wall-clock time of the allocator call that made this decision
}

export interface Order {
  id: string;
  loc: LatLng;
  items: { sku: string; qty: number }[];
  priority: 'express' | 'regular';
  class: OrderClass;
  createdAt: number;
  promisedBy: number;
  status: OrderStatus;
  storeId?: string;
  riderId?: string;
  deliveredAt?: number;
  isLate?: boolean;
  projectedEta?: number; // refreshed every tick
  packStartedAt?: number;
  assignedAt?: number; // when the current rider was assigned (sim time)
  packedAt?: number; // when packing finished
  pickedAt?: number; // when the rider left the store with the order
  tripSize?: number; // orders on the rider's trip when it left the store (1 = solo)
  decision?: DecisionRecord;
  holdUntil?: number; // for delayed commitment
  zoneId?: string; // = serving store (order density per zone)
  servingStoreId?: string; // the customer's nearest online dark store; the cart only offers what it has in stock
  failReason?: string;
}

export interface Assignment {
  orderId: string;
  storeId: string;
  riderId: string;
  decision: DecisionRecord;
  newRoute: Stop[];
}

export interface Metrics {
  onTimeRate: number; // % of finished orders (delivered + failed) delivered on time
  avgDeliverySec: number;
  p90DeliverySec: number;
  ordersPerTrip: number;
  kmPerOrder: number;
  utilization: number;
  fairnessStdDev: number;
  lateNow: number;
  delivered: number;
  pending: number;
  // added for CONTEXT §8
  p90LatenessSec: number;
  maxLatenessSec: number;
  ordersFailed: number;
  ordersRejected: number;
  kmTotal: number;
  reassignments: number;
  decisionMsAvg: number;
  decisionMsMax: number;
  ordersByClass: { express: number; regular: number; infeasible: number };
  ordersPerZone: Record<string, number>;
  packingQueueDepth: number;
  maxPackingQueueAcrossStores: number;
  history: { t: number; onTimeRate: number; avgDeliverySec: number; packingQueueDepth: number }[];
}

export interface RiderSnapshot {
  id: string;
  lat: number;
  lng: number;
  status: RiderStatus;
  load: number;
  routeLine: [number, number][];
  homeStoreId: string;
  deliveries: number; // deliveries completed this run
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
  riderHomeStoreId?: string; // the store the assigned rider belongs to (differs from the serving store for Naive)
  items?: { sku: string; qty: number }[]; // the real basket (reserved at checkout)
  failReason?: string;
}

export interface StoreSnapshot {
  id: string;
  name: string;
  lat: number;
  lng: number;
  queue: number;
  offline: boolean;
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
    naive: WorldSnapshot; // full snapshot too: the UI shows Naive in its 3-way views
  };
  forecast: { ordersPerHourLast5Min: number; surge: boolean }; // demand forecaster (Swarm surge mode)
}

export interface EventPayload {
  simTime: number;
  world: WorldName | 'both' | 'all';
  kind: string;
  message: string;
}

// Contract names: monsoon, store_offline, rider_offline, surge, cancel_burst, stockout, clear.
// Prototype names (spike, riders_offline, clear_weather) are kept as aliases for the current UI buttons.
export type ScenarioName =
  | 'normal' | 'monsoon' | 'store_offline' | 'rider_offline' | 'surge' | 'cancel_burst' | 'stockout' | 'clear'
  | 'spike' | 'riders_offline' | 'clear_weather';
