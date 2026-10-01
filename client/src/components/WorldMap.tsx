import React, { useEffect, useMemo, useRef } from 'react';
import { Circle, CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, ZoomControl, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { OrderSnapshot, TrafficJam, WorldName, WorldSnapshot } from '../types';
import { RIDER_STATUS, WORLDS, ORDER_STATUS_LABEL, CLASS_META } from '../lib/theme';
import { formatClock, storeShort } from '../lib/format';
import { getRiderName } from '../lib/nameGen';

export const MUMBAI: [number, number] = [19.068, 72.866];

/** Shared view for maps shown side by side: panning or zooming one moves the others. */
export interface MapSync {
  maps: Set<L.Map>;
  busy: boolean;
}
export const createMapSync = (): MapSync => ({ maps: new Set(), busy: false });

const SyncView: React.FC<{ sync?: MapSync }> = ({ sync }) => {
  const map = useMap();
  useEffect(() => {
    if (!sync) return;
    sync.maps.add(map);
    const follow = () => {
      if (sync.busy) return;
      sync.busy = true;
      const c = map.getCenter();
      const z = map.getZoom();
      sync.maps.forEach(m => m !== map && m.setView(c, z, { animate: false }));
      sync.busy = false;
    };
    map.on('move zoomend', follow);
    // Join the group at the group's current view
    const other = [...sync.maps].find(m => m !== map);
    if (other) map.setView(other.getCenter(), other.getZoom(), { animate: false });
    return () => {
      map.off('move zoomend', follow);
      sync.maps.delete(map);
    };
  }, [map, sync]);
  return null;
};

/** Keeps Leaflet's size right when the layout or the active screen changes. */
const AutoResize: React.FC = () => {
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer();
    const ro = new ResizeObserver(() => map.invalidateSize({ animate: false }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [map]);
  return null;
};

const PickHandler: React.FC<{ picking?: boolean; onPick?: (lat: number, lng: number) => void }> = ({ picking, onPick }) => {
  const map = useMap();
  useEffect(() => {
    map.getContainer().classList.toggle('picking', !!picking);
  }, [map, picking]);
  useMapEvents({
    click(e) {
      if (picking && onPick) onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};

const FlyTo: React.FC<{ target?: [number, number] | null; zoom?: number }> = ({ target, zoom = 14 }) => {
  const map = useMap();
  const key = target ? target.join(',') : '';
  useEffect(() => {
    if (target) map.flyTo(target, Math.max(map.getZoom(), zoom), { duration: 0.6 });
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
};

// ---------------------------------------------------------------- icons (cached so position updates keep the same DOM node)
const iconCache = new Map<string, L.DivIcon>();
function cached(key: string, make: () => L.DivIcon): L.DivIcon {
  let i = iconCache.get(key);
  if (!i) iconCache.set(key, (i = make()));
  return i;
}

function riderIcon(status: string, load: number, worldHex: string, dimmed: boolean): L.DivIcon {
  return cached(`r|${status}|${load}|${worldHex}|${dimmed}`, () => {
    const color = RIDER_STATUS[status as keyof typeof RIDER_STATUS]?.hex ?? '#606e80';
    const busy = status === 'delivering' || status === 'to_store' || status === 'at_store';
    const ring = busy ? worldHex : '#2c3848';
    const badge = load > 1 ? `<span style="position:absolute;right:-6px;top:-7px;min-width:13px;height:13px;padding:0 3px;border-radius:7px;background:#090c11;border:1px solid ${worldHex};color:${worldHex};font:600 9px/11px 'Geist Mono',monospace;text-align:center">${load}</span>` : '';
    const html = `<div style="position:relative;width:12px;height:12px;border-radius:50%;background:${color};box-shadow:0 0 0 2px ${ring}${busy ? `,0 0 10px ${worldHex}66` : ''};opacity:${dimmed ? 0.25 : status === 'off_shift' ? 0.45 : 1}">${badge}</div>`;
    return L.divIcon({ className: 'rider-icon', html, iconSize: [12, 12], iconAnchor: [6, 6] });
  });
}

function storeIcon(queue: number, offline: boolean, jammed: boolean): L.DivIcon {
  return cached(`s|${Math.min(queue, 99)}|${offline}|${jammed}`, () => {
    const bg = offline ? '#2a1a20' : '#141b24';
    const border = offline ? '#ff5b70' : jammed ? '#ff8a3d' : '#f6b73c';
    const glyph = offline
      ? `<path d="M5 5l8 8M13 5l-8 8" stroke="#ff5b70" stroke-width="2" stroke-linecap="round"/>`
      : `<path d="M4 8l5-4 5 4v6H4z" fill="none" stroke="#f6b73c" stroke-width="1.6" stroke-linejoin="round"/><path d="M7.5 14v-3.5h3V14" fill="none" stroke="#f6b73c" stroke-width="1.6"/>`;
    const q = queue > 0 && !offline
      ? `<span style="position:absolute;right:-8px;top:-8px;min-width:16px;height:16px;padding:0 4px;border-radius:8px;background:${queue >= 5 ? '#ff5b70' : '#f6b73c'};color:#140e03;font:700 10px/16px 'Geist Mono',monospace;text-align:center">${queue}</span>`
      : '';
    const html = `<div style="position:relative;width:24px;height:24px;border-radius:7px;background:${bg};border:1.5px solid ${border};display:grid;place-items:center;box-shadow:0 4px 14px #0008"><svg width="18" height="18" viewBox="0 0 18 18">${glyph}</svg>${q}</div>`;
    return L.divIcon({ className: '', html, iconSize: [24, 24], iconAnchor: [12, 12] });
  });
}

const pinIcon = L.divIcon({
  className: '',
  html: `<svg width="26" height="34" viewBox="0 0 26 34"><path d="M13 33s11-11.6 11-20A11 11 0 0 0 2 13c0 8.4 11 20 11 20z" fill="#f6b73c" stroke="#140e03" stroke-width="1.5"/><circle cx="13" cy="13" r="4.2" fill="#140e03"/></svg>`,
  iconSize: [26, 34],
  iconAnchor: [13, 33],
});

function orderColor(o: OrderSnapshot): string {
  if (o.status === 'delivered') return o.isLate ? '#ff5b7066' : '#34e0a155';
  if (o.isLate) return '#ff5b70';
  if (o.handover) return '#e879a8';
  if (o.class === 'express') return '#f6b73c';
  if (o.class === 'regular') return '#5ab8ff';
  return '#94a2b3';
}

export interface WorldMapProps {
  world: WorldName;
  data: WorldSnapshot;
  jam?: TrafficJam | null;
  selectedOrderId?: string | null;
  focusOrderId?: string | null; // Track view: show only this order's trip
  onSelectOrder?: (id: string) => void;
  picking?: boolean;
  onPick?: (lat: number, lng: number) => void;
  pick?: { lat: number; lng: number } | null;
  sync?: MapSync;
  label?: boolean;
  flyTo?: [number, number] | null;
}

export const WorldMap: React.FC<WorldMapProps> = React.memo(function WorldMap({
  world, data, jam, selectedOrderId, focusOrderId, onSelectOrder, picking, onPick, pick, sync, label = true, flyTo,
}) {
  const meta = WORLDS[world];
  const focusOrder = focusOrderId ? data.orders.find(o => o.id === focusOrderId) : undefined;
  const focusRider = focusOrder?.riderId;
  const storeName = useMemo(() => new Map(data.stores.map(s => [s.id, s.name])), [data.stores]);
  const jammedStore = jam?.storeId;
  const busy = data.riders.filter(r => r.status === 'delivering' || r.status === 'to_store' || r.status === 'at_store').length;

  return (
    <div className="relative h-full min-h-[240px] overflow-hidden rounded-2xl border border-line bg-bg">
      <MapContainer center={MUMBAI} zoom={12} minZoom={11} maxZoom={17} zoomControl={false} fadeAnimation={false} scrollWheelZoom style={{ height: '100%', width: '100%' }} preferCanvas={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ZoomControl position="bottomright" />
        <AutoResize />
        <SyncView sync={sync} />
        <PickHandler picking={picking} onPick={onPick} />
        <FlyTo target={flyTo} />

        {jam && (
          <Circle
            center={[jam.lat, jam.lng]}
            radius={jam.radiusKm * 1000}
            pathOptions={{ color: '#ff8a3d', weight: 1.5, dashArray: '6 6', fillColor: '#ff8a3d', fillOpacity: 0.08 }}
            interactive={false}
          />
        )}

        {/* Rider routes */}
        {data.riders.map(r => {
          if (r.routeLine.length < 2) return null;
          if (focusOrderId && r.id !== focusRider) return null;
          return (
            <Polyline
              key={`route-${r.id}`}
              positions={r.routeLine}
              interactive={false}
              pathOptions={{
                color: meta.hex,
                weight: focusOrderId ? 3.5 : 2,
                opacity: focusOrderId ? 0.95 : r.status === 'delivering' ? 0.55 : 0.32,
                dashArray: r.status === 'to_store' || r.status === 'at_store' ? '4 6' : undefined,
              }}
            />
          );
        })}

        {/* Orders */}
        {data.orders.map(o => {
          if (focusOrderId && o.id !== focusOrderId) return null;
          const sel = o.id === selectedOrderId || o.id === focusOrderId;
          return (
            <CircleMarker
              key={o.id}
              center={[o.lat, o.lng]}
              radius={sel ? 8 : o.status === 'delivered' ? 3 : o.manual ? 6 : 4.5}
              pathOptions={{
                color: sel ? '#ffffff' : o.manual ? '#f6b73c' : orderColor(o),
                weight: sel ? 2.5 : o.manual ? 2 : 1,
                fillColor: orderColor(o),
                fillOpacity: o.status === 'delivered' ? 0.6 : 0.95,
              }}
              eventHandlers={{
                click: e => {
                  if (picking) return;
                  L.DomEvent.stopPropagation(e);
                  onSelectOrder?.(o.id);
                },
              }}
            />
          );
        })}

        {/* Stores */}
        {data.stores.map(s => (
          <Marker key={s.id} position={[s.lat, s.lng]} icon={storeIcon(s.queue, !!s.offline, s.id === jammedStore)} zIndexOffset={400}>
            <Popup>
              <strong>{s.name}</strong>
              <div>{s.offline ? 'Offline: orders go to the next-nearest store' : `${s.queue} order(s) in the packing queue`}</div>
            </Popup>
          </Marker>
        ))}

        {/* Riders (glide between ticks) */}
        {data.riders.map(r => {
          const dim = !!focusOrderId && r.id !== focusRider;
          if (dim && r.status === 'off_shift') return null;
          return (
            <Marker key={r.id} position={[r.lat, r.lng]} icon={riderIcon(r.status, r.load, meta.hex, dim)} zIndexOffset={r.id === focusRider ? 1000 : 600}>
              <Popup>
                <strong>{getRiderName(r.id)}</strong> <span style={{ opacity: 0.6 }}>{r.id}</span>
                <div>{RIDER_STATUS[r.status].label}{r.load > 0 ? ` · ${r.load} order(s)` : ''}</div>
                <div style={{ opacity: 0.7 }}>{storeShort(storeName.get(r.homeStoreId))} · {r.deliveries} delivered</div>
                {r.shiftEndsAt !== undefined && r.shiftStartsAt !== undefined && (
                  <div style={{ opacity: 0.7 }}>Shift {formatClock(r.shiftStartsAt)}–{formatClock(r.shiftEndsAt)}</div>
                )}
              </Popup>
            </Marker>
          );
        })}

        {pick && <Marker position={[pick.lat, pick.lng]} icon={pinIcon} zIndexOffset={2000} interactive={false} />}
      </MapContainer>

      {label && (
        <div className="pointer-events-none absolute left-3 top-3 z-[500] flex items-center gap-2 rounded-xl border border-line bg-panel/90 px-3 py-1.5 backdrop-blur">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: meta.hex }} />
          <span className={`font-display text-[13px] font-bold ${meta.text}`}>{meta.label}</span>
          <span className="num font-mono text-2xs text-mute">{busy} riders busy · {data.orders.filter(o => o.status !== 'delivered').length} open</span>
        </div>
      )}
      {focusOrder && (
        <div className="pointer-events-none absolute bottom-3 left-3 z-[500] rounded-xl border border-line bg-panel/90 px-3 py-1.5 text-xs backdrop-blur">
          <span className={`chip mr-2 ${CLASS_META[focusOrder.class].cls}`}>{CLASS_META[focusOrder.class].label}</span>
          {ORDER_STATUS_LABEL[focusOrder.status]}
        </div>
      )}
    </div>
  );
});
