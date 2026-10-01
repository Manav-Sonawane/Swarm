export function formatSimTime(simTimeSec: number): string {
  const hours = Math.floor((simTimeSec / 3600) % 24);
  const minutes = Math.floor((simTimeSec % 3600) / 60);
  const seconds = Math.floor(simTimeSec % 60);

  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');

  return `${hh}:${mm}:${ss}`;
}

export function formatDuration(seconds: number): string {
  if (seconds < 0) return '0s';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);

  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

export function formatDistance(km: number): string {
  return `${km.toFixed(1)} km`;
}
