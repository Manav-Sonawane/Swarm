export const CONFIG = {
  EPOCH: 10, // Swarm allocation epoch in sim-seconds (also runs on every new order)
  CAPACITY: 3, // max orders per trip per rider
  HOLD_SLACK: 240, // slack (sec) above which a solo trip may be held one epoch for a batch partner
  MAX_HOLD: 0, // max wait (sec) for a batch partner, order-side and at the store. Checkpoint 3 tuning: holding cost more than it saved
  DEPART_SLACK: 120, // leave the store when min slack vs projected drop ETA falls below this
  W_LOAD: 10.0, // cost penalty (sec) per order already on the rider
  // Throughput-aware cost: cost per second of *rider time* an assignment consumes (ride legs + return to the
  // store). Prefers batching and nearby riders when riders, not packing, are the bottleneck. Higher values buy
  // on-time % at the price of worst-case lateness (tuned on seeds 1-16: 0.5 best tail, 0.75 best balance).
  W_RIDE: 0.75,
  W_FAIR: 600, // cost (sec) per delivery a rider is above the fleet average: spreads work (fairness std-dev)
  SAVABLE_FIRST: true, // assign orders that can still be on time before ones that cannot (triage)
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
  ETA_RISK_PAD: 1.05, // travel-time pad Swarm uses when checking that a trip keeps its promises. The simulator has no random travel noise, so a bigger pad only shrinks the feasible set (1.15 scored 2 pts lower)
  CLASSIFY_PAD: 1.15, // pad used only to classify new orders (express / regular / infeasible); same for every world
  DECISION_BUDGET_MS: 200, // target wall-clock time per allocator call

  // Rebalance with a freeze window (CONTEXT §5 step 8)
  REBALANCE_SEC: 60, // how often assigned-but-not-picked orders are reconsidered
  FREEZE_DIST_KM: 0.3, // riders this close to (or at) the store keep their orders
  REASSIGN_MIN_GAIN_SEC: 60, // a move must save at least this much, or rescue an at-risk order
  REBALANCE_MAX_ORDERS: 40, // most-urgent orders reconsidered per rebalance (decision-time budget)

  // Phase 4 stretch features (Swarm world only)
  SMART_PACKING: true, // pack by trip urgency (slack) and keep a batch together, instead of FIFO
  FATIGUE_DELIVERIES: 7, // deliveries within the window that make a rider "fatigued"
  FATIGUE_WINDOW_SEC: 7200, // 2 hours
  W_FATIGUE: 0.5, // extra cost per second of riding for a fatigued rider (prefers shorter trips)
  SURGE_FORECAST: true, // moving-average demand forecast: surge detection + alert event
  // Surge mode policy (hold + bigger batches while a surge is forecast). Measured over 8 seeds it moved
  // on-time by <0.5 pt and made tail lateness slightly worse (riders, not batch size, are the bottleneck),
  // so it is off by default.
  SURGE_MODE: false,
  SURGE_WINDOW_SEC: 300, // forecast window: order rate over the last 5 sim-minutes
  SURGE_RATIO: 2, // surge when that rate is >= this x ORDERS_PER_HOUR
  SURGE_HOLD_SEC: 60, // surge mode: orders/riders may wait this long for a batch partner
  SURGE_CAPACITY: 4, // surge mode: orders per trip

  // 12 km/h + 1.3 road factor => express (10 min incl. 2 min packing) reaches ~1.2 km straight-line
  ROAD_WINDING_FACTOR: 1.3,
  BASE_SPEED_KMH: 12,
  TRAFFIC_MULTIPLIER_PEAK: 1.3, // travel-time multiplier, peak 8–11 and 18–21
  TRAFFIC_MULTIPLIER_MONSOON: 1.5, // travel-time multiplier, stacks with peak
  RIDERS_PER_STORE: 6,
  ORDERS_PER_HOUR: 300, // base Poisson demand across all stores (spike = 3x); Baseline ~80% on time at this load
  // Riders belong to a store pool (CONTEXT §1). 0 = home store only; >0 = may also pick up at stores
  // within this distance of their home store.
  RIDER_BORROW_KM: 0,
  // Swarm only: cross-store rider pooling. A rider may pick up at any online store within this distance of
  // its home store, and rests at the nearest such store between trips instead of always returning home.
  // The comparison worlds keep RIDER_BORROW_KM (home store only).
  SWARM_BORROW_KM: 3.5, // pooling radius (km). Gives +0.8 pt on-time. Ablation: letting Baseline pool too makes IT worse (57.8 -> 52.2)
  SWARM_REPOSITION: true, // with pooling, idle riders rest at the nearest store they may serve (false = always go home)
};
