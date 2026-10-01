import React from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup, CircleMarker } from 'react-leaflet';
import L from 'leaflet';
import { WorldSnapshot, OrderSnapshot } from '../types';

interface MapViewProps {
  title: string;
  badge: string;
  badgeColor: string;
  worldData: WorldSnapshot;
  onSelectOrder: (orderId: string) => void;
  selectedOrderId?: string;
}

const MUMBAI_CENTER: [number, number] = [19.0760, 72.8777];

export const MapView: React.FC<MapViewProps> = ({
  title,
  badge,
  badgeColor,
  worldData,
  onSelectOrder,
  selectedOrderId,
}) => {
  // Custom Leaflet DivIcons
  const createStoreIcon = (queue: number, name: string, offline: boolean = false) => {
    return L.divIcon({
      className: 'custom-store-icon',
      html: `
        <div class="relative flex items-center justify-center">
          <div class="w-8 h-8 rounded-lg ${offline ? 'bg-slate-700 border-rose-400 opacity-60' : 'bg-indigo-600 border-indigo-300'} border-2 flex items-center justify-center shadow-lg text-white font-bold text-xs">
            ${offline ? '⛔' : '🏬'}
          </div>
          ${
            queue > 0
              ? `<span class="absolute -top-2 -right-2 bg-amber-500 text-black font-extrabold text-[10px] w-5 h-5 rounded-full flex items-center justify-center border border-black shadow">
                  ${queue}
                </span>`
              : ''
          }
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });
  };

  const createRiderIcon = (status: string, load: number) => {
    let colorClass = 'bg-slate-500 border-slate-300';
    if (status === 'delivering') colorClass = 'bg-emerald-500 border-emerald-200 shadow-emerald-500/50';
    else if (status === 'to_store' || status === 'at_store') colorClass = 'bg-amber-500 border-amber-200';
    else if (status === 'returning') colorClass = 'bg-sky-500 border-sky-200';
    else if (status === 'offline') colorClass = 'bg-red-600 border-red-300 opacity-60';

    return L.divIcon({
      className: 'custom-rider-icon',
      html: `
        <div class="relative flex items-center justify-center">
          <div class="w-7 h-7 rounded-full ${colorClass} border-2 flex items-center justify-center text-white text-xs font-bold shadow-md">
            🛵
          </div>
          ${
            load > 0
              ? `<span class="absolute -bottom-1 -right-1 bg-black text-emerald-400 font-bold text-[9px] px-1 rounded border border-emerald-500/40">
                  ${load}
                </span>`
              : ''
          }
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
  };

  return (
    <div className="flex flex-col h-full glass-medium border border-white/10 rounded-2xl overflow-hidden shadow-glass-md dark-map transition-all duration-300">
      {/* Map Header */}
      <div className="glass-light px-5 py-3 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <h2 className="text-[0.82rem] font-bold text-white tracking-[-0.01em] leading-tight"
              style={{ fontFamily: 'var(--font-primary)' }}>{title}</h2>
          <span className={`text-[9px] font-bold font-mono px-2 py-0.5 rounded-full border uppercase tracking-wider shadow-sm ${badgeColor}`}>
            {badge}
          </span>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-slate-400 font-mono">
          <span>Riders: <strong className="text-white">{worldData.riders.length}</strong></span>
          <span>Orders: <strong className="text-white">{worldData.orders.length}</strong></span>
        </div>
      </div>

      {/* Leaflet Container */}
      <div className="relative flex-1 min-h-[360px] w-full">
        <MapContainer
          center={MUMBAI_CENTER}
          zoom={11}
          scrollWheelZoom={true}
          style={{ width: '100%', height: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Dark Stores */}
          {worldData.stores.map((store) => (
            <Marker
              key={store.id}
              position={[store.lat, store.lng]}
              icon={createStoreIcon(store.queue, store.name, !!store.offline)}
            >
              <Popup>
                <div className="text-xs font-sans text-slate-900">
                  <strong className="block text-sm">{store.name}</strong>
                  <div>Packing Queue: {store.queue} orders</div>
                  {store.offline && <div className="text-rose-600 font-bold">OFFLINE: its orders are re-served from the next-nearest store</div>}
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Riders & Route Lines */}
          {worldData.riders.map((rider) => (
            <React.Fragment key={rider.id}>
              <Marker
                position={[rider.lat, rider.lng]}
                icon={createRiderIcon(rider.status, rider.load)}
              >
                <Popup>
                  <div className="text-xs font-sans text-slate-900">
                    <strong className="block text-sm">Rider {rider.id}</strong>
                    <div>Status: <span className="uppercase font-semibold">{rider.status}</span></div>
                    <div>Active Load: {rider.load} / 3 orders</div>
                    <div>Dark store: {worldData.stores.find(s => s.id === rider.homeStoreId)?.name ?? rider.homeStoreId}</div>
                    {rider.deliveries !== undefined && <div>Deliveries this run: {rider.deliveries}</div>}
                  </div>
                </Popup>
              </Marker>

              {/* Route Polyline */}
              {rider.routeLine && rider.routeLine.length > 1 && (
                <Polyline
                  positions={rider.routeLine}
                  pathOptions={{
                    color: rider.status === 'delivering' ? '#10b981' : '#f59e0b',
                    weight: 3,
                    dashArray: rider.status === 'to_store' ? '6, 6' : undefined,
                    opacity: 0.8,
                  }}
                />
              )}
            </React.Fragment>
          ))}

          {/* Active Orders */}
          {worldData.orders.map((order) => {
            const isSelected = selectedOrderId === order.id;
            const isLate = order.isLate;

            return (
              <CircleMarker
                key={order.id}
                center={[order.lat, order.lng]}
                radius={isSelected ? 8 : isLate ? 6 : 4}
                pathOptions={{
                  color: isSelected ? '#38bdf8' : isLate ? '#ef4444' : '#10b981',
                  fillColor: isSelected ? '#0284c7' : isLate ? '#f87171' : '#34d399',
                  fillOpacity: 0.9,
                  weight: isSelected ? 3 : 1.5,
                }}
                eventHandlers={{
                  click: () => onSelectOrder(order.id),
                }}
              >
                <Popup>
                  <div className="text-xs font-sans text-slate-900">
                    <strong className="block">{order.id} ({order.class ?? order.priority})</strong>
                    <div>Status: {order.status}</div>
                    <div>Promised: {Math.round((order.promisedBy - order.createdAt) / 60)} min</div>
                    <div>Lateness: {order.isLate ? '⚠️ AT RISK / LATE' : '✅ ON TIME'}</div>
                    <button
                      onClick={() => onSelectOrder(order.id)}
                      className="mt-1 px-2 py-0.5 bg-emerald-600 text-white rounded text-[10px] font-bold"
                    >
                      View Explainability
                    </button>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
};
