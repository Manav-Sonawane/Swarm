import seedrandom from 'seedrandom';
import { Order, DarkStore } from '../types';
import { CONFIG } from '../config';
import { isOnLand } from '../seed/land';

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
    const baseIntervalSec = 3600 / CONFIG.ORDERS_PER_HOUR; // 240/h -> one order every 15 sim-seconds
    const meanIntervalSec = this.isSpikeActive ? baseIntervalSec / 3 : baseIntervalSec;
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

      // Customer 0.5–3.2 km from the store, re-drawn until it falls on land (seeded, so still reproducible)
      let customerLoc = { lat: targetStore.loc.lat, lng: targetStore.loc.lng };
      for (let attempt = 0; attempt < 30; attempt++) {
        const distanceKm = 0.5 + this.rng() * 2.7;
        const angle = this.rng() * 2 * Math.PI;
        // 1 deg lat ~ 111km, 1 deg lng ~ 105km at Mumbai latitude
        const candidate = {
          lat: targetStore.loc.lat + (distanceKm / 111.0) * Math.sin(angle),
          lng: targetStore.loc.lng + (distanceKm / 105.0) * Math.cos(angle),
        };
        if (isOnLand(candidate)) {
          customerLoc = candidate;
          break;
        }
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
        // class, priority and promise are set by classifyOrder() (alloc/feasibility.ts) on the shared stream
        priority: 'regular',
        class: 'regular',
        createdAt: this.nextArrivalSimTime,
        promisedBy: this.nextArrivalSimTime + CONFIG.REGULAR_PROMISED_SEC,
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
