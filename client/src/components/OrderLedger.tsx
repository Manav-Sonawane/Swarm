import React, { useState } from 'react';
import {
  CheckCircle2, XCircle, Clock, Package, Bike, Store,
  ChevronDown, ChevronUp, Search, Filter, AlertTriangle, Sparkles,
  ShoppingBag, ArrowRight
} from 'lucide-react';
import { OrderSnapshot, StoreSnapshot, RiderSnapshot } from '../types';
import { formatSimTime, formatDuration } from '../lib/format';
import { getCustomerName, getOrderItems, getRiderName } from '../lib/nameGen';

interface OrderLedgerProps {
  baselineOrders: OrderSnapshot[];
  swarmOrders: OrderSnapshot[];
  baselineStores: StoreSnapshot[];
  swarmStores: StoreSnapshot[];
  baselineRiders: RiderSnapshot[];
  swarmRiders: RiderSnapshot[];
  simTime: number;
  seed: number;
  onSelectOrder?: (orderId: string, world: 'baseline' | 'swarm') => void;
}

export const OrderLedger: React.FC<OrderLedgerProps> = ({
  baselineOrders,
  swarmOrders,
  baselineStores,
  swarmStores,
  baselineRiders,
  swarmRiders,
  simTime,
  seed,
  onSelectOrder,
}) => {
  const [filter, setFilter] = useState<'all' | 'active' | 'on_time' | 'late'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Store lookup maps
  const baselineStoreMap = new Map(baselineStores.map(s => [s.id, s.name]));
  const swarmStoreMap = new Map(swarmStores.map(s => [s.id, s.name]));

  // Combine unique order IDs sorted by createdAt descending
  const allOrderIdsSet = new Set([
    ...baselineOrders.map(o => o.id),
    ...swarmOrders.map(o => o.id),
  ]);

  const orderMetaMap = new Map<string, { createdAt: number; customerName: string }>();
  for (const id of allOrderIdsSet) {
    const o = swarmOrders.find(x => x.id === id) || baselineOrders.find(x => x.id === id);
    if (o) {
      orderMetaMap.set(id, {
        createdAt: o.createdAt,
        customerName: getCustomerName(id, seed),
      });
    }
  }

  const sortedOrderIds = Array.from(allOrderIdsSet).sort((a, b) => {
    const timeA = orderMetaMap.get(a)?.createdAt || 0;
    const timeB = orderMetaMap.get(b)?.createdAt || 0;
    return timeB - timeA;
  });

  // Filter order IDs
  const filteredOrderIds = sortedOrderIds.filter(id => {
    const meta = orderMetaMap.get(id);
    const bOrder = baselineOrders.find(o => o.id === id);
    const sOrder = swarmOrders.find(o => o.id === id);

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchId = id.toLowerCase().includes(q);
      const matchName = meta?.customerName.toLowerCase().includes(q);
      if (!matchId && !matchName) return false;
    }

    if (filter === 'active') {
      const bActive = bOrder && bOrder.status !== 'delivered' && bOrder.status !== 'cancelled';
      const sActive = sOrder && sOrder.status !== 'delivered' && sOrder.status !== 'cancelled';
      return bActive || sActive;
    }
    if (filter === 'on_time') {
      const sOnTime = sOrder?.status === 'delivered' && !sOrder.isLate;
      const bOnTime = bOrder?.status === 'delivered' && !bOrder.isLate;
      return sOnTime || bOnTime;
    }
    if (filter === 'late') {
      const bLate = bOrder?.isLate;
      const sLate = sOrder?.isLate;
      return bLate || sLate;
    }
    return true;
  });

  // Count summaries
  const baselineLateCount = baselineOrders.filter(o => o.isLate).length;
  const swarmLateCount = swarmOrders.filter(o => o.isLate).length;
  const baselineDeliveredCount = baselineOrders.filter(o => o.status === 'delivered').length;
  const swarmDeliveredCount = swarmOrders.filter(o => o.status === 'delivered').length;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl overflow-hidden flex flex-col">
      {/* Ledger Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-950/80 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
            <ShoppingBag className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-sm font-black font-mono text-white uppercase tracking-wider">
                Live Order Ledger & Delivery Ticker
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                {filteredOrderIds.length} orders
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Side-by-side real-time customer order lifecycle and fulfillment timeline
            </p>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="flex items-center space-x-2 flex-wrap gap-2">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search customer / order..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all w-48"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-[11px] font-mono">
            <button
              onClick={() => setFilter('all')}
              className={`px-2.5 py-1 rounded transition-all ${
                filter === 'all' ? 'bg-slate-800 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('active')}
              className={`px-2.5 py-1 rounded transition-all ${
                filter === 'active' ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Active In-Flight
            </button>
            <button
              onClick={() => setFilter('on_time')}
              className={`px-2.5 py-1 rounded transition-all ${
                filter === 'on_time' ? 'bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              On-Time ✓
            </button>
            <button
              onClick={() => setFilter('late')}
              className={`px-2.5 py-1 rounded transition-all ${
                filter === 'late' ? 'bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Late ❌
            </button>
          </div>
        </div>
      </div>

      {/* Side-by-Side Column Headers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-800 bg-slate-950/60 border-b border-slate-800 text-xs font-mono font-bold">
        {/* Baseline Column Header */}
        <div className="p-2.5 px-4 flex items-center justify-between bg-rose-950/20">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-rose-500 inline-block animate-pulse" />
            <span className="text-slate-300 uppercase tracking-wider">Baseline (Greedy FIFO)</span>
          </div>
          <div className="flex items-center space-x-3 text-[10px]">
            <span className="text-slate-400">Delivered: <strong className="text-slate-200">{baselineDeliveredCount}</strong></span>
            <span className="text-rose-400">Late: <strong>{baselineLateCount} ❌</strong></span>
          </div>
        </div>

        {/* Swarm Column Header */}
        <div className="p-2.5 px-4 flex items-center justify-between bg-emerald-950/20">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block shadow-[0_0_8px_#34d399]" />
            <span className="text-emerald-400 uppercase tracking-wider">Swarm (Rolling-Horizon) ★</span>
          </div>
          <div className="flex items-center space-x-3 text-[10px]">
            <span className="text-slate-400">Delivered: <strong className="text-emerald-400">{swarmDeliveredCount}</strong></span>
            <span className={swarmLateCount === 0 ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
              Late: <strong>{swarmLateCount} {swarmLateCount === 0 ? '✓' : '⚠️'}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Orders List Stream */}
      <div className="divide-y divide-slate-800/60 max-h-[460px] overflow-y-auto">
        {filteredOrderIds.length === 0 ? (
          <div className="p-8 text-center text-slate-500 font-mono text-xs">
            No matching customer orders found in stream.
          </div>
        ) : (
          filteredOrderIds.map(orderId => {
            const customerName = orderMetaMap.get(orderId)?.customerName || getCustomerName(orderId, seed);
            const bOrder = baselineOrders.find(o => o.id === orderId);
            const sOrder = swarmOrders.find(o => o.id === orderId);
            const isExpanded = expandedId === orderId;

            return (
              <div key={orderId} className="hover:bg-slate-800/30 transition-colors">
                <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-800/60">
                  {/* Left: Baseline Order Cell */}
                  <OrderCell
                    orderId={orderId}
                    customerName={customerName}
                    order={bOrder}
                    world="baseline"
                    storeName={bOrder?.storeId ? baselineStoreMap.get(bOrder.storeId) : undefined}
                    simTime={simTime}
                    isExpanded={isExpanded}
                    onToggleExpand={() => setExpandedId(isExpanded ? null : orderId)}
                    onOpenDrawer={() => onSelectOrder && onSelectOrder(orderId, 'baseline')}
                  />

                  {/* Right: Swarm Order Cell */}
                  <OrderCell
                    orderId={orderId}
                    customerName={customerName}
                    order={sOrder}
                    world="swarm"
                    storeName={sOrder?.storeId ? swarmStoreMap.get(sOrder.storeId) : undefined}
                    simTime={simTime}
                    isExpanded={isExpanded}
                    onToggleExpand={() => setExpandedId(isExpanded ? null : orderId)}
                    onOpenDrawer={() => onSelectOrder && onSelectOrder(orderId, 'swarm')}
                  />
                </div>

                {/* Expanded Detailed Accordion Card */}
                {isExpanded && (
                  <ExpandedOrderCard
                    orderId={orderId}
                    customerName={customerName}
                    bOrder={bOrder}
                    sOrder={sOrder}
                    baselineStoreName={bOrder?.storeId ? baselineStoreMap.get(bOrder.storeId) : undefined}
                    swarmStoreName={sOrder?.storeId ? swarmStoreMap.get(sOrder.storeId) : undefined}
                    simTime={simTime}
                    seed={seed}
                  />
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

// ─── Individual Order Cell ──────────────────────────────────────────────────
interface OrderCellProps {
  orderId: string;
  customerName: string;
  order?: OrderSnapshot;
  world: 'baseline' | 'swarm';
  storeName?: string;
  simTime: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onOpenDrawer: () => void;
}

const OrderCell: React.FC<OrderCellProps> = ({
  orderId,
  customerName,
  order,
  world,
  storeName,
  simTime,
  isExpanded,
  onToggleExpand,
  onOpenDrawer,
}) => {
  if (!order) {
    return (
      <div className="p-3 text-slate-600 font-mono text-[11px] italic flex items-center justify-between">
        <span>{orderId} — Not accepted / out of inventory</span>
        <span className="text-rose-500 font-bold">❌ Stockout</span>
      </div>
    );
  }

  const isDelivered = order.status === 'delivered';
  const isLate = order.isLate;
  const isPacking = order.status === 'packing' || order.status === 'assigned';
  const isDelivering = order.status === 'picked';

  // Lateness duration calculation
  const targetTime = order.deliveredAt || simTime;
  const latenessSec = targetTime > order.promisedBy ? Math.round(targetTime - order.promisedBy) : 0;

  // Status icon & styling
  let statusBadge = (
    <span className="flex items-center space-x-1 text-amber-400 bg-amber-950/60 border border-amber-600/40 px-2 py-0.5 rounded text-[10px] font-mono">
      <Clock className="w-3 h-3 animate-spin" />
      <span>{order.status.toUpperCase()}</span>
    </span>
  );

  if (isDelivered) {
    if (isLate) {
      statusBadge = (
        <span className="flex items-center space-x-1 text-rose-400 bg-rose-950/60 border border-rose-600/40 px-2 py-0.5 rounded text-[10px] font-mono font-bold">
          <XCircle className="w-3 h-3" />
          <span>LATE (+{Math.ceil(latenessSec / 60)}m) ❌</span>
        </span>
      );
    } else {
      statusBadge = (
        <span className="flex items-center space-x-1 text-emerald-400 bg-emerald-950/60 border border-emerald-500/40 px-2 py-0.5 rounded text-[10px] font-mono font-bold">
          <CheckCircle2 className="w-3 h-3" />
          <span>DELIVERED ON-TIME ✓</span>
        </span>
      );
    }
  } else if (isLate) {
    statusBadge = (
      <span className="flex items-center space-x-1 text-rose-400 bg-rose-950/60 border border-rose-600/40 px-2 py-0.5 rounded text-[10px] font-mono animate-pulse">
        <AlertTriangle className="w-3 h-3" />
        <span>AT-RISK LATE ❌</span>
      </span>
    );
  }

  return (
    <div
      onClick={onToggleExpand}
      className={`p-3 cursor-pointer transition-all border-l-4 ${
        isDelivered && !isLate
          ? 'border-l-emerald-500 bg-emerald-950/10 hover:bg-emerald-950/20'
          : isLate
          ? 'border-l-rose-500 bg-rose-950/10 hover:bg-rose-950/20'
          : 'border-l-amber-500 bg-amber-950/5 hover:bg-amber-950/10'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="font-mono text-xs font-bold text-slate-200">{order.id}</span>
          <span className="text-xs text-slate-300 font-medium">{customerName}</span>
          <span className={`text-[9px] font-mono uppercase px-1.5 py-0.2 rounded border ${
            order.priority === 'express' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-slate-800 text-slate-400 border-slate-700'
          }`}>
            {order.priority}
          </span>
        </div>

        <div>{statusBadge}</div>
      </div>

      {/* Compact Timeline Strip */}
      <div className="mt-2 flex items-center justify-between text-[10px] font-mono text-slate-400">
        <div className="flex items-center space-x-3">
          <span>Placed: <strong className="text-slate-300">{formatSimTime(order.createdAt)}</strong></span>
          <span>Promised: <strong className={isLate ? 'text-rose-400' : 'text-slate-300'}>{formatSimTime(order.promisedBy)}</strong></span>
          {order.deliveredAt && (
            <span>Delivered: <strong className={isLate ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>{formatSimTime(order.deliveredAt)}</strong></span>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {order.riderId && (
            <span className="flex items-center space-x-1 text-slate-400">
              <Bike className="w-3 h-3 text-slate-500" />
              <span>{getRiderName(order.riderId)}</span>
            </span>
          )}
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />}
        </div>
      </div>
    </div>
  );
};

// ─── Expanded Comparison Card ───────────────────────────────────────────────
interface ExpandedOrderCardProps {
  orderId: string;
  customerName: string;
  bOrder?: OrderSnapshot;
  sOrder?: OrderSnapshot;
  baselineStoreName?: string;
  swarmStoreName?: string;
  simTime: number;
  seed: number;
}

const ExpandedOrderCard: React.FC<ExpandedOrderCardProps> = ({
  orderId,
  customerName,
  bOrder,
  sOrder,
  baselineStoreName,
  swarmStoreName,
  simTime,
  seed,
}) => {
  const items = getOrderItems(orderId);
  const basketTotal = items.reduce((sum, item) => sum + item.price, 0);

  return (
    <div className="p-4 bg-slate-950 border-t border-b border-slate-800 text-xs space-y-4">
      {/* Customer & Basket Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 rounded-xl p-3">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 font-black font-mono text-sm">
            {customerName.split(' ').map(n => n[0]).join('')}
          </div>
          <div>
            <h4 className="font-bold text-slate-100 text-sm">{customerName}</h4>
            <span className="text-[11px] text-slate-400 font-mono">
              Customer ID: {orderId.replace('ord-', 'CUST-')} • Mumbai Delivery Zone
            </span>
          </div>
        </div>

        {/* Cart items */}
        <div className="flex items-center space-x-2 text-[11px] font-mono">
          <div className="bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-lg">
            <span className="text-slate-400">Basket: </span>
            <span className="text-slate-200 font-semibold">{items.map(i => `${i.name} (${i.qty})`).join(', ')}</span>
            <span className="text-emerald-400 ml-2 font-bold">₹{basketTotal}</span>
          </div>
        </div>
      </div>

      {/* Side-by-side Timeline and Allocation Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Baseline World Details */}
        <div className="bg-slate-900/60 border border-rose-900/40 rounded-xl p-3.5 space-y-2.5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="font-mono font-bold text-rose-400 text-[11px] uppercase flex items-center space-x-1.5">
              <span>Baseline Greedy FIFO</span>
            </span>
            <span className="text-[10px] text-slate-400 font-mono">Solo Rider Dispatch</span>
          </div>

          {bOrder ? (
            <div className="space-y-2 text-[11px]">
              <div className="grid grid-cols-2 gap-2 text-slate-300">
                <div>
                  <span className="text-slate-500 block text-[10px]">Fulfillment Store</span>
                  <strong>{baselineStoreName || bOrder.storeId || 'None'}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Assigned Courier</span>
                  <strong>{bOrder.riderId ? getRiderName(bOrder.riderId) : 'Unassigned'}</strong>
                </div>
              </div>

              {/* Vertical Stepper Timeline */}
              <div className="space-y-1 pt-2 border-t border-slate-800/80 font-mono text-[10px]">
                <div className="flex items-center space-x-2 text-slate-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                  <span>{formatSimTime(bOrder.createdAt)} → Order Placed</span>
                </div>
                <div className="flex items-center space-x-2 text-slate-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  <span>{formatSimTime(bOrder.createdAt + 120)} → Dark Store Packing</span>
                </div>
                {bOrder.deliveredAt ? (
                  <div className={`flex items-center space-x-2 font-bold ${bOrder.isLate ? 'text-rose-400' : 'text-emerald-400'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${bOrder.isLate ? 'bg-rose-500' : 'bg-emerald-400'}`} />
                    <span>{formatSimTime(bOrder.deliveredAt)} → Delivered {bOrder.isLate ? `(LATE by ${Math.ceil((bOrder.deliveredAt - bOrder.promisedBy) / 60)} min ❌)` : '(ON-TIME ✓)'}</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2 text-amber-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    <span>In-Transit → Projected ETA {formatSimTime(bOrder.projectedEta || bOrder.promisedBy)}</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-rose-400 text-xs italic py-2">
              Failed: Dark store stock-out. Baseline could not fulfill order.
            </div>
          )}
        </div>

        {/* Swarm World Details */}
        <div className="bg-slate-900/60 border border-emerald-900/40 rounded-xl p-3.5 space-y-2.5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="font-mono font-bold text-emerald-400 text-[11px] uppercase flex items-center space-x-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Swarm Coupled Engine ★</span>
            </span>
            <span className="text-[10px] text-emerald-400 font-mono bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              Feasibility Honesty + Batching
            </span>
          </div>

          {sOrder ? (
            <div className="space-y-2 text-[11px]">
              <div className="grid grid-cols-2 gap-2 text-slate-300">
                <div>
                  <span className="text-slate-500 block text-[10px]">Optimal Dark Store</span>
                  <strong className="text-emerald-300">{swarmStoreName || sOrder.storeId || 'None'}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Coupled Rider & Route</span>
                  <strong className="text-emerald-300">{sOrder.riderId ? getRiderName(sOrder.riderId) : 'Unassigned'}</strong>
                </div>
              </div>

              {/* Vertical Stepper Timeline */}
              <div className="space-y-1 pt-2 border-t border-slate-800/80 font-mono text-[10px]">
                <div className="flex items-center space-x-2 text-slate-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                  <span>{formatSimTime(sOrder.createdAt)} → Placed & Feasibility Checked</span>
                </div>
                <div className="flex items-center space-x-2 text-slate-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>{formatSimTime(sOrder.createdAt + 60)} → Parallel Pack Slot Dispatched</span>
                </div>
                {sOrder.deliveredAt ? (
                  <div className="flex items-center space-x-2 text-emerald-400 font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span>{formatSimTime(sOrder.deliveredAt)} → Delivered (ON-TIME ✓)</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2 text-emerald-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>In-Transit → Projected ETA {formatSimTime(sOrder.projectedEta || sOrder.promisedBy)}</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-slate-400 text-xs italic py-2">
              Pending allocation...
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
