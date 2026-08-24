/**
 * conjunctions.ts
 *
 * Close-approach (conjunction) data from CelesTrak SOCRATES Plus —
 * https://celestrak.org/SOCRATES/
 *
 * All active payloads screened against the full catalog 3x/day for the next
 * 7 days (encounters within 5 km). The CSV export is CORS-open (verified
 * live) but ~17 MB, and it's sorted by minimum range — so we stream just the
 * first chunk and abort. The top rows ARE the closest approaches.
 */

import { getCached, setCache } from './api-cache';

const SOCRATES_URL = 'https://celestrak.org/SOCRATES/sort-minRange.csv';
const CACHE_KEY = 'socrates-top';
const CACHE_TTL = 4 * 60 * 60 * 1000; // 4h — SOCRATES refreshes 3x/day
const MAX_BYTES = 96 * 1024; // first ~96 KB ≈ several hundred rows

export interface Conjunction {
  noradId1: number;
  name1: string;
  noradId2: number;
  name2: string;
  tca: string;           // time of closest approach, ISO-ish UTC
  rangeKm: number;       // minimum range at TCA
  relSpeedKmS: number;
  maxProb: number;       // maximum collision probability
}

/** Stream only the head of the CSV, then abort the connection. */
async function fetchCsvHead(): Promise<string> {
  const controller = new AbortController();
  const res = await fetch(SOCRATES_URL, {
    signal: controller.signal,
    headers: { Range: `bytes=0-${MAX_BYTES - 1}` }, // honored if supported; harmless if not
  });
  if (!res.ok && res.status !== 206) throw new Error(`SOCRATES HTTP ${res.status}`);

  const reader = res.body?.getReader();
  if (!reader) throw new Error('No stream reader');

  const chunks: Uint8Array[] = [];
  let received = 0;
  while (received < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      received += value.length;
    }
  }
  controller.abort(); // stop downloading the remaining megabytes

  const buf = new Uint8Array(received);
  let off = 0;
  for (const c of chunks) {
    buf.set(c, off);
    off += c.length;
  }
  return new TextDecoder().decode(buf);
}

function parseCsv(text: string): Conjunction[] {
  const lines = text.split('\n');
  const header = lines[0]?.split(',') ?? [];
  const col = (name: string) => header.indexOf(name);
  const iId1 = col('NORAD_CAT_ID_1');
  const iName1 = col('OBJECT_NAME_1');
  const iId2 = col('NORAD_CAT_ID_2');
  const iName2 = col('OBJECT_NAME_2');
  const iTca = col('TCA');
  const iRange = col('TCA_RANGE');
  const iSpeed = col('TCA_RELATIVE_SPEED');
  const iProb = col('MAX_PROB');
  if (iId1 < 0 || iTca < 0) return [];

  const out: Conjunction[] = [];
  // Skip the last line — it's almost certainly truncated mid-row
  for (let i = 1; i < lines.length - 1; i++) {
    const c = lines[i].split(',');
    if (c.length <= iProb) continue;
    const rangeKm = parseFloat(c[iRange]);
    const tca = c[iTca]?.trim();
    if (!tca || isNaN(rangeKm)) continue;
    out.push({
      noradId1: parseInt(c[iId1], 10),
      name1: c[iName1]?.replace(/\s*\[[+P-]\]\s*$/, '').trim() ?? '?',
      noradId2: parseInt(c[iId2], 10),
      name2: c[iName2]?.replace(/\s*\[[+P-]\]\s*$/, '').trim() ?? '?',
      tca,
      rangeKm,
      relSpeedKmS: parseFloat(c[iSpeed]) || 0,
      maxProb: parseFloat(c[iProb]) || 0,
    });
  }
  return out;
}

/**
 * Top upcoming conjunctions: deduped by satellite pair (SOCRATES lists the
 * same pair at many epochs), future TCAs only, closest-first.
 */
export async function fetchTopConjunctions(limit: number = 6): Promise<Conjunction[]> {
  const cached = getCached<Conjunction[]>(CACHE_KEY);
  if (cached) return filterUpcoming(cached, limit);

  try {
    const text = await fetchCsvHead();
    const all = parseCsv(text);
    // Dedup pairs, keeping the first (closest) entry for each
    const seen = new Set<string>();
    const deduped: Conjunction[] = [];
    for (const c of all) {
      const key = c.noradId1 < c.noradId2 ? `${c.noradId1}-${c.noradId2}` : `${c.noradId2}-${c.noradId1}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(c);
      if (deduped.length >= 40) break; // plenty for a top-N display
    }
    setCache(CACHE_KEY, deduped, CACHE_TTL);
    return filterUpcoming(deduped, limit);
  } catch (err) {
    console.warn('[SKYPORT] SOCRATES fetch failed:', err);
    return [];
  }
}

function filterUpcoming(list: Conjunction[], limit: number): Conjunction[] {
  const now = Date.now();
  return list
    .filter(c => new Date(c.tca.replace(' ', 'T') + 'Z').getTime() > now)
    .slice(0, limit);
}
