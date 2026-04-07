/**
 * satellite-engine.ts
 *
 * Fetches real TLE data from Celestrak, computes real-time ECI positions
 * using satellite.js, converts to lat/lng/alt and Three.js coordinates.
 * Handles Moon position via astronomy-engine.
 */

import * as satellite from 'satellite.js';
import * as Astronomy from 'astronomy-engine';
import { SATELLITE_REGISTRY, REGISTRY_BY_NORAD, type SatelliteRegistryEntry } from './satellite-registry';

// ─── Types ───────────────────────────────────────────────────

export interface SatellitePosition {
  id: string;
  noradId: number;
  latitude: number;   // degrees
  longitude: number;  // degrees
  altitude: number;   // km
  velocity: number;   // km/s
  inclination: number; // degrees (from TLE)
  period: number;     // minutes (from TLE)
}

export interface MoonPosition {
  latitude: number;
  longitude: number;
  distance: number; // km from Earth center
  phase: string;
  illumination: number; // 0-100%
  phaseAngle: number; // degrees
}

interface TLEData {
  noradId: number;
  line1: string;
  line2: string;
  satrec: satellite.SatRec;
  fetchedAt: number;
}

// ─── Cache ───────────────────────────────────────────────────

const TLE_CACHE_KEY = 'skyport_tle_cache';
const TLE_CACHE_DURATION = 3600000; // 1 hour

interface TLECacheEntry {
  noradId: number;
  line1: string;
  line2: string;
  fetchedAt: number;
}

function loadTLECache(): Map<number, TLECacheEntry> {
  try {
    const raw = localStorage.getItem(TLE_CACHE_KEY);
    if (!raw) return new Map();
    const entries: TLECacheEntry[] = JSON.parse(raw);
    const now = Date.now();
    const map = new Map<number, TLECacheEntry>();
    for (const entry of entries) {
      if (now - entry.fetchedAt < TLE_CACHE_DURATION) {
        map.set(entry.noradId, entry);
      }
    }
    return map;
  } catch {
    return new Map();
  }
}

function saveTLECache(cache: Map<number, TLECacheEntry>) {
  try {
    localStorage.setItem(TLE_CACHE_KEY, JSON.stringify(Array.from(cache.values())));
  } catch {
    // localStorage full or unavailable
  }
}

// ─── TLE Store ───────────────────────────────────────────────

const tleStore = new Map<number, TLEData>();
let tleInitialized = false;
let tleInitPromise: Promise<void> | null = null;

// ─── TLE Fetching ────────────────────────────────────────────

async function fetchTLEForNorad(noradId: number): Promise<{ line1: string; line2: string } | null> {
  // Try Celestrak GP endpoint (JSON format, CORS-friendly)
  const url = `https://celestrak.org/NORAD/elements/gp.php?CATNR=${noradId}&FORMAT=TLE`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    const lines = text.trim().split('\n').map(l => l.trim()).filter(l => l.length > 0);

    if (lines.length >= 3) {
      // Format: name \n line1 \n line2
      return { line1: lines[1], line2: lines[2] };
    } else if (lines.length === 2) {
      return { line1: lines[0], line2: lines[1] };
    }
    console.warn(`[SKYPORT] TLE format unexpected for NORAD ${noradId}:`, text.substring(0, 200));
    return null;
  } catch (err) {
    console.warn(`[SKYPORT] TLE fetch failed for NORAD ${noradId}:`, err);
    return null;
  }
}

