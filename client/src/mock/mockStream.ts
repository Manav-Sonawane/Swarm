import { TickPayload, RiderSnapshot, OrderSnapshot } from '../types';

export function getMockTickPayload(simTime: number = 19 * 3600): TickPayload {
  const stores = [
    { id: 'store-andheri', name: 'Andheri West Dark Store', lat: 19.1364, lng: 72.8296, queue: 2 },
    { id: 'store-bandra', name: 'Bandra West Dark Store', lat: 19.0596, lng: 72.8295, queue: 0 },
    { id: 'store-powai', name: 'Powai Dark Store', lat: 19.1176, lng: 72.9060, queue: 1 },
    { id: 'store-parel', name: 'Lower Parel Dark Store', lat: 18.9953, lng: 72.8300, queue: 0 },
    { id: 'store-ghatkopar', name: 'Ghatkopar Dark Store', lat: 19.0860, lng: 72.9081, queue: 3 },
  ];

  const ridersBaseline: RiderSnapshot[] = [
    { id: 'rider-1', lat: 19.1364, lng: 72.8296, status: 'delivering', load: 1, routeLine: [[19.1364, 72.8296], [19.1450, 72.8350]], homeStoreId: 'store-andheri' },
    { id: 'rider-2', lat: 19.0596, lng: 72.8295, status: 'idle', load: 0, routeLine: [], homeStoreId: 'store-bandra' },
    { id: 'rider-3', lat: 19.1176, lng: 72.9060, status: 'to_store', load: 1, routeLine: [[19.1176, 72.9060]], homeStoreId: 'store-powai' },
  ];

  const ridersSwarm: RiderSnapshot[] = [
    { id: 'rider-1', lat: 19.1364, lng: 72.8296, status: 'delivering', load: 3, routeLine: [[19.1364, 72.8296], [19.1420, 72.8330], [19.1480, 72.8380]], homeStoreId: 'store-andheri' },
    { id: 'rider-2', lat: 19.0596, lng: 72.8295, status: 'idle', load: 0, routeLine: [], homeStoreId: 'store-bandra' },
    { id: 'rider-3', lat: 19.1176, lng: 72.9060, status: 'delivering', load: 2, routeLine: [[19.1176, 72.9060], [19.1220, 72.9100]], homeStoreId: 'store-powai' },
  ];

  const ordersBaseline: OrderSnapshot[] = [
    { id: 'ord-0001', lat: 19.1450, lng: 72.8350, status: 'picked', priority: 'express', isLate: true, promisedBy: simTime + 200, createdAt: simTime - 400 },
  ];

  const ordersSwarm: OrderSnapshot[] = [
    { id: 'ord-0001', lat: 19.1420, lng: 72.8330, status: 'picked', priority: 'express', isLate: false, promisedBy: simTime + 200, createdAt: simTime - 400 },
  ];

  return {
    simTime,
    speed: 10,
    running: true,
    seed: 42,
    activeScenario: 'normal',
    weatherMult: 1.0,
    worlds: {
      baseline: {
        riders: ridersBaseline,
        orders: ordersBaseline,
        stores,
        metrics: {
          onTimeRate: 72.4,
          avgDeliverySec: 840,
          p90DeliverySec: 1120,
          ordersPerTrip: 1.0,
          kmPerOrder: 3.8,
          utilization: 88.5,
          fairnessStdDev: 4.2,
          lateNow: 6,
          delivered: 28,
          pending: 14,
          history: [{ t: simTime, onTimeRate: 72.4, avgDeliverySec: 840 }],
        },
      },
      swarm: {
        riders: ridersSwarm,
        orders: ordersSwarm,
        stores,
        metrics: {
          onTimeRate: 96.8,
          avgDeliverySec: 510,
          p90DeliverySec: 680,
          ordersPerTrip: 2.6,
          kmPerOrder: 1.9,
          utilization: 74.2,
          fairnessStdDev: 1.1,
          lateNow: 0,
          delivered: 34,
          pending: 8,
          history: [{ t: simTime, onTimeRate: 96.8, avgDeliverySec: 510 }],
        },
      },
    },
  };
}
