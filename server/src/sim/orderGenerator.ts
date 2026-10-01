import seedrandom from 'seedrandom';
import { Order, DarkStore } from '../types';
import { CONFIG } from '../config';
import { travelTimeSec } from './travel';

const SKUS = [
  'SKU-MILK-1L', 'SKU-BREAD-WHITE', 'SKU-EGGS-6P', 'SKU-BANANA-1KG',
  'SKU-MAGGI-4P', 'SKU-CHIPS-50G', 'SKU-COKE-750ML', 'SKU-WATER-2L',
  'SKU-CURD-500G', 'SKU-BUTTER-100G', 'SKU-ICE-CREAM-500ML', 'SKU-CHOCOLATE-BAR',
  'SKU-APPLE-1KG', 'SKU-TOMATO-1KG', 'SKU-ONION-1KG', 'SKU-POTATO-1KG',
];

export class OrderGenerator {
  private rng: seedrandom.PRNG;
  private orderCounter: number = 1;
  private nextArrivalSimTime: number = 0;
  private isSpikeActive: boolean = false;
  private spikeEndSimTime: number = 0;
  private spikeZones: string[] = ['store-bandra', 'store-andheri'];

  constructor(seed: number, startSimTime: number) {
    this.rng = seedrandom(`swarm-order-seed-${seed}`);
    this.nextArrivalSimTime = startSimTime + this.getNextArrivalInterval();
  }

  public reset(seed: number, startSimTime: number): void {
    this.rng = seedrandom(`swarm-order-seed-${seed}`);
    this.orderCounter = 1;
    this.isSpikeActive = false;
    this.spikeEndSimTime = 0;
    this.nextArrivalSimTime = startSimTime + this.getNextArrivalInterval();
  }

  public triggerSpike(nowSimTime: number, durationSec: number = 600): void {
    this.isSpikeActive = true;
    this.spikeEndSimTime = nowSimTime + durationSec;
  }

  private getNextArrivalInterval(): number {
    // Mean arrival interval in sim-seconds. Base: 1 order every 15 sim seconds.
    // If spike is active: 1 order every 5 sim seconds (3x rate).
    const meanIntervalSec = this.isSpikeActive ? 5 : 15;
    // Exponential distribution for Poisson process
    const u = this.rng();
    return -Math.log(1 - u) * meanIntervalSec;
  }

  public step(simTime: number, stores: DarkStore[]): Order[] {
    if (this.isSpikeActive && simTime >= this.spikeEndSimTime) {
      this.isSpikeActive = false;
    }

    const generatedOrders: Order[] = [];

    while (simTime >= this.nextArrivalSimTime) {
      // Pick target store zone
      let targetStore: DarkStore;
      if (this.isSpikeActive && this.rng() < 0.8) {
        // 80% spike orders go to spike zones
        const spikeStoreId = this.spikeZones[Math.floor(this.rng() * this.spikeZones.length)];
        targetStore = stores.find(s => s.id === spikeStoreId) || stores[Math.floor(this.rng() * stores.length)];
      } else {
        targetStore = stores[Math.floor(this.rng() * stores.length)];
      }

      // Generate customer location within 0.5 - 3.2 km (~0.005 - 0.028 lat/lng degrees) of store
      const distanceKm = 0.5 + this.rng() * 2.7;
      const angle = this.rng() * 2 * Math.PI;
      // 1 deg lat ~ 111km, 1 deg lng ~ 105km at Mumbai latitude
      const latOffset = (distanceKm / 111.0) * Math.sin(angle);
      const lngOffset = (distanceKm / 105.0) * Math.cos(angle);

      const customerLoc = {
        lat: targetStore.loc.lat + latOffset,
        lng: targetStore.loc.lng + lngOffset,
      };

      // Feasibility & Order Class determination
      const storeEtaSec = travelTimeSec(targetStore.loc, customerLoc, simTime, 1.0, targetStore.id);
      const totalTimeSec = storeEtaSec + CONFIG.AVG_PACK_TIME_SEC;

      let orderClass: 'express' | 'regular' | 'infeasible';
      let priority: 'express' | 'regular';
      let promisedSec: number;

      if (totalTimeSec <= CONFIG.EXPRESS_PROMISED_SEC) {
        orderClass = 'express';
        priority = 'express';
        promisedSec = CONFIG.EXPRESS_PROMISED_SEC;
      } else if (totalTimeSec <= CONFIG.REGULAR_PROMISED_SEC) {
        orderClass = 'regular';
        priority = 'regular';
        promisedSec = CONFIG.REGULAR_PROMISED_SEC;
      } else {
        orderClass = 'infeasible';
        priority = 'regular';
        promisedSec = CONFIG.REGULAR_PROMISED_SEC + 600; // 30 min
      }

      // Select 1 to 3 items
      const numItems = 1 + Math.floor(this.rng() * 3);
      const items: { sku: string; qty: number }[] = [];
      const selectedSkus = new Set<string>();

      for (let i = 0; i < numItems; i++) {
        const sku = SKUS[Math.floor(this.rng() * SKUS.length)];
        if (!selectedSkus.has(sku)) {
          selectedSkus.add(sku);
          items.push({ sku, qty: 1 + Math.floor(this.rng() * 2) });
        }
      }

      const order: Order = {
        id: `ord-${String(this.orderCounter++).padStart(4, '0')}`,
        loc: customerLoc,
        items,
        priority,
        orderClass,
        createdAt: this.nextArrivalSimTime,
        promisedBy: this.nextArrivalSimTime + promisedSec,
        status: 'placed',
        isLate: false,
        zoneId: targetStore.id,
      };

      generatedOrders.push(order);
      this.nextArrivalSimTime += this.getNextArrivalInterval();
    }

    return generatedOrders;
  }
}
