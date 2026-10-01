import { Order, Rider, Metrics, DarkStore } from './types';

const percentile = (sorted: number[], p: number) =>
  sorted.length === 0 ? 0 : sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];

export class MetricsEngine {
  private history: Metrics['history'] = [];
  private totalCompletedTrips: number = 0;
  private decisionMsSum = 0;
  private decisionCalls = 0;
  private decisionMsMax = 0;
  public reassignments = 0;
  public handovers = 0;
  public reroutes = 0;

  public incrementCompletedTrips(count: number = 1): void {
    this.totalCompletedTrips += count;
  }

  /** Wall-clock time of one allocator call that had pending orders to consider. */
  public recordDecision(ms: number): void {
    this.decisionMsSum += ms;
    this.decisionCalls += 1;
    this.decisionMsMax = Math.max(this.decisionMsMax, ms);
  }

  public reset(): void {
    this.history = [];
    this.totalCompletedTrips = 0;
    this.decisionMsSum = 0;
    this.decisionCalls = 0;
    this.decisionMsMax = 0;
    this.reassignments = 0;
    this.handovers = 0;
    this.reroutes = 0;
  }

  public calculateMetrics(
    allOrders: Order[],
    riders: Rider[],
    stores: DarkStore[],
    nowSimTime: number,
    startSimTime: number
  ): Metrics {
    const deliveredOrders = allOrders.filter(o => o.status === 'delivered' && o.deliveredAt !== undefined);
    const deliveredCount = deliveredOrders.length;
    const failedCount = allOrders.filter(o => o.status === 'failed').length;
    const rejectedCount = allOrders.filter(o => o.status === 'rejected').length;

    // 1. On-time rate over every order whose outcome is decided: delivered, failed, or already past its
    //    promise while undelivered. Counting only deliveries would reward an allocator for leaving
    //    late orders undelivered at the end of the run, and dropping orders would look good.
    const onTimeCount = deliveredOrders.filter(o => o.deliveredAt! <= o.promisedBy).length;
    const overdueActive = allOrders.filter(
      o => !['delivered', 'cancelled', 'failed', 'rejected'].includes(o.status) && nowSimTime > o.promisedBy
    ).length;
    const decided = deliveredCount + failedCount + overdueActive;
    const onTimeRate = decided > 0 ? (onTimeCount / decided) * 100 : 100;

    // 2. Delivery time & lateness
    const timesSec = deliveredOrders.map(o => o.deliveredAt! - o.createdAt).sort((a, b) => a - b);
    const avgDeliverySec = deliveredCount > 0 ? timesSec.reduce((a, b) => a + b, 0) / deliveredCount : 0;
    // Lateness over decided orders: delivered ones, plus undelivered ones already past their promise
    // (counted at their lateness so far, a lower bound). Delivered-only would hide the worst orders.
    const lateness = [
      ...deliveredOrders.map(o => Math.max(0, o.deliveredAt! - o.promisedBy)),
      ...allOrders
        .filter(o => !['delivered', 'cancelled', 'failed', 'rejected'].includes(o.status) && nowSimTime > o.promisedBy)
        .map(o => nowSimTime - o.promisedBy),
    ].sort((a, b) => a - b);

    // 3. Orders per trip: deliveries over completed trips (in-progress trips have delivered nothing yet)
    const ordersPerTrip = this.totalCompletedTrips > 0 ? Number((deliveredCount / this.totalCompletedTrips).toFixed(2)) : 1.0;

    // 4. Distance
    const kmTotal = riders.reduce((sum, r) => sum + r.stats.km, 0);
    const kmPerOrder = deliveredCount > 0 ? Number((kmTotal / deliveredCount).toFixed(2)) : 0;

    // 5. Rider utilization %
    const totalSimDuration = Math.max(1, nowSimTime - startSimTime);
    const avgActiveSec = riders.reduce((sum, r) => sum + r.stats.activeSec, 0) / Math.max(1, riders.length);
    const utilization = Math.min(100, (avgActiveSec / totalSimDuration) * 100);

    // 6. Fairness std-dev (deliveries per rider)
    const counts = riders.map(r => r.stats.delivered);
    const meanCount = counts.reduce((a, b) => a + b, 0) / Math.max(1, counts.length);
    const variance = counts.reduce((sum, c) => sum + Math.pow(c - meanCount, 2), 0) / Math.max(1, counts.length);
    const fairnessStdDev = Number(Math.sqrt(variance).toFixed(2));

    // 7. Live state
    const active = allOrders.filter(o => !['delivered', 'cancelled', 'failed', 'rejected'].includes(o.status));
    const lateNow = active.filter(o => o.isLate).length;
    const queues = stores.map(s => s.packQueue.length);
    const packingQueueDepth = queues.reduce((a, b) => a + b, 0);

    // 8. Mix
    const ordersByClass = { express: 0, regular: 0, infeasible: 0 };
    const ordersPerZone: Record<string, number> = {};
    for (const o of allOrders) {
      if (o.class) ordersByClass[o.class] += 1;
      const zone = o.servingStoreId ?? o.storeId;
      if (zone) ordersPerZone[zone] = (ordersPerZone[zone] ?? 0) + 1;
    }

    // History every 10 sim-seconds, last 60 points
    if (this.history.length === 0 || nowSimTime - this.history[this.history.length - 1].t >= 10) {
      this.history.push({
        t: nowSimTime,
        onTimeRate: Number(onTimeRate.toFixed(1)),
        avgDeliverySec: Math.round(avgDeliverySec),
        packingQueueDepth,
      });
      if (this.history.length > 60) this.history.shift();
    }

    return {
      onTimeRate: Number(onTimeRate.toFixed(1)),
      avgDeliverySec: Math.round(avgDeliverySec),
      p90DeliverySec: Math.round(percentile(timesSec, 0.9)),
      ordersPerTrip,
      kmPerOrder,
      utilization: Number(utilization.toFixed(1)),
      fairnessStdDev,
      lateNow,
      delivered: deliveredCount,
      pending: active.length,
      p90LatenessSec: Math.round(percentile(lateness, 0.9)),
      maxLatenessSec: Math.round(lateness.length ? lateness[lateness.length - 1] : 0),
      ordersFailed: failedCount,
      ordersRejected: rejectedCount,
      kmTotal: Number(kmTotal.toFixed(1)),
      reassignments: this.reassignments,
      handovers: this.handovers,
      reroutes: this.reroutes,
      decisionMsAvg: this.decisionCalls ? Number((this.decisionMsSum / this.decisionCalls).toFixed(2)) : 0,
      decisionMsMax: Number(this.decisionMsMax.toFixed(2)),
      ordersByClass,
      ordersPerZone,
      packingQueueDepth,
      maxPackingQueueAcrossStores: queues.length ? Math.max(...queues) : 0,
      history: [...this.history],
    };
  }
}
