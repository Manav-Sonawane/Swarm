import seedrandom from 'seedrandom';
import { World, isTerminal } from './sim/world';
import { OrderGenerator } from './sim/orderGenerator';
import { ScenarioName, EventPayload } from './types';
import { CONFIG } from './config';

const SPIKE_DURATION_SEC = 600;

export class ScenarioEngine {
  private weatherMult: number = 1.0;
  private spikeEndsAt: number = -Infinity;
  private rng: seedrandom.PRNG = seedrandom('swarm-scenario-0');

  constructor(seed: number = CONFIG.DEFAULT_SEED) {
    this.reset(seed);
  }

  /** Back to clear weather, no spike, and a scenario RNG derived from the seed (reproducible runs). */
  public reset(seed: number): void {
    this.weatherMult = 1.0;
    this.spikeEndsAt = -Infinity;
    this.rng = seedrandom(`swarm-scenario-${seed}`);
  }

  /** Persistent conditions only; one-off events (offline, stockout, cancel) don't stay "active". */
  public getActiveScenario(nowSimTime: number): ScenarioName {
    if (nowSimTime < this.spikeEndsAt) return 'spike';
    if (this.weatherMult < 1.0) return 'monsoon';
    return 'normal';
  }

  public getWeatherMult(): number {
    return this.weatherMult;
  }

  /** Applies the same disruption to every world (same riders, same orders). */
  public triggerScenario(name: ScenarioName, worlds: World[], orderGen: OrderGenerator, nowSimTime: number): EventPayload[] {
    const events: EventPayload[] = [];
    const ev = (kind: string, message: string) => events.push({ simTime: nowSimTime, world: 'all', kind, message });

    switch (name) {
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
          .filter(id => worlds.every(w => w.riders.find(r => r.id === id)!.status !== 'offline'))
          .sort();
        const picked: string[] = [];
        for (let i = 0; i < 3 && candidates.length > 0; i++) {
          picked.push(candidates.splice(Math.floor(this.rng() * candidates.length), 1)[0]);
        }

        let released = 0;
        let failed = 0;
        for (const world of worlds) {
          for (const id of picked) {
            const rider = world.riders.find(r => r.id === id)!;
            for (const oid of [...rider.assignedOrderIds]) {
              const o = world.ordersMap.get(oid);
              if (!o || isTerminal(o)) continue;
              if (o.status === 'picked') {
                world.endOrder(o, 'failed', nowSimTime, `rider ${id} went offline mid-delivery`); // goods are with the rider
                failed++;
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

        ev('SCENARIO_RIDERS_OFFLINE', `🛵 ${picked.join(', ')} went offline mid-shift. Unpicked orders released for re-allocation (${released} across worlds); ${failed} picked order(s) failed.`);
        break;
      }
      case 'stockout': {
        const top5Skus = ['SKU-MILK-1L', 'SKU-BREAD-WHITE', 'SKU-EGGS-6P', 'SKU-BANANA-1KG', 'SKU-MAGGI-4P'];
        for (const world of worlds) {
          const targetStore = world.stores[0]; // Andheri West
          top5Skus.forEach(sku => (targetStore.inventory[sku] = 0));
        }
        ev('SCENARIO_STOCKOUT', `📦 Major Stockout at ${worlds[0].stores[0].name}! Top 5 SKUs dropped to 0 stock.`);
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
