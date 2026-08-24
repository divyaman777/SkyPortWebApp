#!/usr/bin/env node
/**
 * Fetch Artemis II (Orion) real trajectory from JPL Horizons
 * and convert to scene coordinates for the Skyport 3D visualizer.
 *
 * The trajectory is stored in the SCENE'S ECI FRAME — the same axis mapping
 * (ECI X → scene X, ECI Z → scene Y, ECI Y → -scene Z) and the same radial
 * compression used by earth-scene.tsx for satellites and the Moon. That way
 * Orion, the Earth's rotation, the Moon (astronomy-engine), and the TLE
 * satellites all live in one consistent space, and during playback the whole
 * scene can replay the mission window together.
 *
 * Usage: node scripts/fetch-artemis-trajectory.mjs
 * Output: public/artemis-live-trajectory.json
 */

import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HORIZONS_URL = 'https://ssd.jpl.nasa.gov/api/horizons.api';
const ORION_CMD = '-1024'; // Artemis II / Orion MPCV (Integrity)
const MOON_CMD = '301';    // Earth's Moon
const MISSION_START_MS = Date.UTC(2026, 3, 1, 22, 35, 12); // Apr 1, 2026 22:35:12 UTC (actual launch)

// Horizons ephemeris coverage for -1024 (post-mission reconstruction):
// 2026-Apr-02 01:58 TDB through 2026-Apr-10 23:51 TDB — the first ~3.4 h
// (launch + LEO checkout) are not in Horizons, so we prepend a synthetic
// launch point at KSC's actual ECI position at liftoff.
const START_TIME = '2026-04-02 02:00';
const STOP_TIME = '2026-04-10 23:51';
const STEP_SIZE = '10 min';

// KSC LC-39B geodetic position
const KSC_LAT_DEG = 28.6272;
const KSC_LON_DEG = -80.6208;

/** Greenwich Mean Sidereal Time (radians) — standard IAU 1982-ish approximation */
function gmstRad(dateMs) {
  const jd = dateMs / 86400000 + 2440587.5;
  const T = (jd - 2451545.0) / 36525.0;
  let gmstDeg =
    280.46061837 +
    360.98564736629 * (jd - 2451545.0) +
    0.000387933 * T * T -
    (T * T * T) / 38710000.0;
  gmstDeg = ((gmstDeg % 360) + 360) % 360;
  return (gmstDeg * Math.PI) / 180;
}

// ── Scene radial compression — MUST match getOrbitRadius() in earth-scene.tsx ──
const EARTH_R_KM = 6371;
const MOON_MEAN_DIST_KM = 384400;
const MOON_MEAN_ALT_KM = MOON_MEAN_DIST_KM - EARTH_R_KM; // 378029
const SCENE_MOON_R = 20;
const SCENE_MOON_RADIUS = 0.55;

function radialMapKm(geocentricKm) {
  const alt = geocentricKm - EARTH_R_KM;
  if (alt <= 160) return 2.0 + Math.max(0, alt / 160) * 0.3; // surface → LEO floor
  if (alt <= 2000) return 2.3 + ((alt - 160) / (2000 - 160)) * (3.5 - 2.3);
  if (alt <= 35786) return 3.5 + ((alt - 2000) / (35786 - 2000)) * (4.5 - 3.5);
  // Beyond GEO: linear out to the Moon's mean distance at scene radius 20
  return 4.5 + ((alt - 35786) / (MOON_MEAN_ALT_KM - 35786)) * (SCENE_MOON_R - 4.5);
}

/** ECI (km) → scene coords: ECI X → x, ECI Z → y (north up), ECI Y → -z */
function eciToScene(x, y, z) {
  const r = Math.sqrt(x * x + y * y + z * z);
  const s = radialMapKm(r) / r;
  return { x: x * s, y: z * s, z: -y * s };
}

function parseVectors(raw) {
  const soe = raw.indexOf('$$SOE');
  const eoe = raw.indexOf('$$EOE');
  if (soe < 0 || eoe < 0) {
    console.error('No $$SOE/$$EOE markers found in Horizons response');
    console.error('Response excerpt:', raw.slice(0, 500));
    return [];
  }

  const block = raw.slice(soe + 5, eoe).trim();
  const results = [];

  for (const line of block.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    const cols = t.split(',').map(s => s.trim());
    if (cols.length < 8) continue;

    const jd = parseFloat(cols[0]);
    const x  = parseFloat(cols[2]);
    const y  = parseFloat(cols[3]);
    const z  = parseFloat(cols[4]);
    const vx = parseFloat(cols[5]);
    const vy = parseFloat(cols[6]);
    const vz = parseFloat(cols[7]);

    if (!isNaN(jd) && !isNaN(x) && !isNaN(vx)) {
      results.push({ jd, x, y, z, vx, vy, vz });
    }
  }
  return results;
}