export async function initializeTLEs(): Promise<void> {
  if (tleInitialized) return;
  if (tleInitPromise) return tleInitPromise;

  tleInitPromise = (async () => {
    console.log('[SKYPORT] Fetching TLE data for all satellites...');

    // Load cache first
    const cache = loadTLECache();

    // Get NORAD IDs that need TLE (skip Moon, noradId=0)
    const noradIds = SATELLITE_REGISTRY
      .filter(e => e.noradId > 0 && e.special !== 'L2_POINT')
      .map(e => e.noradId);

    // Check which need fetching vs cached
    const toFetch: number[] = [];
    for (const id of noradIds) {
      const cached = cache.get(id);
      if (cached) {
        try {
          const satrec = satellite.twoline2satrec(cached.line1, cached.line2);
          tleStore.set(id, { noradId: id, line1: cached.line1, line2: cached.line2, satrec, fetchedAt: cached.fetchedAt });
          console.log(`[SKYPORT] TLE loaded from cache for NORAD ${id}`);
        } catch {
          toFetch.push(id);
        }
      } else {
        toFetch.push(id);
      }
    }

    // Fetch remaining in parallel
    if (toFetch.length > 0) {
      console.log(`[SKYPORT] Fetching TLEs for ${toFetch.length} satellites...`);
      const results = await Promise.allSettled(
        toFetch.map(async (noradId) => {
          const tle = await fetchTLEForNorad(noradId);
          if (tle) {
            try {
              const satrec = satellite.twoline2satrec(tle.line1, tle.line2);
              const entry: TLEData = { noradId, line1: tle.line1, line2: tle.line2, satrec, fetchedAt: Date.now() };
              tleStore.set(noradId, entry);
              cache.set(noradId, { noradId, line1: tle.line1, line2: tle.line2, fetchedAt: Date.now() });
              console.log(`[SKYPORT] TLE fetched for NORAD ${noradId} ✓`);
            } catch (err) {
              console.warn(`[SKYPORT] TLE parse failed for NORAD ${noradId}:`, err);
            }
          }
        })
      );

      saveTLECache(cache);

      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      console.log(`[SKYPORT] TLE fetch complete: ${succeeded}/${toFetch.length} succeeded`);
    }

    tleInitialized = true;
    console.log(`[SKYPORT] Satellite engine initialized with ${tleStore.size} TLEs`);
  })();

  return tleInitPromise;
}

// ─── Position Computation ────────────────────────────────────

export function computeSatellitePosition(noradId: number, date?: Date): SatellitePosition | null {
  const tle = tleStore.get(noradId);
  if (!tle) return null;

  const now = date || new Date();
  const posVel = satellite.propagate(tle.satrec, now);

  if (!posVel.position || typeof posVel.position === 'boolean') return null;

  const posEci = posVel.position as satellite.EciVec3<number>;
  const velEci = posVel.velocity as satellite.EciVec3<number>;

  // Convert ECI to geodetic
  const gmstVal = satellite.gstime(now);
  const geo = satellite.eciToGeodetic(posEci, gmstVal);

  const latitude = satellite.degreesLat(geo.latitude);
  const longitude = satellite.degreesLong(geo.longitude);
  const altitude = geo.height; // km

  // Compute velocity magnitude
  const velocity = Math.sqrt(velEci.x ** 2 + velEci.y ** 2 + velEci.z ** 2);

  // Extract orbital elements from satrec
  const inclination = tle.satrec.inclo * (180 / Math.PI); // radians to degrees
  const meanMotion = tle.satrec.no; // radians per minute (internal)
  // Convert mean motion (rad/min in internal units) to period (minutes)
  // satrec.no is in radians/minute after conversion
  const period = (2 * Math.PI) / (meanMotion * 1440 / (2 * Math.PI)) * (1440 / (2 * Math.PI));
  // Simpler: period in minutes = 2pi / (no_kozai * 60) where no_kozai is rev/s ...
  // Actually satrec.no is in rad/min so period = 2*PI / satrec.no
  const periodMinutes = (2 * Math.PI) / tle.satrec.no;

  // Find registry entry
  const registry = REGISTRY_BY_NORAD.get(noradId);

  return {
    id: registry?.id || `sat-${noradId}`,
    noradId,
    latitude,
    longitude,
    altitude,
    velocity,
    inclination,
    period: periodMinutes,
  };
}

