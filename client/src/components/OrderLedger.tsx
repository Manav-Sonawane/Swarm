import React, { useState } from 'react';
import {
  CheckCircle2, XCircle, Clock, Package, Bike, Store,
  ChevronDown, ChevronUp, Search, Filter, AlertTriangle, Sparkles,
  ShoppingBag, ArrowRight, LayoutGrid, Columns
} from 'lucide-react';
import { OrderSnapshot, StoreSnapshot, RiderSnapshot } from '../types';
import { formatSimTime, formatDuration } from '../lib/format';
import { getCustomerName, getOrderItems, getRiderName } from '../lib/nameGen';

interface OrderLedgerProps {
  baselineOrders: OrderSnapshot[];
  swarmOrders: OrderSnapshot[];
  naiveOrders?: OrderSnapshot[];
  baselineStores: StoreSnapshot[];
  swarmStores: StoreSnapshot[];
  naiveStores?: StoreSnapshot[];
  baselineRiders: RiderSnapshot[];
  swarmRiders: RiderSnapshot[];
  naiveRiders?: RiderSnapshot[];
  simTime: number;
  seed: number;
  onSelectOrder?: (orderId: string, world: 'naive' | 'baseline' | 'swarm') => void;
}

export const OrderLedger: React.FC<OrderLedgerProps> = ({
  baselineOrders,
  swarmOrders,
  naiveOrders = [],
  baselineStores,
  swarmStores,
  naiveStores = [],
  baselineRiders,
  swarmRiders,
  naiveRiders = [],
  simTime,
  seed,
  onSelectOrder,
}) => {
  const [viewMode, setViewMode] = useState<'3way' | 'dual_baseline' | 'dual_naive'>('3way');
  const [filter, setFilter] = useState<'all' | 'active' | 'on_time' | 'late'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Store lookup maps
  const baselineStoreMap = new Map(baselineStores.map(s => [s.id, s.name]));
  const swarmStoreMap = new Map(swarmStores.map(s => [s.id, s.name]));
  const naiveStoreMap = new Map(naiveStores.map(s => [s.id, s.name]));
  const storeNameOf = (id?: string) => (id ? swarmStoreMap.get(id) ?? baselineStoreMap.get(id) ?? naiveStoreMap.get(id) : undefined);

  // Combine unique order IDs sorted by createdAt descending
  const allOrderIdsSet = new Set([
    ...baselineOrders.map(o => o.id),
    ...swarmOrders.map(o => o.id),
    ...naiveOrders.map(o => o.id),
  ]);

  const orderMetaMap = new Map<string, { createdAt: number; customerName: string }>();
  for (const id of allOrderIdsSet) {
    const o = swarmOrders.find(x => x.id === id) || baselineOrders.find(x => x.id === id) || naiveOrders.find(x => x.id === id);
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
    const nOrder = naiveOrders.find(o => o.id === id);

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchId = id.toLowerCase().includes(q);
      const matchName = meta?.customerName.toLowerCase().includes(q);
      if (!matchId && !matchName) return false;
    }

    if (filter === 'active') {
      const bActive = bOrder && bOrder.status !== 'delivered' && bOrder.status !== 'cancelled';
      const sActive = sOrder && sOrder.status !== 'delivered' && sOrder.status !== 'cancelled';
      const nActive = nOrder && nOrder.status !== 'delivered' && nOrder.status !== 'cancelled';
      return bActive || sActive || nActive;
    }
    if (filter === 'on_time') {
      const sOnTime = sOrder?.status === 'delivered' && !sOrder.isLate;
      const bOnTime = bOrder?.status === 'delivered' && !bOrder.isLate;
      const nOnTime = nOrder?.status === 'delivered' && !nOrder.isLate;
      return sOnTime || bOnTime || nOnTime;
    }
    if (filter === 'late') {
      const bLate = bOrder?.isLate;
      const sLate = sOrder?.isLate;
      const nLate = nOrder?.isLate;
      return bLate || sLate || nLate;
    }
    return true;
  });

  // Count summaries
  const naiveLateCount = naiveOrders.filter(o => o.isLate).length;
  const naiveDeliveredCount = naiveOrders.filter(o => o.status === 'delivered').length;
  const baselineLateCount = baselineOrders.filter(o => o.isLate).length;
  const baselineDeliveredCount = baselineOrders.filter(o => o.status === 'delivered').length;
  const swarmLateCount = swarmOrders.filter(o => o.isLate).length;
  const swarmDeliveredCount = swarmOrders.filter(o => o.status === 'delivered').length;

  return (
    <div className="glass-medium border border-white/10 rounded-2xl shadow-glass-md overflow-hidden flex flex-col transition-all duration-300">
      {/* Ledger Header */}
      <div className="p-4 sm:p-5 border-b border-white/10 glass-light flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center shadow-[0_0_12px_rgba(124,58,237,0.3)]">
            <ShoppingBag className="w-4 h-4 text-lavender-300" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-sm font-black font-mono text-white uppercase tracking-wider">
                Live Order Ledger &amp; Delivery Ticker (3 Approaches)
              </h2>
              <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-white/[0.06] text-lavender-200 border border-white/10">
                {filteredOrderIds.length} orders
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Real-time customer order lifecycle, timeline stages, and side-by-side fulfillment
            </p>
          </div>
        </div>

        {/* View mode toggle, filters, and search */}
        <div className="flex items-center space-x-2 flex-wrap gap-2">
          {/* View Mode Selector */}
          <div className="flex bg-black/40 p-1 rounded-xl border border-white/10 text-[10px] font-mono">
            <button
              onClick={() => setViewMode('3way')}
              className={`px-3 py-1 rounded-lg transition-all ${
                viewMode === '3way' ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white font-bold shadow-[0_0_10px_rgba(139,92,246,0.4)] border border-violet-400/30' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              3-Way Grid
            </button>
            <button
              onClick={() => setViewMode('dual_baseline')}
              className={`px-3 py-1 rounded-lg transition-all ${
                viewMode === 'dual_baseline' ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white font-bold shadow-[0_0_10px_rgba(139,92,246,0.4)] border border-violet-400/30' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Baseline vs Swarm
            </button>
            <button
              onClick={() => setViewMode('dual_naive')}
              className={`px-3 py-1 rounded-lg transition-all ${
                viewMode === 'dual_naive' ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white font-bold shadow-[0_0_10px_rgba(139,92,246,0.4)] border border-violet-400/30' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Naive vs Swarm
            </button>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-lavender-400/70" />
            <input
              type="text"
              placeholder="Search customer / order..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs bg-black/50 border border-white/10 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-violet-400/50 transition-all w-48 shadow-inner"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex bg-black/40 p-1 rounded-xl border border-white/10 text-[10px] font-mono">
            <button
              onClick={() => setFilter('all')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                filter === 'all' ? 'bg-white/15 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('active')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                filter === 'active' ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.2)]' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Active
            </button>
            <button
              onClick={() => setFilter('on_time')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                filter === 'on_time' ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40 shadow-[0_0_10px_rgba(6,182,212,0.2)]' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              On-Time ✓
            </button>
            <button
              onClick={() => setFilter('late')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                filter === 'late' ? 'bg-rose-500/20 text-rose-300 font-bold border border-rose-500/40 shadow-[0_0_10px_rgba(244,63,94,0.2)]' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Late ❌
            </button>
          </div>
        </div>
      </div>

      {/* Column Headers */}
      <div className={`grid ${
        viewMode === '3way' ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2'
      } divide-y md:divide-y-0 md:divide-x divide-slate-800 bg-slate-950/60 border-b border-slate-800 text-xs font-mono font-bold`}>
        {/* Naive Column Header (if 3way or dual_naive) */}
        {(viewMode === '3way' || viewMode === 'dual_naive') && (
          <div className="p-2.5 px-3 flex items-center justify-between bg-slate-950/40">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-slate-500 inline-block" />
              <span className="text-slate-400 uppercase tracking-wider text-[11px]">Naive (Any-store Rider)</span>
            </div>
            <div className="flex items-center space-x-2 text-[10px]">
              <span className="text-slate-400">Delivered: <strong className="text-slate-200">{naiveDeliveredCount}</strong></span>
              <span className="text-rose-400">Late: <strong>{naiveLateCount} ❌</strong></span>
            </div>
          </div>
        )}

        {/* Baseline Column Header (if 3way or dual_baseline) */}
        {(viewMode === '3way' || viewMode === 'dual_baseline') && (
          <div className="p-2.5 px-3 flex items-center justify-between bg-rose-950/20">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-rose-500 inline-block animate-pulse" />
              <span className="text-slate-300 uppercase tracking-wider text-[11px]">Baseline (Greedy FIFO)</span>
            </div>
            <div className="flex items-center space-x-2 text-[10px]">
              <span className="text-slate-400">Delivered: <strong className="text-slate-200">{baselineDeliveredCount}</strong></span>
              <span className="text-rose-400">Late: <strong>{baselineLateCount} ❌</strong></span>
            </div>
          </div>
        )}

        {/* Swarm Column Header */}
        <div className="p-2.5 px-3 flex items-center justify-between bg-emerald-950/20">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block shadow-[0_0_8px_#34d399]" />
            <span className="text-emerald-400 uppercase tracking-wider text-[11px]">Swarm (Rolling Engine) ★</span>
          </div>
          <div className="flex items-center space-x-2 text-[10px]">
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
            const nOrder = naiveOrders.find(o => o.id === orderId);
            const bOrder = baselineOrders.find(o => o.id === orderId);
            const sOrder = swarmOrders.find(o => o.id === orderId);
            const isExpanded = expandedId === orderId;

            return (
              <div key={orderId} className="hover:bg-slate-800/30 transition-colors">
                <div className={`grid ${
                  viewMode === '3way' ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2'
                } divide-y md:divide-y-0 md:divide-x divide-slate-800/60`}>
                  {/* Naive Cell */}
                  {(viewMode === '3way' || viewMode === 'dual_naive') && (
                    <OrderCell
                      orderId={orderId}
                      customerName={customerName}
                      order={nOrder}
                      world="naive"
                      storeName={nOrder?.storeId ? naiveStoreMap.get(nOrder.storeId) : undefined}
                      simTime={simTime}
                      isExpanded={isExpanded}
                      onToggleExpand={() => setExpandedId(isExpanded ? null : orderId)}
                      onOpenDrawer={() => onSelectOrder && onSelectOrder(orderId, 'naive')}
                    />
                  )}

                  {/* Baseline Cell */}
                  {(viewMode === '3way' || viewMode === 'dual_baseline') && (
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
                  )}

                  {/* Swarm Cell */}
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
                    nOrder={nOrder}
                    bOrder={bOrder}
                    sOrder={sOrder}
                    storeName={storeNameOf}
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
  world: 'naive' | 'baseline' | 'swarm';
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
        <span>{orderId} — outside this world's recent order window</span>
        <span className="text-slate-500">—</span>
      </div>
    );
  }

  const isDelivered = order.status === 'delivered';
  const isLate = order.isLate;

  // Lateness duration calculation
  const targetTime = order.deliveredAt || simTime;
  const latenessSec = targetTime > order.promisedBy ? Math.round(targetTime - order.promisedBy) : 0;

  let statusBadge = (
    <span className="flex items-center space-x-1 text-amber-400 bg-amber-950/60 border border-amber-600/40 px-1.5 py-0.5 rounded text-[9px] font-mono">
      <Clock className="w-2.5 h-2.5 animate-spin" />
      <span>{order.status.toUpperCase()}</span>
    </span>
  );

  if (isDelivered) {
    if (isLate) {
      statusBadge = (
        <span className="flex items-center space-x-1 text-rose-400 bg-rose-950/60 border border-rose-600/40 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold">
          <XCircle className="w-2.5 h-2.5" />
          <span>LATE (+{Math.ceil(latenessSec / 60)}m) ❌</span>
        </span>
      );
    } else {
      statusBadge = (
        <span className="flex items-center space-x-1 text-emerald-400 bg-emerald-950/60 border border-emerald-500/40 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold">
          <CheckCircle2 className="w-2.5 h-2.5" />
          <span>DELIVERED ✓</span>
        </span>
      );
    }
  } else if (isLate) {
    statusBadge = (
      <span className="flex items-center space-x-1 text-rose-400 bg-rose-950/60 border border-rose-600/40 px-1.5 py-0.5 rounded text-[9px] font-mono animate-pulse">
        <AlertTriangle className="w-2.5 h-2.5" />
        <span>AT-RISK ❌</span>
      </span>
    );
  }

  return (
    <div
      onClick={onToggleExpand}
      className={`p-2.5 cursor-pointer transition-all border-l-4 ${
        isDelivered && !isLate
          ? 'border-l-emerald-500 bg-emerald-950/10 hover:bg-emerald-950/20'
          : isLate
          ? 'border-l-rose-500 bg-rose-950/10 hover:bg-rose-950/20'
          : 'border-l-amber-500 bg-amber-950/5 hover:bg-amber-950/10'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-1.5 truncate">
          <span className="font-mono text-[11px] font-bold text-slate-200">{order.id}</span>
          <span className="text-[11px] text-slate-300 font-medium truncate">{customerName}</span>
        </div>

        <div>{statusBadge}</div>
      </div>

      {/* Compact Timeline Strip */}
      <div className="mt-1.5 flex items-center justify-between text-[10px] font-mono text-slate-400">
        <div className="flex items-center space-x-2">
          <span>Placed: <strong className="text-slate-300">{formatSimTime(order.createdAt)}</strong></span>
          {order.deliveredAt ? (
            <span>Delivered: <strong className={isLate ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>{formatSimTime(order.deliveredAt)}</strong></span>
          ) : (
            <span>ETA: <strong className={isLate ? 'text-rose-400' : 'text-slate-300'}>{formatSimTime(order.projectedEta || order.promisedBy)}</strong></span>
          )}
        </div>

        <div className="flex items-center space-x-1">
          {order.riderId && (
            <span className="flex items-center space-x-1 text-slate-400 text-[9px]">
              <Bike className="w-2.5 h-2.5 text-slate-500" />
              <span>{getRiderName(order.riderId)}</span>
            </span>
          )}
          {isExpanded ? <ChevronUp className="w-3 h-3 text-slate-400" /> : <ChevronDown className="w-3 h-3 text-slate-500" />}
        </div>
      </div>
    </div>
  );
};

// ─── Expanded Comparison Card ───────────────────────────────────────────────
interface ExpandedOrderCardProps {
  orderId: string;
  customerName: string;
  nOrder?: OrderSnapshot;
  bOrder?: OrderSnapshot;
  sOrder?: OrderSnapshot;
  storeName: (id?: string) => string | undefined;
  simTime: number;
  seed: number;
}

const ExpandedOrderCard: React.FC<ExpandedOrderCardProps> = ({
  orderId,
  customerName,
  nOrder,
  bOrder,
  sOrder,
  storeName,
  simTime,
  seed,
}) => {
  const items = getOrderItems(orderId, (sOrder ?? bOrder ?? nOrder)?.items);
  const basketTotal = items.reduce((sum, item) => sum + item.price, 0);

  return (
    <div className="p-4 bg-slate-950 border-t border-b border-slate-800 text-xs space-y-4">
      {/* Customer & Basket Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 rounded-xl p-3">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 font-black font-mono text-sm">
            {customerName.split(' ').map(n => n[0]).join('')}
          </div>
          <div>
            <h4 className="font-bold text-slate-100 text-sm">{customerName}</h4>
            <span className="text-[10px] text-slate-400 font-mono">
              Order ID: {orderId} • Mumbai Quick-Commerce Stream
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

      {/* 3-way lifecycle: every time below is a real event from that world's simulation */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <LifecycleCard world="naive" order={nOrder} storeName={storeName} simTime={simTime} />
        <LifecycleCard world="baseline" order={bOrder} storeName={storeName} simTime={simTime} />
        <LifecycleCard world="swarm" order={sOrder} storeName={storeName} simTime={simTime} />
      </div>
    </div>
  );
};

// ─── Lifecycle card (one world's view of one order) ─────────────────────────
const WORLD_CARD = {
  naive: { title: '1. Naive (Nearest Rider)', box: 'border-slate-800', titleCls: 'text-slate-400' },
  baseline: { title: '2. Baseline (Greedy FIFO)', box: 'border-rose-900/40', titleCls: 'text-rose-400' },
  swarm: { title: '3. Swarm Engine', box: 'border-emerald-900/40', titleCls: 'text-emerald-400' },
} as const;

interface LifecycleCardProps {
  world: 'naive' | 'baseline' | 'swarm';
  order?: OrderSnapshot;
  storeName: (id?: string) => string | undefined;
  simTime: number;
}

export const LifecycleCard: React.FC<LifecycleCardProps> = ({ world, order, storeName }) => {
  const cfg = WORLD_CARD[world];
  const batched = (order?.tripSize ?? 1) > 1;
  const tag =
    world === 'naive'
      ? "Any store's rider"
      : world === 'baseline'
      ? 'Solo trips'
      : order?.tripSize === undefined
      ? 'Rider-optimised'
      : batched
      ? `Batched ×${order.tripSize}`
      : 'Solo trip';

  const serving = order ? storeName(order.servingStoreId ?? order.storeId) : undefined;
  const riderHome = order ? storeName(order.riderHomeStoreId) : undefined;
  const fromElsewhere =
    !!order?.riderId && !!order.riderHomeStoreId && order.riderHomeStoreId !== (order.servingStoreId ?? order.storeId);
  const lateSec = order?.deliveredAt !== undefined ? order.deliveredAt - order.promisedBy : 0;
  const deliveredLate = order?.deliveredAt !== undefined && lateSec > 0;

  return (
    <div className={`bg-slate-900/60 border ${cfg.box} rounded-xl p-3 space-y-2`}>
      <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
        <span className={`font-mono font-bold text-[10px] uppercase flex items-center space-x-1 ${cfg.titleCls}`}>
          {world === 'swarm' && <Sparkles className="w-3 h-3" />}
          <span>{cfg.title}</span>
        </span>
        <span className="text-[9px] text-slate-500 font-mono">{tag}</span>
      </div>

      {order ? (
        <div className="space-y-1.5 text-[10px] font-mono">
          <div className="text-slate-300">
            <span className="text-slate-500 block">Serving store:</span>
            <strong>{serving ?? '—'}</strong>
          </div>
          <div className="text-slate-300">
            <span className="text-slate-500 block">Rider:</span>
            <strong>{order.riderId ? getRiderName(order.riderId) : 'Waiting for a rider'}</strong>
            {fromElsewhere && <span className="text-amber-400"> · rode in from {riderHome ?? 'another store'}</span>}
          </div>
          <div className="pt-1 border-t border-slate-800/60 space-y-0.5">
            <div>
              {formatSimTime(order.createdAt)} → Placed{' '}
              <span className="text-slate-500">
                (promised {Math.round((order.promisedBy - order.createdAt) / 60)} min, by {formatSimTime(order.promisedBy)})
              </span>
            </div>
            {order.assignedAt !== undefined && (
              <div>
                {formatSimTime(order.assignedAt)} → Rider assigned{' '}
                <span className="text-slate-500">(waited {formatDuration(order.assignedAt - order.createdAt)})</span>
              </div>
            )}
            {order.packedAt !== undefined && <div>{formatSimTime(order.packedAt)} → Packed</div>}
            {order.pickedAt !== undefined && (
              <div>
                {formatSimTime(order.pickedAt)} → Picked up
                {batched && <span className="text-teal-300"> · trip of {order.tripSize} orders</span>}
              </div>
            )}
            {order.deliveredAt !== undefined ? (
              <div className={deliveredLate ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>
                {formatSimTime(order.deliveredAt)} →{' '}
                {deliveredLate
                  ? `Delivered Late ❌ (+${Math.ceil(lateSec / 60)}m)`
                  : `Delivered on time ✓ (${formatDuration(-lateSec)} early)`}
              </div>
            ) : (
              <div className={order.isLate ? 'text-rose-400' : 'text-amber-400'}>
                In transit → ETA {formatSimTime(order.projectedEta || order.promisedBy)}
                {order.isLate ? ' (running late)' : ''}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="text-slate-500 text-[11px] italic py-2">Not in this world's recent order window.</div>
      )}
    </div>
  );
};
