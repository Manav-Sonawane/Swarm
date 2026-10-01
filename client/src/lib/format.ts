/** 69730 -> "19:22:10" */
export function formatSimTime(simTimeSec: number): string {
  const hours = Math.floor((simTimeSec / 3600) % 24);
  const minutes = Math.floor((simTimeSec % 3600) / 60);
  const seconds = Math.floor(simTimeSec % 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/** 69730 -> "19:22" */
export function formatClock(simTimeSec: number): string {
  return formatSimTime(simTimeSec).slice(0, 5);
}

/** 125 -> "2m 5s", 40 -> "40s" */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0s';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (mins === 0) return `${secs}s`;
  return secs === 0 ? `${mins}m` : `${mins}m ${secs}s`;
}

/** Minutes with one decimal: 125 -> "2.1 min" */
export function formatMinutes(seconds: number): string {
  return `${(seconds / 60).toFixed(1)} min`;
}

export function formatDistance(km: number): string {
  return `${km.toFixed(1)} km`;
}

export const storeShort = (name?: string) => (name ?? '').replace(' Dark Store', '');