// Compute future positions for orbit path — computes one full orbital period
// and closes the loop by appending the first point at the end
export function computeOrbitPath(noradId: number, durationMinutes: number = 0, stepSeconds: number = 20): SatellitePosition[] {
  const tle = tleStore.get(noradId);
  if (!tle) return [];

  // Use actual orbital period to draw one complete orbit
  const periodMinutes = (2 * Math.PI) / tle.satrec.no;
  const actualDuration = durationMinutes > 0 ? durationMinutes : Math.ceil(periodMinutes);

  const positions: SatellitePosition[] = [];
  const now = Date.now();

  for (let t = 0; t <= actualDuration * 60; t += stepSeconds) {
    const date = new Date(now + t * 1000);
    const pos = computeSatellitePosition(noradId, date);
    if (pos) positions.push(pos);
  }

  // Close the loop: append the first point again so the line connects
  if (positions.length > 2) {
    positions.push({ ...positions[0] });
  }

  return positions;
}

// ─── Three.js Coordinate Conversion ─────────────────────────

const EARTH_RADIUS_VISUAL = 2; // Three.js units (matches earth-scene.tsx)

// Visual orbit radius mapping (matches earth-scene.tsx)
function getVisualOrbitRadius(altitudeKm: number): number {
  if (altitudeKm <= 2000) {
    const t = (altitudeKm - 160) / (2000 - 160);
    return 2.3 + t * (3.5 - 2.3);
  } else if (altitudeKm <= 35786) {
    const t = (altitudeKm - 2000) / (35786 - 2000);
    return 3.5 + t * (4.5 - 3.5);
  } else {
    const extra = altitudeKm - 35786;
    return 4.5 + extra * 0.00001;
  }
}

export function latLonAltToThreeJS(lat: number, lon: number, altitudeKm: number): { x: number; y: number; z: number } {
  const radius = getVisualOrbitRadius(altitudeKm);
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);

  return {
    x: -(radius * Math.sin(phi) * Math.cos(theta)),
    y: radius * Math.cos(phi),
    z: radius * Math.sin(phi) * Math.sin(theta),
  };
}

// ─── Moon Position ───────────────────────────────────────────

export async function computeMoonPosition(date?: Date): Promise<MoonPosition> {
  const now = date || new Date();

  // Get Moon equatorial position
  const equ = Astronomy.Equator(Astronomy.Body.Moon, now, new Astronomy.Observer(0, 0, 0), true, true);

  // Get Moon ecliptic longitude for phase calculation
  const moonIllum = Astronomy.Illumination(Astronomy.Body.Moon, now);

  // Approximate lat/lon from equatorial coordinates
  // RA (hours) -> longitude, Dec -> latitude
  // Adjust for Earth rotation (GMST)
  const gmst = Astronomy.SiderealTime(now);
  let moonLon = (equ.ra * 15) - (gmst * 15); // Convert RA hours to degrees, subtract Earth rotation
  while (moonLon > 180) moonLon -= 360;
  while (moonLon < -180) moonLon += 360;
  const moonLat = equ.dec;

  // Distance in km
  const distance = equ.dist * 149597870.7; // AU to km

  // Phase
  const phaseAngle = moonIllum.phase_angle;
  const illumination = (1 + Math.cos(phaseAngle * Math.PI / 180)) / 2 * 100;

  // Phase name
  let phase: string;
  const pa = moonIllum.phase_angle;
  if (pa < 10) phase = 'Full Moon';
  else if (pa < 80) phase = moonIllum.phase_angle > 0 ? 'Waning Gibbous' : 'Waxing Gibbous';
  else if (pa < 100) phase = 'Quarter';
  else if (pa < 170) phase = 'Crescent';
  else phase = 'New Moon';

  return {
    latitude: moonLat,
    longitude: moonLon,
    distance,
    phase,
    illumination,
    phaseAngle: pa,
  };
}

// ─── JWST Position (L2 Point) ────────────────────────────────

