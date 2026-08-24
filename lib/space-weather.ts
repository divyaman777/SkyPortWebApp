/**
 * space-weather.ts
 *
 * NOAA Space Weather Prediction Center feeds (official, CORS `*` verified):
 * - OVATION aurora model: 360x181 lat/lon grid of aurora probability (0-100),
 *   refreshed every ~5 minutes
 * - Planetary Kp index (3-hour cadence)
 * https://services.swpc.noaa.gov/
 */

import { getCached, setCache } from './api-cache';

const AURORA_URL = 'https://services.swpc.noaa.gov/json/ovation_aurora_latest.json';
const KP_URL = 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json';

export interface AuroraPoint {
  lon: number;   // 0..359 (east-positive)
  lat: number;   // -90..90
  prob: number;  // 0..100 aurora probability
}

interface OvationResponse {
  'Forecast Time': string;
  coordinates: [number, number, number][]; // [lon, lat, aurora]
}

/**
 * Aurora probability grid, filtered to visible intensities.
 * The raw grid is 65k points (~900 KB) — we keep only cells above the
 * threshold, which is typically a few thousand points around the two ovals.
 * Not localStorage-cached (too big); module-cached for the session, re-fetched
 * every 10 minutes.
 */
let auroraCache: { points: AuroraPoint[]; forecastTime: string; fetchedAt: number } | null = null;
const AURORA_TTL = 10 * 60 * 1000;
const PROB_THRESHOLD = 12;

export async function fetchAuroraOval(): Promise<{ points: AuroraPoint[]; forecastTime: string } | null> {
  if (auroraCache && Date.now() - auroraCache.fetchedAt < AURORA_TTL) {
    return auroraCache;
  }
  try {
    const res = await fetch(AURORA_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as OvationResponse;
    if (!data?.coordinates?.length) return null;

    const points: AuroraPoint[] = [];
    for (const [lon, lat, prob] of data.coordinates) {
      if (prob >= PROB_THRESHOLD) points.push({ lon, lat, prob });
    }
    auroraCache = { points, forecastTime: data['Forecast Time'], fetchedAt: Date.now() };
    console.log(`[SKYPORT] Aurora oval: ${points.length} active cells (forecast ${data['Forecast Time']})`);
    return auroraCache;
  } catch (err) {
    console.warn('[SKYPORT] Aurora fetch failed:', err);
    return auroraCache; // stale is better than nothing
  }
}

export interface KpReading {
  kp: number;
  time: string;
}

interface KpEntry {
  time_tag: string;
  Kp: number;
}

/** Latest planetary Kp index. 0-3 quiet, 4 active, 5+ storm (G1..G5). */
export async function fetchKpIndex(): Promise<KpReading | null> {
  const cached = getCached<KpReading>('swpc-kp');
  if (cached) return cached;
  try {
    const res = await fetch(KP_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as KpEntry[];
    const last = data[data.length - 1];
    if (!last || typeof last.Kp !== 'number') return null;
    const reading = { kp: last.Kp, time: last.time_tag };
    setCache('swpc-kp', reading, 15 * 60 * 1000);
    return reading;
  } catch (err) {
    console.warn('[SKYPORT] Kp fetch failed:', err);
    return null;
  }
}

/** Kp → display color (terminal palette: quiet green, active amber, storm red) */
export function kpColor(kp: number): string {
  if (kp >= 5) return '#FF4444';
  if (kp >= 4) return '#FFB300';
  return '#00FF41';
}
