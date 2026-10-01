import { Rider } from '../types';
import { CONFIG } from '../config';

export function generateSeedRiders(stores: { id: string; loc: { lat: number; lng: number } }[]): Rider[] {
  const riders: Rider[] = [];
  let riderCount = 1;

  for (const store of stores) {
    for (let r = 1; r <= CONFIG.RIDERS_PER_STORE; r++) {
      const riderId = `rider-${riderCount++}`;
      // Offset position slightly around the store
      const latOffset = (Math.sin(riderCount) * 0.0005);
      const lngOffset = (Math.cos(riderCount) * 0.0005);

      riders.push({
        id: riderId,
        loc: {
          lat: store.loc.lat + latOffset,
          lng: store.loc.lng + lngOffset,
        },
        status: 'idle',
        capacity: CONFIG.CAPACITY,
        homeStoreId: store.id,
        route: [],
        assignedOrderIds: [],
        stats: {
          delivered: 0,
          activeSec: 0,
          km: 0,
        },
      });
    }
  }

  return riders;
}