export function getJWSTPosition(): { latitude: number; longitude: number; altitude: number } {
  // JWST orbits the Sun-Earth L2 point, ~1.5 million km from Earth
  // For visualization, we place it at a fixed position opposite the Sun
  const now = new Date();
  // L2 is always roughly anti-sunward
  // Sun's ecliptic longitude advances ~1 degree/day
  const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);
  const sunLon = (dayOfYear * 360 / 365.25 + 180) % 360 - 180; // Opposite sun

  return {
    latitude: 0, // Near ecliptic plane
    longitude: sunLon,
    altitude: 1500000,
  };
}

// ─── Compute All Positions ───────────────────────────────────

export interface AllPositions {
  satellites: SatellitePosition[];
  moon: MoonPosition | null;
  jwst: SatellitePosition | null;
}

export async function computeAllPositions(): Promise<AllPositions> {
  const positions: SatellitePosition[] = [];

  for (const entry of SATELLITE_REGISTRY) {
    if (entry.special === 'MOON') continue;

    if (entry.special === 'L2_POINT') {
      // JWST special case
      const jwstPos = getJWSTPosition();
      positions.push({
        id: entry.id,
        noradId: entry.noradId,
        latitude: jwstPos.latitude,
        longitude: jwstPos.longitude,
        altitude: jwstPos.altitude,
        velocity: 0.3, // ~0.3 km/s orbital velocity at L2
        inclination: 0,
        period: 0, // Not applicable
      });
      continue;
    }

    const pos = computeSatellitePosition(entry.noradId);
    if (pos) {
      positions.push(pos);
    }
  }

  let moon: MoonPosition | null = null;
  try {
    moon = await computeMoonPosition();
  } catch (err) {
    console.warn('[SKYPORT] Moon position computation failed:', err);
  }

  return {
    satellites: positions,
    moon,
    jwst: positions.find(p => p.id === 'jwst') || null,
  };
}

// ─── Satellite Pass Prediction ───────────────────────────────

export interface PassPrediction {
  start: Date;
  maxElevation: number; // degrees
  duration: number; // seconds
}

export function predictNextPass(
  noradId: number,
  observerLat: number,
  observerLon: number,
  observerAlt: number = 0,
  maxHoursAhead: number = 24
): PassPrediction | null {
  const tle = tleStore.get(noradId);
  if (!tle) return null;

  const observerGd: satellite.GeodeticLocation = {
    longitude: satellite.degreesToRadians(observerLon),
    latitude: satellite.degreesToRadians(observerLat),
    height: observerAlt / 1000, // meters to km
  };

  const now = Date.now();
  const stepMs = 30000; // 30 second steps
  const maxMs = maxHoursAhead * 3600000;

  let inPass = false;
  let passStart: Date | null = null;
  let maxEl = 0;

  for (let t = 0; t < maxMs; t += stepMs) {
    const date = new Date(now + t);
    const posVel = satellite.propagate(tle.satrec, date);

    if (!posVel.position || typeof posVel.position === 'boolean') continue;

    const posEci = posVel.position as satellite.EciVec3<number>;
    const gmstVal = satellite.gstime(date);
    const lookAngles = satellite.ecfToLookAngles(
      observerGd,
      satellite.eciToEcf(posEci, gmstVal)
    );

    const elevation = lookAngles.elevation * (180 / Math.PI);

    if (elevation > 0) {
      if (!inPass) {
        inPass = true;
        passStart = date;
        maxEl = elevation;
      } else {
        maxEl = Math.max(maxEl, elevation);
      }
    } else if (inPass && passStart) {
      return {
        start: passStart,
        maxElevation: maxEl,
        duration: (now + t - passStart.getTime()) / 1000,
      };
    }
  }

  return null;
}

// ─── ECI Position Functions (for 3D rendering) ──────────────

/** Returns GMST in radians for the given date */
export function getGMST(date: Date): number {
  return satellite.gstime(date);
}

