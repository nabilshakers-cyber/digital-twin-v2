import { SavedLocation, Task } from '../types';

export interface GeoCoordinates {
  lat: number;
  lng: number;
  accuracy?: number;
  timestamp?: number;
}

export interface LocationArrivalMatch {
  task: Task;
  locationId: string;
  locationName: string;
  distanceMeters: number;
  radiusMeters: number;
}

export const LOCATION_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes per location unless exited & re-entered

export const DEFAULT_RADIUS_OPTIONS: ReadonlyArray<{
  value: number;
  label: string;
}> = [
  { value: 100, label: '100 م' },
  { value: 200, label: '200 م' },
  { value: 500, label: '500 م' },
  { value: 1000, label: '1 كم' },
];

/**
 * Computes great-circle distance between two coordinates in meters (Haversine formula).
 */
export function calculateDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // Earth mean radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export function formatDistanceArabic(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return '—';
  if (meters < 1000) {
    return `${Math.round(meters)} م`;
  }
  const km = meters / 1000;
  return `${km >= 10 ? Math.round(km) : km.toFixed(1)} كم`;
}

export function isGeolocationSupported(): boolean {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator;
}

export function formatGeolocationErrorArabic(err: GeolocationPositionError | unknown): string {
  if (err && typeof err === 'object' && 'code' in err) {
    const code = Number((err as GeolocationPositionError).code);
    if (code === 1) {
      return 'تم رفض إذن الوصول للموقع الجغرافي. يمكنك تفعيله من إعدادات المتصفح أو الهاتف.';
    }
    if (code === 2) {
      return 'تعذر تحديد موقعك الحالي حالياً. تأكد من تفعيل خدمة الموقع (GPS).';
    }
    if (code === 3) {
      return 'انتهت مهلة تحديد الموقع. حاول مجدداً في مكان مفتوح أو بشبكة أفضل.';
    }
  }
  return 'حدث خطأ أثناء قراءة الموقع الجغرافي.';
}

export function requestCurrentCoordinates(options?: PositionOptions): Promise<GeoCoordinates> {
  return new Promise((resolve, reject) => {
    if (!isGeolocationSupported()) {
      reject(new Error('المتصفح أو الجهاز لا يدعم خدمة تحديد الموقع الجغرافي.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp,
        });
      },
      (err) => {
        reject(new Error(formatGeolocationErrorArabic(err)));
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 15000,
        ...(options || {}),
      }
    );
  });
}

/**
 * Evaluates current GPS coordinates against incomplete tasks linked to geofenced locations.
 * Prevents duplicate firing while the user stays inside the same geofence or within cooldown.
 */
export function evaluateGeofenceArrivals(params: {
  coords: GeoCoordinates;
  tasks: Task[];
  savedLocations: SavedLocation[];
  insideLocationIds: Set<string>;
  cooldownMap: Record<string, number>;
  nowMs?: number;
  cooldownMs?: number;
}): {
  newMatches: LocationArrivalMatch[];
  nextInsideLocationIds: Set<string>;
  nextCooldownMap: Record<string, number>;
  locationDistances: Record<string, number>;
} {
  const {
    coords,
    tasks,
    savedLocations,
    insideLocationIds,
    cooldownMap,
    nowMs = Date.now(),
    cooldownMs = LOCATION_COOLDOWN_MS,
  } = params;

  const savedById: Record<string, SavedLocation> = {};
  const locationDistances: Record<string, number> = {};

  for (const loc of savedLocations) {
    savedById[loc.id] = loc;
    locationDistances[loc.id] = calculateDistanceMeters(
      coords.lat,
      coords.lng,
      loc.lat,
      loc.lng
    );
  }

  const nextInsideLocationIds = new Set<string>();
  const nextCooldownMap: Record<string, number> = { ...cooldownMap };
  const newMatches: LocationArrivalMatch[] = [];
  const triggeredLocationsThisCycle = new Set<string>();

  for (const loc of savedLocations) {
    const dist = locationDistances[loc.id];
    if (dist <= loc.radiusMeters) {
      nextInsideLocationIds.add(loc.id);
    }
  }

  for (const task of tasks) {
    if (task.status === 'completed') continue;
    const lr = task.locationReminder;
    if (!lr || !lr.enabled) continue;

    const syncedLoc = savedById[lr.locationId];
    const targetLat = syncedLoc ? syncedLoc.lat : lr.lat;
    const targetLng = syncedLoc ? syncedLoc.lng : lr.lng;
    const targetRadius = syncedLoc ? syncedLoc.radiusMeters : lr.radiusMeters;
    const targetName = syncedLoc ? syncedLoc.name : lr.locationName;

    const dist = calculateDistanceMeters(coords.lat, coords.lng, targetLat, targetLng);
    locationDistances[lr.locationId] = dist;

    if (dist <= targetRadius) {
      nextInsideLocationIds.add(lr.locationId);

      const wasAlreadyInside = insideLocationIds.has(lr.locationId);
      const lastFiredAt = cooldownMap[lr.locationId] || 0;
      const inCooldown = nowMs - lastFiredAt < cooldownMs;

      if (!wasAlreadyInside && !inCooldown) {
        newMatches.push({
          task,
          locationId: lr.locationId,
          locationName: targetName,
          distanceMeters: dist,
          radiusMeters: targetRadius,
        });
        triggeredLocationsThisCycle.add(lr.locationId);
      }
    }
  }

  for (const locId of triggeredLocationsThisCycle) {
    nextCooldownMap[locId] = nowMs;
  }

  return {
    newMatches,
    nextInsideLocationIds,
    nextCooldownMap,
    locationDistances,
  };
}

/**
 * Generates synthetic arrival matches for a saved location (for instant user verification/testing).
 */
export function buildSimulatedLocationMatches(
  location: SavedLocation,
  tasks: Task[]
): LocationArrivalMatch[] {
  const linked = tasks.filter(
    (t) =>
      t.status !== 'completed' &&
      t.locationReminder?.enabled &&
      t.locationReminder.locationId === location.id
  );

  return linked.map((task) => ({
    task,
    locationId: location.id,
    locationName: location.name,
    distanceMeters: Math.min(25, Math.max(5, Math.round(location.radiusMeters * 0.15))),
    radiusMeters: location.radiusMeters,
  }));
}
