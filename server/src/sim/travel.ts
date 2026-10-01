import { LatLng } from '../types';
import { CONFIG } from '../config';

export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);

  const val = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  const c = 2 * Math.atan2(Math.sqrt(val), Math.sqrt(1 - val));
  return R * c;
}

export function routeDistanceKm(a: LatLng, b: LatLng): number {
  return haversineKm(a, b) * CONFIG.ROAD_WINDING_FACTOR;
}

export function getTrafficMultiplier(simTimeSec: number, zoneId?: string): number {
  // Convert simTimeSec to sim hour (0..23)
  const simHour = Math.floor((simTimeSec / 3600) % 24);
  // Peak hours: 8-11 and 18-21. Returned as a speed factor (1 / time multiplier).
  const isPeak = (simHour >= 8 && simHour < 11) || (simHour >= 18 && simHour < 21);
  return isPeak ? 1 / CONFIG.TRAFFIC_MULTIPLIER_PEAK : 1.0;
}

export function travelTimeSec(
  from: LatLng,
  to: LatLng,
  simTimeSec: number = 0,
  weatherMult: number = 1.0,
  zoneId?: string
): number {
  const distKm = routeDistanceKm(from, to);
  const trafficMult = getTrafficMultiplier(simTimeSec, zoneId);
  const effectiveSpeedKmh = Math.max(5, CONFIG.BASE_SPEED_KMH * trafficMult * weatherMult);
  return (distKm / effectiveSpeedKmh) * 3600;
}
