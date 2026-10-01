export const CONFIG = {
  EPOCH: 10, // Swarm allocation epoch in sim-seconds (also runs on every new order)
  CAPACITY: 3, // max orders per trip per rider
  HOLD_SLACK: 240, // slack (sec) above which a solo trip may be held one epoch for a batch partner
  MAX_HOLD: 60, // max order age (sec) for delayed commitment
  DEPART_SLACK: 120, // leave the store when min slack vs projected drop ETA falls below this
  W_LOAD: 10.0, // cost penalty (sec) per order already on the rider
  DEFAULT_SIM_SPEED: 10, // 1 real second = 10 sim seconds
  DEFAULT_SEED: 42,

  // Promise windows (CONTEXT §4)
  EXPRESS_PROMISED_SEC: 600, // ≤10 min
  REGULAR_PROMISED_SEC: 1200, // ≤20 min
  EXTENDED_PROMISED_SEC: 1800, // "infeasible" class: offered an extended 30 min window
  // false: every world gets the same honest promise (fair algorithm comparison).
  // true: Naive + Baseline promise 10 min to everyone (the over-promising contrast, CONTEXT §9).
  BASELINE_PROMISES_10_MIN: false,

  AVG_PACK_TIME_SEC: 120, // pack time per order
  PACKING_SLOTS: 2, // orders packed in parallel per store

  // Store / rider candidate pruning (CONTEXT §5)
  GEOFENCE_KM: 3, // straight-line radius a store can serve
  CANDIDATE_STORES: 3, // best stores (packing delay + travel) considered per order
  RIDER_CANDIDATES_PER_STORE: 10, // nearest riders considered per candidate store
  ETA_RISK_PAD: 1.15, // travel-time pad used for feasibility (~85th percentile)
  DECISION_BUDGET_MS: 200, // target wall-clock time per allocator call

  // 12 km/h + 1.3 road factor => express (10 min incl. 2 min packing) reaches ~1.2 km straight-line
  ROAD_WINDING_FACTOR: 1.3,
  BASE_SPEED_KMH: 12,
  TRAFFIC_MULTIPLIER_PEAK: 1.3, // travel-time multiplier, peak 8–11 and 18–21
  TRAFFIC_MULTIPLIER_MONSOON: 1.5, // travel-time multiplier, stacks with peak
  RIDERS_PER_STORE: 6,
};
