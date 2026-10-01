import { LatLng } from '../types';

/**
 * Coarse outline of the land in our service area (Lower Parel/Worli up to Andheri/Powai, west coast
 * to Thane Creek), clockwise from the south-west. Used to keep generated customers out of the sea.
 * Precision is ~200–300 m; creeks inside the area (Mithi river) are ignored since bridges cross them.
 */
export const SERVICE_LAND: [number, number][] = [
  [18.985, 72.815], // Worli south
  [19.010, 72.814], // Worli sea face
  [19.022, 72.832], // Dadar chowpatty
  [19.037, 72.838], // Mahim beach
  [19.042, 72.832], // Mahim creek mouth
  [19.044, 72.820], // Bandstand
  [19.065, 72.821], // Carter Road
  [19.080, 72.825], // Khar / Juhu Tara
  [19.100, 72.825], // Juhu beach
  [19.120, 72.824], // Juhu north
  [19.135, 72.808], // Versova
  [19.150, 72.810], // Versova north
  [19.150, 72.940], // Powai / Vikhroli north-east
  [19.105, 72.935], // Vikhroli east
  [19.065, 72.930], // Ghatkopar / Mankhurd east
  [19.030, 72.925], // Chembur / Trombay east
  [19.010, 72.880], // Wadala east
  [18.985, 72.850], // Sewri
];

/** Ray-casting point-in-polygon test. */
export function isOnLand(p: LatLng, polygon: [number, number][] = SERVICE_LAND): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [yi, xi] = polygon[i];
    const [yj, xj] = polygon[j];
    if (yi > p.lat !== yj > p.lat && p.lng < ((xj - xi) * (p.lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
