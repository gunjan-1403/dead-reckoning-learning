export type LatLng = { latitude: number; longitude: number };

const EARTH_RADIUS_M = 6371000;

export function haversineMeters(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Index of the polyline vertex closest to `point`. */
export function nearestPolylineIndex(
  polyline: LatLng[],
  point: LatLng
): number {
  if (polyline.length === 0) return 0;
  let best = 0;
  let bestDist = Number.POSITIVE_INFINITY;
  for (let i = 0; i < polyline.length; i++) {
    const d = haversineMeters(polyline[i], point);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

/** Remaining path from the closest vertex onward, plus remaining length. */
export function remainingRoute(
  polyline: LatLng[],
  point: LatLng
): { coords: LatLng[]; meters: number; index: number } {
  if (polyline.length < 2) {
    return { coords: polyline, meters: 0, index: 0 };
  }

  const index = nearestPolylineIndex(polyline, point);
  const coords = [point, ...polyline.slice(index + 1)];
  let meters = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    meters += haversineMeters(coords[i], coords[i + 1]);
  }
  return { coords, meters, index };
}

export function formatDuration(seconds: number): string {
  const mins = Math.max(1, Math.round(seconds / 60));
  if (mins >= 60) {
    return `${Math.floor(mins / 60)} hr ${mins % 60} min`;
  }
  return `${mins} min`;
}

export function formatDistance(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters)} m`;
}
