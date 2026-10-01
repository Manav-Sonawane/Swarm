import seedrandom from 'seedrandom';
import { Order, DarkStore } from '../types';
import { CONFIG } from '../config';
import { isOnLand } from '../seed/land';
import { SKUS, generateSeedInventory } from '../seed/stores';
import { servingStoreFor } from './store-select';

// The popular items customers actually put in carts (the first 16 of the 40 catalogue SKUs)
const ORDERABLE = SKUS.slice(0, 16);

export class OrderGenerator {
  private rng: seedrandom.PRNG;
  private orderCounter: number = 1;
  private manualCounter: number = 1;
  private nextArrivalSimTime: number = 0;
  private isSpikeActive: boolean = false;
  private spikeEndSimTime: number = 0;
  private spikeZones: string[] = ['store-bandra', 'store-andheri'];
  // Shared shelf stock, storeId -> sku -> qty. Lives here (not in a world) so every world sees the same orders.
  private catalog: Record<string, Record<string, number>> = generateSeedInventory();

  constructor(seed: number, startSimTime: number) {
    this.rng = seedrandom(`swarm-order-seed-${seed}`);
    this.nextArrivalSimTime = startSimTime + this.getNextArrivalInterval();
  }

  public reset(seed: number, startSimTime: number): void {
    this.rng = seedrandom(`swarm-order-seed-${seed}`);
    this.orderCounter = 1;
    this.manualCounter = 1;
    this.isSpikeActive = false;
    this.spikeEndSimTime = 0;
    this.catalog = generateSeedInventory();
    this.nextArrivalSimTime = startSimTime + this.getNextArrivalInterval();
  }

  public triggerSpike(nowSimTime: number, durationSec: number = 600): void {
    this.isSpikeActive = true;
    this.spikeEndSimTime = nowSimTime + durationSec;
  }

  /** Shelf stock of the orderable SKUs for every store (Setup screen, order composer). */
  public stockSnapshot(): Record<string, Record<string, number>> {
    const out: Record<string, Record<string, number>> = {};
    for (const [storeId, inv] of Object.entries(this.catalog)) {
      out[storeId] = {};
      for (const sku of ORDERABLE) out[storeId][sku] = inv[sku] ?? 0;
    }
    return out;
  }

  /**
   * A customer order placed by hand from the dashboard. Same rules as the stream: served by the nearest online
   * dark store within the service radius, and the cart can only hold what that store has on the shelf.
   */
  public createManualOrder(
    req: { lat: number; lng: number; items: { sku: string; qty: number }[] },
    now: number,
    stores: DarkStore[]
  ): { order: Order } | { error: string } {
    const loc = { lat: req.lat, lng: req.lng };
    if (!isOnLand(loc)) return { error: "That spot is in the sea. Pick an address on land." };
    const serving = servingStoreFor(loc, stores);
    if (!serving) return { error: `Outside the service area: no online dark store within ${CONFIG.GEOFENCE_KM} km.` };
    const inv = this.catalog[serving.id];
    const items: { sku: string; qty: number }[] = [];
    for (const it of req.items ?? []) {
      const qty = Math.floor(Number(it.qty));
      if (!ORDERABLE.includes(it.sku) || !(qty > 0)) continue;
      if ((inv[it.sku] ?? 0) < qty) return { error: `${serving.name} only has ${inv[it.sku] ?? 0} of ${it.sku.replace('SKU-', '')} in stock.` };
      items.push({ sku: it.sku, qty: Math.min(qty, 10) });
    }
    if (items.length === 0) return { error: 'The cart is empty. Add at least one in-stock item.' };
    for (const it of items) inv[it.sku] -= it.qty; // reserved at checkout
    const order: Order = {
      id: `web-${String(this.manualCounter++).padStart(3, '0')}`,
      loc,
      items,
      priority: 'regular',
      class: 'regular',
      createdAt: now,
      promisedBy: now + CONFIG.REGULAR_PROMISED_SEC,
      status: 'placed',
      isLate: false,
      zoneId: serving.id,
      servingStoreId: serving.id,
      manual: true,
    };
    return { order };
  }

