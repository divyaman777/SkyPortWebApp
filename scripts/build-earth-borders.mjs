#!/usr/bin/env node
/**
 * Pre-process GeoJSON country/state borders into a compact local file
 * that's imported directly by earth-scene.tsx — no runtime fetch, borders
 * render instantly on first frame.
 *
 * Usage: node scripts/build-earth-borders.mjs
 * Output: lib/earth-borders.json
 */

import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const WORLD_GEOJSON_URL = 'https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json';
const INDIA_GEOJSON_URL = 'https://raw.githubusercontent.com/AbhinavSwami28/india-official-geojson/main/india-states-simplified.geojson';

function extractRings(feature, out) {
  const g = feature.geometry;
  if (!g) return;
  const pushRing = (ring) => {
    if (ring.length > 2) {
      // Round to 3 decimals (~100m precision at equator) to shrink file
      out.push(ring.map(([lon, lat]) => [Number(lon.toFixed(3)), Number(lat.toFixed(3))]));
    }
  };
  if (g.type === 'Polygon') {
    for (const ring of g.coordinates) pushRing(ring);
  } else if (g.type === 'MultiPolygon') {
    for (const polygon of g.coordinates) {
      for (const ring of polygon) pushRing(ring);
    }
  }
}

async function main() {
  console.log('[BORDERS] Fetching GeoJSON sources...');
  const [worldRes, indiaRes] = await Promise.all([
    fetch(WORLD_GEOJSON_URL),
    fetch(INDIA_GEOJSON_URL),
  ]);

  if (!worldRes.ok) throw new Error(`World GeoJSON fetch failed: ${worldRes.status}`);
  if (!indiaRes.ok) throw new Error(`India GeoJSON fetch failed: ${indiaRes.status}`);

  const worldData = await worldRes.json();
  const indiaData = await indiaRes.json();

  // Remove incorrect India and Pakistan from world data (matches existing logic)
  const filtered = worldData.features.filter((f) => {
    const name = (f.properties?.name || '').toLowerCase();
    return name !== 'india' && name !== 'pakistan';
  });

  const rings = [];
  for (const f of filtered) extractRings(f, rings);
  for (const f of indiaData.features) extractRings(f, rings);

  const output = { rings };
  const outPath = resolve(__dirname, '..', 'lib', 'earth-borders.json');
  writeFileSync(outPath, JSON.stringify(output));

  const sizeKB = (Buffer.byteLength(JSON.stringify(output)) / 1024).toFixed(1);
  console.log(`[BORDERS] Wrote ${rings.length} line rings to lib/earth-borders.json (${sizeKB} KB)`);
}

main().catch((err) => {
  console.error('[BORDERS] Fatal:', err.message);
  process.exit(1);
});
