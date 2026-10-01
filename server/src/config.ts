export const CONFIG = {
  EPOCH: 10, // allocation decision epoch in sim-seconds
  CAPACITY: 3, // max orders per trip per rider
  HOLD_SLACK: 240, // 4 minutes - slack threshold above which solo trips can be held
  MAX_HOLD: 60, // 60 seconds max hold time for delayed commitment
  DEPART_SLACK: 120, // 2 minutes - min slack to force rider departure from store
  W_LATE: 5.0, // cost penalty weight for projected lateness (sec)
  W_LOAD: 10.0, // cost penalty weight per existing assigned order on rider
  DEFAULT_SIM_SPEED: 10, // 1 real second = 10 sim seconds
  EXPRESS_PROMISED_SEC: 600, // 10 minutes for express orders
  REGULAR_PROMISED_SEC: 1200, // 20 minutes for regular orders
  AVG_PACK_TIME_SEC: 90, // average pack time per order in seconds
  DEFAULT_SEED: 42,
  // 12 km/h + 1.3 road factor => express (10 min incl. 2 min packing) reaches ~1.2 km straight-line
  ROAD_WINDING_FACTOR: 1.3,
  BASE_SPEED_KMH: 12,
  TRAFFIC_MULTIPLIER_PEAK: 1.3, // travel-time multiplier, peak 8–11 and 18–21
  TRAFFIC_MULTIPLIER_MONSOON: 1.5, // travel-time multiplier, stacks with peak
  RIDERS_PER_STORE: 6,
};
