import { DarkStore, Rider, Order, Assignment, DecisionRecord, CandidateScore } from '../types';
import { CONFIG } from '../config';
import { selectCandidateStores } from '../sim/store-select';
import { evaluateInsertion, calculateSoloTripCost } from './insertion';
import { travelTimeSec } from '../sim/travel';

export function runSwarmAllocation(
  pendingOrders: Order[],
  riders: Rider[],
  stores: DarkStore[],
  existingOrdersMap: Map<string, Order>,
  nowSimTime: number,
  weatherMult: number = 1.0
): Assignment[] {
  const assignments: Assignment[] = [];

  // Filter eligible riders: not offline, below capacity, and not already en route delivering
  const eligibleRidersMap = new Map<string, Rider>();
  riders.forEach(r => {
    if (r.status !== 'offline' && r.assignedOrderIds.length < r.capacity) {
      if (r.assignedOrderIds.length === 0 || r.status === 'idle' || r.status === 'to_store' || r.status === 'at_store') {
        // Clone rider state so we can mutate temporary trip/assigned orders during greedy assignment
        eligibleRidersMap.set(r.id, JSON.parse(JSON.stringify(r)));
      }
    }
  });

  // Calculate slack and store candidates for each order
  interface OrderEvalContext {
    order: Order;
    slack: number;
    bestStoreEta: number;
    candidates: CandidateScore[];
    regret: number; // secondBestCost - bestCost
    isAtRisk: boolean;
  }

  const evalContexts: OrderEvalContext[] = [];

  for (const order of pendingOrders) {
    // Check delayed commitment hold: if order is currently held and hasn't expired hold
    if (order.holdUntil && nowSimTime < order.holdUntil) {
      continue;
    }

    const candidateStores = selectCandidateStores(order, stores, nowSimTime, weatherMult);
    if (candidateStores.length === 0) continue;

    const bestStoreLegSec = candidateStores[0].travelSec;
    const bestStoreEta = nowSimTime + bestStoreLegSec;
    const slack = order.promisedBy - bestStoreEta;

    const candidates: CandidateScore[] = [];

    // Evaluate all eligible riders against candidate stores
    eligibleRidersMap.forEach(rider => {
      for (const cs of candidateStores) {
        const candidateScore = evaluateInsertion(order, rider, cs.store, existingOrdersMap, nowSimTime, weatherMult);
        if (candidateScore) {
          candidates.push(candidateScore);
        }
      }
    });

    if (candidates.length === 0) continue;

    // Separate feasible and infeasible candidates
    const feasibleCandidates = candidates.filter(c => c.feasible);
    feasibleCandidates.sort((a, b) => a.totalCost - b.totalCost);

    let chosenCandidatesList = feasibleCandidates;
    let isAtRisk = false;

    if (feasibleCandidates.length === 0) {
      // Infeasible order: pick minimum lateness / lowest total cost candidate
      candidates.sort((a, b) => a.totalCost - b.totalCost);
      chosenCandidatesList = candidates;
      isAtRisk = true;
    }

    const bestCost = chosenCandidatesList[0].totalCost;
    const secondBestCost = chosenCandidatesList.length > 1 ? chosenCandidatesList[1].totalCost : bestCost + 100;
    const regret = secondBestCost - bestCost;

    evalContexts.push({
      order,
      slack,
      bestStoreEta,
      candidates: chosenCandidatesList,
      regret,
      isAtRisk,
    });
  }

  // Sort orders: At-risk / lowest slack first, break ties by highest regret
  evalContexts.sort((a, b) => {
    if (a.isAtRisk !== b.isAtRisk) {
      return a.isAtRisk ? -1 : 1;
    }
    if (Math.abs(a.slack - b.slack) > 15) {
      return a.slack - b.slack;
    }
    return b.regret - a.regret;
  });

  // Assign iteratively
  for (const ctx of evalContexts) {
    const order = ctx.order;
    // Re-evaluate candidates with updated rider states
    const updatedCandidates: CandidateScore[] = [];

    eligibleRidersMap.forEach(rider => {
      // Candidate stores for order
      const candidateStores = selectCandidateStores(order, stores, nowSimTime, weatherMult);
      for (const cs of candidateStores) {
        const score = evaluateInsertion(order, rider, cs.store, existingOrdersMap, nowSimTime, weatherMult);
        if (score) {
          updatedCandidates.push(score);
        }
      }
    });

    if (updatedCandidates.length === 0) continue;

    const feasible = updatedCandidates.filter(c => c.feasible);
    feasible.sort((a, b) => a.totalCost - b.totalCost);

    let chosenList = feasible;
    let orderMarkedLate = false;

    if (feasible.length === 0) {
      updatedCandidates.sort((a, b) => a.totalCost - b.totalCost);
      chosenList = updatedCandidates;
      orderMarkedLate = true;
    }

    const best = chosenList[0];
    const targetRider = eligibleRidersMap.get(best.riderId);
    if (!targetRider) continue;

    // Check Delayed Commitment Rule (CONTEXT §6 step 6)
    // If best option is a solo trip (rider had 0 assigned orders), slack > HOLD_SLACK (240s),
    // and age = now - createdAt < MAX_HOLD (60s), hold order for 1 epoch to look for batch partner!
    const isSoloTrip = targetRider.assignedOrderIds.length === 0;
    const orderAgeSec = nowSimTime - order.createdAt;

    if (isSoloTrip && ctx.slack > CONFIG.HOLD_SLACK && orderAgeSec < CONFIG.MAX_HOLD && !orderMarkedLate) {
      // Mark order held until next epoch
      order.holdUntil = nowSimTime + CONFIG.EPOCH;
      continue;
    }

    // Prepare Decision Record
    const runnersUp = chosenList.slice(1, 3);
    const chosenStoreObj = stores.find(s => s.id === best.storeId);
    const storeName = chosenStoreObj ? chosenStoreObj.name : best.storeId;

    let reasonStr = `Swarm Allocator: Assigned to ${best.riderId} from ${storeName}. `;
    if (best.breakdown.batchSavingSec > 0) {
      reasonStr += `Batched trip saves ${Math.round(best.breakdown.batchSavingSec)}s travel vs solo. `;
    } else {
      reasonStr += `Optimized solo insertion. `;
    }
    if (orderMarkedLate) {
      reasonStr += `[AT RISK: Minimum projected lateness route]`;
    } else {
      reasonStr += `Slack: ${Math.round(ctx.slack)}s.`;
    }

    const decision: DecisionRecord = {
      decidedAt: nowSimTime,
      chosen: best,
      runnersUp,
      reason: reasonStr,
    };

    assignments.push({
      orderId: order.id,
      storeId: best.storeId,
      riderId: best.riderId,
      decision,
      newRoute: best.tripStops || [],
    });

    // Update temporary state for the assigned rider in eligibleRidersMap
    targetRider.assignedOrderIds.push(order.id);
    if (best.tripStops) {
      targetRider.route = best.tripStops;
    }
  }

  return assignments;
}