async function queryHorizons(command, label, start = START_TIME, stop = STOP_TIME, step = STEP_SIZE) {
  console.log(`  Fetching ${label} (COMMAND='${command}', ${step} steps)...`);
  const params = [
    `format=text`,
    `COMMAND='${command}'`,
    `CENTER='500@399'`,
    `MAKE_EPHEM='YES'`,
    `TABLE_TYPE='VECTORS'`,
    `START_TIME='${start}'`,
    `STOP_TIME='${stop}'`,
    `STEP_SIZE='${step}'`,
    `OUT_UNITS='KM-S'`,
    `REF_SYSTEM='J2000'`,
    `REF_PLANE='FRAME'`, // Earth mean equator (equatorial J2000) — Horizons defaults to ECLIPTIC, which would twist the whole trajectory ~23.4° out of the scene's ECI frame
    `CSV_FORMAT='YES'`,
  ].join('&');

  let res = await fetch(`${HORIZONS_URL}?${encodeURI(params)}`);
  if (res.status === 503) {
    // Horizons rate-limits bursts — back off once and retry
    await new Promise(r => setTimeout(r, 5000));
    res = await fetch(`${HORIZONS_URL}?${encodeURI(params)}`);
  }
  if (!res.ok) throw new Error(`Horizons returned ${res.status} for ${label}`);

  const text = await res.text();
  const vectors = parseVectors(text);
  console.log(`  Got ${vectors.length} state vectors for ${label}`);
  return vectors;
}

/** Replace coarse points inside the dense window with the dense samples */
function mergeDense(coarse, dense) {
  if (!dense.length) return coarse;
  const lo = dense[0].jd, hi = dense[dense.length - 1].jd;
  return coarse
    .filter(p => p.jd < lo || p.jd > hi)
    .concat(dense)
    .sort((a, b) => a.jd - b.jd);
}

function toSceneTrajectory(orion, moon) {
  // Orion and Moon queries share START/STOP/STEP, so indices line up
  const pts = [];
  let periluneKm = Infinity;

  // Synthetic hour-0 point: KSC LC-39B's ECI direction at liftoff, on the
  // Earth's surface. With the scene Earth rotated to GMST(launch), this sits
  // exactly over the Cape.
  {
    const lat = (KSC_LAT_DEG * Math.PI) / 180;
    const lonEci = gmstRad(MISSION_START_MS) + (KSC_LON_DEG * Math.PI) / 180;
    const r = 2.01; // just above the scene Earth surface
    pts.push({
      x: parseFloat((r * Math.cos(lat) * Math.cos(lonEci)).toFixed(6)),
      y: parseFloat((r * Math.sin(lat)).toFixed(6)),
      z: parseFloat((-r * Math.cos(lat) * Math.sin(lonEci)).toFixed(6)),
      hour: 0,
      distanceKm: 0,
      velocityKmS: 0.4, // Earth-surface rotation speed at the Cape
    });
  }

  for (let i = 0; i < orion.length; i++) {
    const o = orion[i];
    const epochMs = (o.jd - 2440587.5) * 86400000;
    const hour = (epochMs - MISSION_START_MS) / 3600000;
    if (hour < 0) continue;

    const distKm = Math.sqrt(o.x * o.x + o.y * o.y + o.z * o.z);
    const velKmS = Math.sqrt(o.vx * o.vx + o.vy * o.vy + o.vz * o.vz);

    let s = eciToScene(o.x, o.y, o.z);

    // The scene Moon is rendered ~6x oversized (0.55 units vs true-scale 0.09),
    // so the real ~7,000 km flyby clearance would put Orion visually inside the
    // Moon sphere. Clamp only the RENDERED point away from the Moon's scene
    // position at that instant — distanceKm/velocityKmS stay untouched.
    const m = moon[i];
    if (m) {
      const moonDistKm = Math.sqrt(
        (o.x - m.x) ** 2 + (o.y - m.y) ** 2 + (o.z - m.z) ** 2
      );
      periluneKm = Math.min(periluneKm, moonDistKm);

      const ms = eciToScene(m.x, m.y, m.z);
      const dx = s.x - ms.x, dy = s.y - ms.y, dz = s.z - ms.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const MIN_CLEAR = SCENE_MOON_RADIUS + 0.2;
      if (d > 0.001 && d < MIN_CLEAR) {
        const f = MIN_CLEAR / d;
        s = { x: ms.x + dx * f, y: ms.y + dy * f, z: ms.z + dz * f };
      }
    }

    pts.push({
      x: parseFloat(s.x.toFixed(6)),
      y: parseFloat(s.y.toFixed(6)),
      z: parseFloat(s.z.toFixed(6)),
      hour: parseFloat(hour.toFixed(4)),
      distanceKm: parseFloat(distKm.toFixed(1)),
      velocityKmS: parseFloat(velKmS.toFixed(4)),
    });
  }

  return { pts, periluneKm };
}

