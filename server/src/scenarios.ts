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
        [worldA, worldB].forEach(world => {
          const activeRiders = world.riders.filter(r => r.status !== 'offline');
          // Pick 3 random riders
          const countToOffline = Math.min(3, activeRiders.length);
          for (let i = 0; i < countToOffline; i++) {
            const rIdx = Math.floor(Math.random() * activeRiders.length);
            const rider = activeRiders.splice(rIdx, 1)[0];
            rider.status = 'offline';

            // Release unpicked orders back to pool
            const unpickedIds = rider.assignedOrderIds.filter(id => {
              const o = world.ordersMap.get(id);
              return o && o.status !== 'picked' && o.status !== 'delivered' && o.status !== 'cancelled';
            });

            for (const uId of unpickedIds) {
              const ord = world.ordersMap.get(uId);
              if (ord) {
                ord.status = 'placed';
                ord.riderId = undefined;
                ord.storeId = undefined;
                ord.holdUntil = undefined;
              }
            }

            rider.assignedOrderIds = rider.assignedOrderIds.filter(id => !unpickedIds.includes(id));
            rider.route = [];
          }
        });

        events.push({
          simTime: nowSimTime,
          world: 'both',
          kind: 'SCENARIO_RIDERS_OFFLINE',
          message: '🛵 Disruption: 3 riders went offline mid-shift! Unpicked orders released back to pool for re-optimization.',
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
        let cancelCount = 0;
        [worldA, worldB].forEach(world => {
          const unpickedOrders = Array.from(world.ordersMap.values()).filter(
            o => o.status === 'placed' || o.status === 'assigned' || o.status === 'packing' || o.status === 'packed'
          );
          const numToCancel = Math.max(1, Math.floor(unpickedOrders.length * 0.1));
          for (let i = 0; i < numToCancel; i++) {
            const target = unpickedOrders[i];
            if (target) {
              target.status = 'cancelled';
              cancelCount++;
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
          message: `❌ Cancellation Burst: 10% of active unpicked orders (${cancelCount} orders) cancelled.`,
        });
        break;
      }
    }

    return events;
  }
}
