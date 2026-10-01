import seedrandom from 'seedrandom';
import { World, isTerminal } from './sim/world';
import { OrderGenerator } from './sim/orderGenerator';
import { ScenarioName, EventPayload } from './types';
import { CONFIG } from './config';
import { setTrafficJam } from './sim/travel';
import { TrafficJam } from './types';

const SPIKE_DURATION_SEC = 600;

export class ScenarioEngine {
  private weatherMult: number = 1.0;
  private spikeEndsAt: number = -Infinity;
  private rng: seedrandom.PRNG = seedrandom('swarm-scenario-0');
  private offlineStoreIds: string[] = [];
  private jam: TrafficJam | null = null;

  constructor(seed: number = CONFIG.DEFAULT_SEED) {
    this.reset(seed);
  }

  /** Back to clear weather, no spike, and a scenario RNG derived from the seed (reproducible runs). */
  public reset(seed: number): void {
    this.weatherMult = 1.0;
    this.spikeEndsAt = -Infinity;
    this.offlineStoreIds = [];
    this.jam = null;
    setTrafficJam(null);
    this.rng = seedrandom(`swarm-scenario-${seed}`);
  }

  /** Persistent conditions only; one-off events (offline, stockout, cancel) don't stay "active". */
  public getActiveScenario(nowSimTime: number): ScenarioName {
    if (nowSimTime < this.spikeEndsAt) return 'spike';
    if (this.weatherMult < 1.0) return 'monsoon';
    if (this.jam) return 'traffic_jam';
    if (this.offlineStoreIds.length > 0) return 'store_offline';
    return 'normal';
  }

  public getTrafficJam(): TrafficJam | null {
    return this.jam;
  }

  public getWeatherMult(): number {
    return this.weatherMult;
  }