/** Compute raw ECI position for a satellite (km) */
export function computeECIPosition(noradId: number, date?: Date): { eciX: number; eciY: number; eciZ: number; altitude: number; velocity: number } | null {
  const tle = tleStore.get(noradId);
  if (!tle) return null;

  const now = date || new Date();
  const posVel = satellite.propagate(tle.satrec, now);
  if (!posVel.position || typeof posVel.position === 'boolean') return null;

  const posEci = posVel.position as satellite.EciVec3<number>;
  const velEci = posVel.velocity as satellite.EciVec3<number>;

  const distKm = Math.sqrt(posEci.x ** 2 + posEci.y ** 2 + posEci.z ** 2);
  const altitude = distKm - 6371;
  const velocity = Math.sqrt(velEci.x ** 2 + velEci.y ** 2 + velEci.z ** 2);

  return { eciX: posEci.x, eciY: posEci.y, eciZ: posEci.z, altitude, velocity };
}

/** Compute one full orbit in ECI coordinates, starting from given epoch (or now) */
export function computeOrbitPathECI(noradId: number, stepSeconds: number = 30, startDate?: Date): { eciX: number; eciY: number; eciZ: number; altitude: number }[] {
  const tle = tleStore.get(noradId);
  if (!tle) return [];

  const periodMinutes = (2 * Math.PI) / tle.satrec.no;
  const epoch = startDate ? startDate.getTime() : Date.now();
  const points: { eciX: number; eciY: number; eciZ: number; altitude: number }[] = [];

  for (let t = 0; t <= periodMinutes * 60; t += stepSeconds) {
    const date = new Date(epoch + t * 1000);
    const posVel = satellite.propagate(tle.satrec, date);
    if (!posVel.position || typeof posVel.position === 'boolean') continue;
    const posEci = posVel.position as satellite.EciVec3<number>;
    const distKm = Math.sqrt(posEci.x ** 2 + posEci.y ** 2 + posEci.z ** 2);
    points.push({ eciX: posEci.x, eciY: posEci.y, eciZ: posEci.z, altitude: distKm - 6371 });
  }

  if (points.length > 2) points.push({ ...points[0] });
  return points;
}

/** Compute Moon position as ECI unit vector */
export function computeMoonPositionECI(date?: Date): { eciX: number; eciY: number; eciZ: number; distance: number } {
  const now = date || new Date();
  const equ = Astronomy.Equator(Astronomy.Body.Moon, now, new Astronomy.Observer(0, 0, 0), true, true);

  const raRad = equ.ra * (Math.PI / 12);
  const decRad = equ.dec * (Math.PI / 180);

  return {
    eciX: Math.cos(decRad) * Math.cos(raRad),
    eciY: Math.cos(decRad) * Math.sin(raRad),
    eciZ: Math.sin(decRad),
    distance: equ.dist * 149597870.7,
  };
}

/** Compute Moon orbital plane normal via cross product of two positions ~7 days apart */
export function computeMoonOrbitNormal(): { eciX: number; eciY: number; eciZ: number } {
  const now = new Date();
  const pos1 = computeMoonPositionECI(now);
  const pos2 = computeMoonPositionECI(new Date(now.getTime() + 7 * 86400000));

  // Cross product pos1 × pos2 = normal to orbital plane
  const nx = pos1.eciY * pos2.eciZ - pos1.eciZ * pos2.eciY;
  const ny = pos1.eciZ * pos2.eciX - pos1.eciX * pos2.eciZ;
  const nz = pos1.eciX * pos2.eciY - pos1.eciY * pos2.eciX;
  const len = Math.sqrt(nx * nx + ny * ny + nz * nz);

  return { eciX: nx / len, eciY: ny / len, eciZ: nz / len };
}

/** JWST position as anti-sunward ECI unit vector */
export function getJWSTPositionECI(date?: Date): { eciX: number; eciY: number; eciZ: number } {
  const now = date || new Date();
  const sunEqu = Astronomy.Equator(Astronomy.Body.Sun, now, new Astronomy.Observer(0, 0, 0), true, true);
  const raRad = sunEqu.ra * (Math.PI / 12);
  const decRad = sunEqu.dec * (Math.PI / 180);
  return {
    eciX: -Math.cos(decRad) * Math.cos(raRad),
    eciY: -Math.cos(decRad) * Math.sin(raRad),
    eciZ: -Math.sin(decRad),
  };
}