  /** Stock-out: these SKUs show as "out of stock" at the store, so no new cart can include them. */
  public setOutOfStock(storeId: string, skus: string[]): void {
    for (const sku of skus) if (this.catalog[storeId]) this.catalog[storeId][sku] = 0;
  }

  /** Read-only check: does this store have every item of the order on the shelf? */
  public hasStockAt(storeId: string, order: Order): boolean {
    return order.items.every(it => (this.catalog[storeId]?.[it.sku] ?? 0) >= it.qty);
  }

  /** An order cancelled before pickup puts its items back on the shelf. */
  public restock(order: Order): void {
    const inv = this.catalog[order.servingStoreId ?? ''];
    if (!inv) return;
    for (const it of order.items) if (inv[it.sku] !== undefined) inv[it.sku] += it.qty;
  }

  private getNextArrivalInterval(): number {
    // Mean arrival interval in sim-seconds from ORDERS_PER_HOUR; a spike triples the rate
    const baseIntervalSec = 3600 / CONFIG.ORDERS_PER_HOUR;
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
      // Pick a neighbourhood to place the customer in
      let anchor: DarkStore;
      if (this.isSpikeActive && this.rng() < 0.8) {
        // 80% spike orders go to spike zones
        const spikeStoreId = this.spikeZones[Math.floor(this.rng() * this.spikeZones.length)];
        anchor = stores.find(s => s.id === spikeStoreId) || stores[Math.floor(this.rng() * stores.length)];
      } else {
        anchor = stores[Math.floor(this.rng() * stores.length)];
      }

      // Customer 0.5–3.2 km from that neighbourhood's store, re-drawn until on land (seeded, so reproducible)
      let customerLoc = { lat: anchor.loc.lat, lng: anchor.loc.lng };
      for (let attempt = 0; attempt < 30; attempt++) {
        const distanceKm = 0.5 + this.rng() * 2.7;
        const angle = this.rng() * 2 * Math.PI;
        // 1 deg lat ~ 111km, 1 deg lng ~ 105km at Mumbai latitude
        const candidate = {
          lat: anchor.loc.lat + (distanceKm / 111.0) * Math.sin(angle),
          lng: anchor.loc.lng + (distanceKm / 105.0) * Math.cos(angle),
        };
        if (isOnLand(candidate)) {
          customerLoc = candidate;
          break;
        }
      }

      const createdAt = this.nextArrivalSimTime;
      this.nextArrivalSimTime += this.getNextArrivalInterval();

      // Zepto/Blinkit: the app serves the customer from their nearest online dark store
      const serving = servingStoreFor(customerLoc, stores);
      const base = {
        id: `ord-${String(this.orderCounter).padStart(4, '0')}`,
        loc: customerLoc,
        // class, priority and promise are set by classifyOrder() (alloc/feasibility.ts) on the shared stream
        priority: 'regular' as const,
        class: 'regular' as const,
        createdAt,
        promisedBy: createdAt + CONFIG.REGULAR_PROMISED_SEC,
        isLate: false,
      };

      if (!serving) {
        this.orderCounter++;
        generatedOrders.push({ ...base, items: [], status: 'rejected', class: 'infeasible', promisedBy: createdAt, failReason: 'outside the service area' });
        continue;
      }

      // The cart only offers what that store has in stock: out-of-stock items simply aren't there
      const inv = this.catalog[serving.id];
      const available = ORDERABLE.filter(sku => (inv[sku] ?? 0) > 0);
      if (available.length === 0) continue; // store has nothing to sell: no order

      const numItems = 1 + Math.floor(this.rng() * 3);
      const items: { sku: string; qty: number }[] = [];
      const chosen = new Set<string>();
      for (let i = 0; i < numItems; i++) {
        const sku = available[Math.floor(this.rng() * available.length)];
        if (chosen.has(sku)) continue;
        chosen.add(sku);
        const qty = Math.min(1 + Math.floor(this.rng() * 2), inv[sku]);
        inv[sku] -= qty; // reserved at checkout
        items.push({ sku, qty });
      }

      this.orderCounter++;
      generatedOrders.push({ ...base, items, status: 'placed', zoneId: serving.id, servingStoreId: serving.id });
    }

    return generatedOrders;
  }
}