  /** Applies the same disruption to every world (same riders, same orders). */
  public triggerScenario(name: ScenarioName, worlds: World[], orderGen: OrderGenerator, nowSimTime: number): EventPayload[] {
    const events: EventPayload[] = [];
    const ev = (kind: string, message: string) => events.push({ simTime: nowSimTime, world: 'all', kind, message });

    // Contract names map onto the prototype ones the UI buttons still send
    const aliases: Partial<Record<ScenarioName, ScenarioName>> = { surge: 'spike', rider_offline: 'riders_offline' };
    const scenario = aliases[name] ?? name;

    switch (scenario) {
      case 'monsoon': {
        this.weatherMult = 1 / CONFIG.TRAFFIC_MULTIPLIER_MONSOON;
        ev('SCENARIO_MONSOON', '🌧️ Heavy Monsoon started! Travel times up 50%.');
        break;
      }
      case 'clear_weather': {
        this.weatherMult = 1.0;
        ev('SCENARIO_CLEAR', '☀️ Monsoon cleared. Travel speed returned to normal.');
        break;
      }
      case 'clear': {
        this.weatherMult = 1.0;
        let restored = 0;
        for (const world of worlds) restored = world.restoreStores();
        this.offlineStoreIds = [];
        const hadJam = !!this.jam;
        this.jam = null;
        setTrafficJam(null);
        ev('SCENARIO_CLEAR', `☀️ All clear: normal weather${hadJam ? ', traffic flowing' : ''}${restored ? `, ${restored} store(s) back online` : ''}.`);
        break;
      }
      case 'store_offline': {
        // Same store in every world, picked with the seeded RNG among stores still online
        const online = worlds[0].stores.filter(st => !st.offline).map(st => st.id).sort();
        if (online.length <= 1) break;
        const storeId = online[Math.floor(this.rng() * online.length)];
        this.offlineStoreIds.push(storeId);
        let rerouted = 0;
        let failed = 0;
        let lent = 0;
        for (const world of worlds) {
          // Orders move to the next-nearest online store only if the shared catalog says it has every item
          const r = world.setStoreOffline(storeId, nowSimTime, (store, order) => orderGen.hasStockAt(store.id, order));
          rerouted += r.rerouted;
          failed += r.failed;
          lent = r.lentRiders;
        }
        const name = worlds[0].stores.find(st => st.id === storeId)!.name;
        ev('SCENARIO_STORE_OFFLINE', `🏚️ ${name} went offline. ${rerouted} unpicked order(s) re-served from the next-nearest store across worlds, ${failed} failed (items unavailable nearby); its ${lent} riders join the nearest store.`);
        break;
      }
      case 'traffic_jam': {
        // Gridlock around one store (seeded pick, same in every world): travel inside the circle takes JAM_MULTIPLIER x
        const online = worlds[0].stores.filter(st => !st.offline).sort((a, b) => a.id.localeCompare(b.id));
        const st = online[Math.floor(this.rng() * online.length)];
        if (!st) break;
        this.jam = { storeId: st.id, name: st.name.replace(' Dark Store', ''), lat: st.loc.lat, lng: st.loc.lng, radiusKm: CONFIG.JAM_RADIUS_KM, mult: CONFIG.JAM_MULTIPLIER };
        setTrafficJam({ center: { ...st.loc }, radiusKm: CONFIG.JAM_RADIUS_KM, mult: CONFIG.JAM_MULTIPLIER });
        ev('SCENARIO_TRAFFIC_JAM', `🚧 Gridlock around ${this.jam.name}: travel within ${CONFIG.JAM_RADIUS_KM} km takes ${CONFIG.JAM_MULTIPLIER}x as long. Swarm re-plans and re-sequences drops.`);
        break;
      }
      case 'spike': {
        orderGen.triggerSpike(nowSimTime, SPIKE_DURATION_SEC);
        this.spikeEndsAt = nowSimTime + SPIKE_DURATION_SEC;
        ev('SCENARIO_IPL_SPIKE', '🏏 IPL Final Spike triggered! Order rate 3x for 10 minutes in Bandra & Andheri.');
        break;
      }
      case 'riders_offline': {
        // Pick riders that are online in every world, with the seeded RNG, so all worlds lose the same riders
        const candidates = worlds[0].riders
          .map(r => r.id)
          .filter(id => worlds.every(w => !['offline', 'off_shift'].includes(w.riders.find(r => r.id === id)!.status)))
          .sort();
        const picked: string[] = [];
        for (let i = 0; i < 3 && candidates.length > 0; i++) {
          picked.push(candidates.splice(Math.floor(this.rng() * candidates.length), 1)[0]);
        }

        let released = 0;
        let stranded = 0;
        for (const world of worlds) {
          for (const id of picked) {
            const rider = world.riders.find(r => r.id === id)!;
            for (const oid of [...rider.assignedOrderIds]) {
              const o = world.ordersMap.get(oid);
              if (!o || isTerminal(o)) continue;
              if (o.status === 'picked') {
                world.strandOrder(o, rider.loc, nowSimTime, id); // goods are safe at the roadside: another rider collects them
                stranded++;
              } else {
                world.releaseOrder(o); // back to the pool for re-allocation (re-packed)
                released++;
              }
            }
            rider.status = 'offline';
            rider.assignedOrderIds = [];
            rider.route = [];
          }
        }

        ev('SCENARIO_RIDERS_OFFLINE', `🛵 ${picked.join(', ')} went offline mid-shift. Unpicked orders released for re-allocation (${released} across worlds); ${stranded} picked order(s) held at the roadside for a handover.`);
        break;
      }
      case 'stockout': {
        // Shows as "out of stock" in the app: new carts at this store can't include these items. Orders already
        // placed had their items reserved at checkout, so nothing already promised is affected.
        const top5Skus = ['SKU-MILK-1L', 'SKU-BREAD-WHITE', 'SKU-EGGS-6P', 'SKU-BANANA-1KG', 'SKU-MAGGI-4P'];
        const target = worlds[0].stores[0]; // Andheri West
        orderGen.setOutOfStock(target.id, top5Skus);
        ev('SCENARIO_STOCKOUT', `📦 Stock-out at ${target.name}: milk, bread, eggs, bananas and Maggi now show as out of stock; new carts there can't include them.`);
        break;
      }
      case 'cancel_burst': {
        // Same order IDs in every world: orders not yet picked up (and not finished) everywhere
        const unpicked = new Set(['placed', 'assigned', 'packing', 'packed']);
        const candidates = [...worlds[0].ordersMap.keys()]
          .filter(id => worlds.every(w => unpicked.has(w.ordersMap.get(id)?.status ?? '')))
          .sort();
        const count = Math.max(1, Math.floor(candidates.length * 0.1));
        const picked: string[] = [];
        for (let i = 0; i < count && candidates.length > 0; i++) {
          picked.push(candidates.splice(Math.floor(this.rng() * candidates.length), 1)[0]);
        }
        for (const id of picked) orderGen.restock(worlds[0].ordersMap.get(id)!); // items go back on the shelf (once)
        for (const world of worlds) {
          for (const id of picked) world.endOrder(world.ordersMap.get(id)!, 'cancelled', nowSimTime, 'customer cancelled');
        }
        ev('SCENARIO_CANCEL', `❌ Cancellation Burst: ${picked.length} unpicked order(s) cancelled in every world.`);
        break;
      }
    }

    return events;
  }
}
