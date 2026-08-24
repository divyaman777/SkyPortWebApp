/**
 * observer-location.ts
 *
 * IP-based approximate observer location (no permission popup).
 * Fetched once and shared between the 3D scene (YOU marker) and the
 * status bar (overhead count). Returns null on failure — callers must
 * handle "location unknown" instead of assuming a default city.
 */

export interface ObserverLocation {
  lat: number;
  lon: number;
  city?: string;
}

let locationPromise: Promise<ObserverLocation | null> | null = null;

export function getObserverLocation(): Promise<ObserverLocation | null> {
  if (!locationPromise) {
    locationPromise = fetch('https://ipapi.co/json/')
      .then(r => r.json())
      .then(data => {
        if (typeof data.latitude === 'number' && typeof data.longitude === 'number') {
          console.log(`[SKYPORT] Observer location (IP): ${data.latitude.toFixed(2)}, ${data.longitude.toFixed(2)} (${data.city || 'unknown'})`);
          return { lat: data.latitude, lon: data.longitude, city: data.city };
        }
        console.log('[SKYPORT] IP geolocation returned no coordinates (rate-limited?)');
        return null;
      })
      .catch(() => {
        console.log('[SKYPORT] IP geolocation failed');
        return null;
      });
  }
  return locationPromise;
}

/**
 * Is a satellite above the observer's horizon?
 * True when the great-circle angle between the observer and the
 * satellite's subpoint is smaller than the horizon angle acos(R/(R+alt)).
 */
export function isSatelliteInView(
  observerLat: number,
  observerLon: number,
  satLat: number,
  satLon: number,
  altitudeKm: number,
): boolean {
  if (altitudeKm <= 0) return false;
  const toRad = Math.PI / 180;
  const lat1 = observerLat * toRad;
  const lat2 = satLat * toRad;
  const dLon = (satLon - observerLon) * toRad;
  const cosAngle = Math.sin(lat1) * Math.sin(lat2) + Math.cos(lat1) * Math.cos(lat2) * Math.cos(dLon);
  const centralAngle = Math.acos(Math.min(1, Math.max(-1, cosAngle)));
  const horizonAngle = Math.acos(6371 / (6371 + altitudeKm));
  return centralAngle < horizonAngle;
}