async function main() {
  console.log('[ARTEMIS] Fetching real trajectory from JPL Horizons...');
  console.log(`  Orion ID: ${ORION_CMD} | Moon ID: ${MOON_CMD}`);
  console.log(`  Mission start: ${new Date(MISSION_START_MS).toISOString()}`);
  console.log('');

  // Coarse 10-min sweep of the whole mission, plus a dense 1-min window
  // around the perigee pass / TLI burn (hour ~24-27) where Orion moves at
  // ~10 km/s and 10-min sampling leaves visible corners in the path.
  const DENSE_START = '2026-04-02 21:30';
  const DENSE_STOP = '2026-04-03 03:00';
  // Sequential — Horizons rate-limits parallel bursts
  const orionCoarse = await queryHorizons(ORION_CMD, 'Orion MPCV');
  const moonCoarse = await queryHorizons(MOON_CMD, 'Moon');
  const orionDense = await queryHorizons(ORION_CMD, 'Orion MPCV (perigee/TLI dense)', DENSE_START, DENSE_STOP, '1 min');
  const moonDense = await queryHorizons(MOON_CMD, 'Moon (perigee/TLI dense)', DENSE_START, DENSE_STOP, '1 min');
  const orion = mergeDense(orionCoarse, orionDense);
  const moon = mergeDense(moonCoarse, moonDense);

  if (!orion.length) {
    console.error('[ARTEMIS] ERROR: No Orion data returned from Horizons.');
    console.error('  The app will use the parametric fallback trajectory.');
    process.exit(1);
  }

  console.log('\n  Converting to scene ECI coordinates...');
  const { pts: trajectory, periluneKm } = toSceneTrajectory(orion, moon);

  // Perilune above the lunar surface (Moon radius 1737.4 km)
  const periluneAltKm = Math.round(periluneKm - 1737.4);

  const output = {
    trajectory,
    source: 'JPL Horizons',
    frame: 'eci-scene', // scene-mapped ECI — checked at load time
    orionId: ORION_CMD,
    noradId: 68538,
    cospar: '2026-069A',
    missionStart: new Date(MISSION_START_MS).toISOString(),
    periluneAltKm,
    pointCount: trajectory.length,
    fetchedAt: new Date().toISOString(),
    hourRange: trajectory.length > 0
      ? [trajectory[0].hour, trajectory[trajectory.length - 1].hour]
      : [],
  };

  const outPath = resolve(__dirname, '..', 'public', 'artemis-live-trajectory.json');
  writeFileSync(outPath, JSON.stringify(output));

  const sizeKB = (Buffer.byteLength(JSON.stringify(output)) / 1024).toFixed(1);
  console.log(`\n[ARTEMIS] Wrote ${trajectory.length} points to public/artemis-live-trajectory.json (${sizeKB} KB)`);

  if (trajectory.length > 0) {
    const first = trajectory[0];
    const last = trajectory[trajectory.length - 1];
    const maxDist = Math.max(...trajectory.map(p => p.distanceKm));
    console.log(`  Time range: T+${first.hour.toFixed(1)}h to T+${last.hour.toFixed(1)}h`);
    console.log(`  Max distance: ${(maxDist / 1000).toFixed(0)}k km`);
    console.log(`  Perilune altitude: ${periluneAltKm.toLocaleString()} km above lunar surface`);
    console.log(`  Velocity range: ${Math.min(...trajectory.map(p => p.velocityKmS)).toFixed(2)} - ${Math.max(...trajectory.map(p => p.velocityKmS)).toFixed(2)} km/s`);
  }
}

main().catch(err => {
  console.error('[ARTEMIS] Fatal error:', err.message);
  process.exit(1);
});
