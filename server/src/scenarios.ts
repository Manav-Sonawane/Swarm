import { World } from './sim/world';
import { OrderGenerator } from './sim/orderGenerator';
import { ScenarioName, EventPayload } from './types';
import { CONFIG } from './config';

export class ScenarioEngine {
  private activeScenario: ScenarioName = 'normal';
  private weatherMult: number = 1.0;

  public getActiveScenario(): ScenarioName {
    return this.activeScenario;
  }

  public getWeatherMult(): number {
    return this.weatherMult;
  }

  public reset(): void {
    this.activeScenario = 'normal';
    this.weatherMult = 1.0;
  }

  public triggerScenario(
    name: ScenarioName,
    worldA: World,
    worldB: World,
    orderGen: OrderGenerator,
    nowSimTime: number
  ): EventPayload[] {
    const events: EventPayload[] = [];
    this.activeScenario = name;

    switch (name) {
      case 'monsoon': {
        this.weatherMult = 1 / CONFIG.TRAFFIC_MULTIPLIER_MONSOON;
        events.push({
          simTime: nowSimTime,
          world: 'both',
          kind: 'SCENARIO_MONSOON',
          message: '🌧️ Heavy Monsoon started! Travel times up 50%.',
        });
        break;
      }
      case 'clear_weather': {
        this.weatherMult = 1.0;
        this.activeScenario = 'normal';
        events.push({
          simTime: nowSimTime,
          world: 'both',
          kind: 'SCENARIO_CLEAR',
          message: '☀️ Monsoon cleared. Travel speed returned to normal.',
        });
        break;
      }
      case 'spike': {
        orderGen.triggerSpike(nowSimTime, 600); // 10 sim-minutes
        events.push({
          simTime: nowSimTime,
          world: 'both',
          kind: 'SCENARIO_IPL_SPIKE',
          message: '🏏 IPL Final Spike triggered! Order rate 3x for 10 minutes in Bandra & Andheri.',
        });
        break;
      }
      case 'riders_offline': {
        // Pick same 3 rider IDs in both worlds — rider-2 (Andheri), rider-8 (Bandra), rider-14 (Powai)
        const targetRiderIds = new Set(['rider-2', 'rider-8', 'rider-14']);

        [worldA, worldB].forEach(world => {
          world.riders.forEach(rider => {
            if (targetRiderIds.has(rider.id)) {
              rider.status = 'offline';

              // Release ALL non-delivered orders on this rider back to placed pool
              const affectedOrderIds = [...rider.assignedOrderIds];
              for (const oId of affectedOrderIds) {
                const ord = world.ordersMap.get(oId);
                if (ord && ord.status !== 'delivered' && ord.status !== 'cancelled') {
                  ord.status = 'placed';
                  ord.riderId = undefined;
                  ord.storeId = undefined;
                  ord.decision = undefined;
                  ord.holdUntil = undefined;
                  ord.packStartedAt = undefined;

                  // Remove from store pack queues
                  world.stores.forEach(s => {
                    s.packQueue = s.packQueue.filter(id => id !== oId);
                  });
                }
              }

              rider.assignedOrderIds = [];
              rider.route = [];
            }
          });
        });

        events.push({
          simTime: nowSimTime,
          world: 'both',
          kind: 'SCENARIO_RIDERS_OFFLINE',
          message: '🛵 Disruption: 3 riders went offline mid-shift! Active orders released back to pool for re-optimization.',
        });
        break;
      }
      case 'stockout': {
        const top5Skus = ['SKU-MILK-1L', 'SKU-BREAD-WHITE', 'SKU-EGGS-6P', 'SKU-BANANA-1KG', 'SKU-MAGGI-4P'];
        [worldA, worldB].forEach(world => {
          const targetStore = world.stores[0]; // Andheri West
          top5Skus.forEach(sku => {
            targetStore.inventory[sku] = 0;
          });
        });

        events.push({
          simTime: nowSimTime,
          world: 'both',
          kind: 'SCENARIO_STOCKOUT',
          message: `📦 Major Stockout at ${worldA.stores[0].name}! Top 5 SKUs dropped to 0 stock.`,
        });
        break;
      }
      case 'cancel_burst': {
        // Find unpicked order IDs shared between both worlds
        const sharedUnpicked = Array.from(worldA.ordersMap.values())
          .filter(o => o.status === 'placed' || o.status === 'assigned' || o.status === 'packing' || o.status === 'packed')
          .map(o => o.id);

        const numToCancel = Math.max(1, Math.floor(sharedUnpicked.length * 0.1));
        const cancelTargetIds = sharedUnpicked.slice(0, numToCancel);

        [worldA, worldB].forEach(world => {
          for (const cId of cancelTargetIds) {
            const target = world.ordersMap.get(cId);
            if (target && target.status !== 'delivered') {
              target.status = 'cancelled';
              // Remove from store pack queues and rider assigned orders
              world.stores.forEach(s => {
                s.packQueue = s.packQueue.filter(id => id !== target.id);
              });
              world.riders.forEach(r => {
                r.assignedOrderIds = r.assignedOrderIds.filter(id => id !== target.id);
                r.route = r.route.filter(st => st.orderId !== target.id);
              });
            }
          }
        });

        events.push({
          simTime: nowSimTime,
          world: 'both',
          kind: 'SCENARIO_CANCEL',
          message: `❌ Cancellation Burst: 10% of active unpicked orders (${cancelTargetIds.length} orders) cancelled.`,
        });
        break;
      }
    }

    return events;
  }
}
