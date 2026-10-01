import { Order, Rider, Metrics } from './types';

export class MetricsEngine {
  private history: { t: number; onTimeRate: number; avgDeliverySec: number }[] = [];
  private totalCompletedTrips: number = 0;

  public incrementCompletedTrips(count: number = 1): void {
    this.totalCompletedTrips += count;
  }

  public reset(): void {
    this.history = [];
    this.totalCompletedTrips = 0;
  }

  public calculateMetrics(
    allOrders: Order[],
    riders: Rider[],
    nowSimTime: number,
    startSimTime: number
  ): Metrics {
    const deliveredOrders = allOrders.filter(o => o.status === 'delivered' && o.deliveredAt !== undefined);
    const deliveredCount = deliveredOrders.length;

    // 1. On-time rate
    const onTimeCount = deliveredOrders.filter(o => o.deliveredAt! <= o.promisedBy).length;
    const onTimeRate = deliveredCount > 0 ? (onTimeCount / deliveredCount) * 100 : 100;

    // 2. Avg delivery time & P90
    let avgDeliverySec = 0;
    let p90DeliverySec = 0;

    if (deliveredCount > 0) {
      const timesSec = deliveredOrders.map(o => o.deliveredAt! - o.createdAt).sort((a, b) => a - b);
      const sumSec = timesSec.reduce((a, b) => a + b, 0);
      avgDeliverySec = sumSec / deliveredCount;

      const p90Idx = Math.floor(deliveredCount * 0.9);
      p90DeliverySec = timesSec[Math.min(p90Idx, deliveredCount - 1)];
    }

    // 3. Orders per trip
    // Trips = completed trips + active trips
    const activeTripsCount = riders.filter(r => r.assignedOrderIds.length > 0).length;
    const totalTrips = Math.max(1, this.totalCompletedTrips + activeTripsCount);
    const ordersPerTrip = deliveredCount > 0 ? Number((deliveredCount / totalTrips).toFixed(2)) : 1.0;

    // 4. Km per order
    const totalKm = riders.reduce((sum, r) => sum + r.stats.km, 0);
    const kmPerOrder = deliveredCount > 0 ? Number((totalKm / deliveredCount).toFixed(2)) : 0;

    // 5. Rider Utilization %
    const totalSimDuration = Math.max(1, nowSimTime - startSimTime);
    const avgActiveSec = riders.reduce((sum, r) => sum + r.stats.activeSec, 0) / Math.max(1, riders.length);
    const utilization = Math.min(100, (avgActiveSec / totalSimDuration) * 100);

    // 6. Fairness Std Dev (deliveries per rider)
    const counts = riders.map(r => r.stats.delivered);
    const meanCount = counts.reduce((a, b) => a + b, 0) / Math.max(1, counts.length);
    const variance = counts.reduce((sum, c) => sum + Math.pow(c - meanCount, 2), 0) / Math.max(1, counts.length);
    const fairnessStdDev = Number(Math.sqrt(variance).toFixed(2));

    // 7. Late right now
    const lateNow = allOrders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled' && o.isLate).length;
    const pending = allOrders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled').length;

    // Update history (keep last 60 points)
    if (this.history.length === 0 || nowSimTime - this.history[this.history.length - 1].t >= 10) {
      this.history.push({
        t: nowSimTime,
        onTimeRate: Number(onTimeRate.toFixed(1)),
        avgDeliverySec: Math.round(avgDeliverySec),
      });

      if (this.history.length > 60) {
        this.history.shift();
      }
    }

    return {
      onTimeRate: Number(onTimeRate.toFixed(1)),
      avgDeliverySec: Math.round(avgDeliverySec),
      p90DeliverySec: Math.round(p90DeliverySec),
      ordersPerTrip,
      kmPerOrder,
      utilization: Number(utilization.toFixed(1)),
      fairnessStdDev,
      lateNow,
      delivered: deliveredCount,
      pending,
      history: [...this.history],
    };
  }
}
