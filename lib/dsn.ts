/**
 * dsn.ts
 *
 * NASA Deep Space Network live status — the real data feed behind DSN Now
 * (https://eyes.nasa.gov/dsn/). XML, refreshed every ~5 s server-side,
 * CORS `*` verified live. We parse with the browser's DOMParser.
 */

export interface DsnLink {
  station: string;      // Goldstone / Madrid / Canberra
  dish: string;         // DSS26
  spacecraft: string;   // friendly name
  spacecraftCode: string;
  direction: 'up' | 'down' | 'both';
  dataRateBps: number | null;
  band: string;         // X, Ka, S
}

const DSN_URL = 'https://eyes.nasa.gov/dsn/data/dsn.xml';

const STATION_NAMES: Record<string, string> = {
  gdscc: 'Goldstone',
  mdscc: 'Madrid',
  cdscc: 'Canberra',
};

// DSN spacecraft codes → familiar names (subset; unknown codes shown as-is)
const SPACECRAFT_NAMES: Record<string, string> = {
  JWST: 'James Webb',
  VGR1: 'Voyager 1',
  VGR2: 'Voyager 2',
  JNO: 'Juno',
  NHPC: 'New Horizons',
  MRO: 'Mars Reconnaissance Orbiter',
  M20: 'Perseverance',
  MSL: 'Curiosity',
  MVN: 'MAVEN',
  ODY: 'Mars Odyssey',
  LRO: 'Lunar Reconnaissance Orbiter',
  EURC: 'Europa Clipper',
  PSYC: 'Psyche',
  LUCY: 'Lucy',
  ORX: 'OSIRIS-APEX',
  PLSO: 'Parker Solar Probe',
  SOHO: 'SOHO',
  STA: 'STEREO-A',
  EMM: 'Hope (EMM)',
  TGO: 'ExoMars TGO',
  JCM: 'JUICE',
  HYB2: 'Hayabusa2',
  KPLO: 'Danuri (KPLO)',
  CHD3: 'Chandrayaan-3',
  ACE: 'ACE',
  WIND: 'Wind',
  GTL: 'Geotail',
  DSCO: 'DSCOVR',
  SPP: 'Parker Solar Probe',
  EM1: 'Artemis',
};

let dsnCache: { links: DsnLink[]; fetchedAt: number } | null = null;
const DSN_TTL = 60 * 1000; // refresh at most once a minute

export async function fetchDsnStatus(): Promise<DsnLink[]> {
  if (dsnCache && Date.now() - dsnCache.fetchedAt < DSN_TTL) {
    return dsnCache.links;
  }
  try {
    const res = await fetch(DSN_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = new DOMParser().parseFromString(await res.text(), 'text/xml');

    const links: DsnLink[] = [];
    let currentStation = '';

    for (const node of Array.from(xml.documentElement?.children ?? [])) {
      if (node.tagName === 'station') {
        currentStation = STATION_NAMES[node.getAttribute('name') ?? ''] ?? node.getAttribute('friendlyName') ?? '?';
      }
      if (node.tagName === 'dish') {
        const dish = node.getAttribute('name') ?? '?';
        // Collect active signals per spacecraft on this dish
        const perCraft = new Map<string, { up: boolean; down: boolean; rate: number | null; band: string }>();
        for (const sig of Array.from(node.children)) {
          if (sig.tagName !== 'upSignal' && sig.tagName !== 'downSignal') continue;
          if (sig.getAttribute('active') !== 'true') continue;
          const code = sig.getAttribute('spacecraft')?.toUpperCase() ?? '';
          if (!code || code === 'DSN' || code === 'DSS' || code === 'TEST') continue;
          const entry = perCraft.get(code) ?? { up: false, down: false, rate: null, band: '' };
          if (sig.tagName === 'upSignal') entry.up = true;
          else {
            entry.down = true;
            const rate = parseFloat(sig.getAttribute('dataRate') ?? '');
            if (!isNaN(rate) && rate > 0) entry.rate = rate;
          }
          entry.band = sig.getAttribute('band') || entry.band;
          perCraft.set(code, entry);
        }
        for (const [code, e] of perCraft) {
          links.push({
            station: currentStation,
            dish,
            spacecraft: SPACECRAFT_NAMES[code] ?? code,
            spacecraftCode: code,
            direction: e.up && e.down ? 'both' : e.up ? 'up' : 'down',
            dataRateBps: e.rate,
            band: e.band,
          });
        }
      }
    }

    dsnCache = { links, fetchedAt: Date.now() };
    return links;
  } catch (err) {
    console.warn('[SKYPORT] DSN fetch failed:', err);
    return dsnCache?.links ?? [];
  }
}

/** "160 b/s" / "1.2 kb/s" / "2.0 Mb/s" */
export function formatDataRate(bps: number | null): string {
  if (bps === null) return '—';
  if (bps >= 1e6) return `${(bps / 1e6).toFixed(1)} Mb/s`;
  if (bps >= 1e3) return `${(bps / 1e3).toFixed(1)} kb/s`;
  return `${Math.round(bps)} b/s`;
}
