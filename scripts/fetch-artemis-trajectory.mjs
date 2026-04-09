#!/usr/bin/env node
/**
 * Fetch Artemis II (Orion) real trajectory from JPL Horizons
 * and convert to scene coordinates for the Skyport 3D visualizer.
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
const SCENE_MOON_R = 20;   // scene units (matches earth-scene.tsx)
const MISSION_START_MS = Date.UTC(2026, 3, 1, 22, 35, 0); // Apr 1, 2026 22:35 UTC

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

async function queryHorizons(command, label) {
  console.log(`  Fetching ${label} (COMMAND='${command}')...`);
  const params = [
    `format=text`,
    `COMMAND='${command}'`,
    `CENTER='500@399'`,
    `MAKE_EPHEM='YES'`,
    `TABLE_TYPE='VECTORS'`,
    `START_TIME='2026-04-02 02:00'`,
    `STOP_TIME='2026-04-10 23:00'`,
    `STEP_SIZE='15 min'`,
    `OUT_UNITS='KM-S'`,
    `REF_SYSTEM='J2000'`,
    `CSV_FORMAT='YES'`,
  ].join('&');

  const res = await fetch(`${HORIZONS_URL}?${params}`);
  if (!res.ok) throw new Error(`Horizons returned ${res.status} for ${label}`);

  const text = await res.text();
  const vectors = parseVectors(text);
  console.log(`  Got ${vectors.length} state vectors for ${label}`);
  return vectors;
}

function toSceneCoords(orion, moon) {
  const EARTH_SURFACE = 2.0;
  const EARTH_CLEAR = 2.5;
  const MOON_POS = SCENE_MOON_R; // 20
  const MOON_RADIUS = 0.55;
  const MOON_MIN_R = MOON_RADIUS + 0.65;

  // ── Step 1: Build a FIXED reference frame from Moon's position at flyby ──
  // Using a rotating frame causes huge distortion near Earth because the Moon
  // moves ~132° during the 10-day mission. Instead, we fix the frame to the
  // Moon's position at closest approach so the trajectory looks clean.

  // Find flyby time (max Orion distance from Earth ≈ near Moon)
  let flybyIdx = 0;
  let maxOrionDist = 0;
  for (let i = 0; i < orion.length; i++) {
    const d = Math.sqrt(orion[i].x ** 2 + orion[i].y ** 2 + orion[i].z ** 2);
    if (d > maxOrionDist) { maxOrionDist = d; flybyIdx = i; }
  }

  // Moon's ECI position + velocity at flyby → defines our fixed basis
  const mf = moon[flybyIdx];
  const mfd = Math.sqrt(mf.x ** 2 + mf.y ** 2 + mf.z ** 2);
  const ex = { x: mf.x / mfd, y: mf.y / mfd, z: mf.z / mfd }; // toward Moon at flyby

  const lx = mf.y * mf.vz - mf.z * mf.vy;
  const ly = mf.z * mf.vx - mf.x * mf.vz;
  const lz = mf.x * mf.vy - mf.y * mf.vx;
  const lm = Math.sqrt(lx * lx + ly * ly + lz * lz);
  const ez = { x: lx / lm, y: ly / lm, z: lz / lm }; // orbit normal
  const ey = {
    x: ez.y * ex.z - ez.z * ex.y,
    y: ez.z * ex.x - ez.x * ex.z,
    z: ez.x * ex.y - ez.y * ex.x,
  }; // in-plane perpendicular

  // Fixed scale: Moon distance at flyby → 20 scene units
  const scale = SCENE_MOON_R / mfd;

  console.log(`  Fixed frame from flyby at point ${flybyIdx} (Moon dist ${(mfd/1000).toFixed(0)}k km)`);

  // ── Step 2: Project all Orion points into this fixed frame ──
  const raw = [];
  for (let i = 0; i < orion.length; i++) {
    const o = orion[i];
    const alpha = o.x * ex.x + o.y * ex.y + o.z * ex.z; // toward Moon
    const beta  = o.x * ey.x + o.y * ey.y + o.z * ey.z; // perpendicular in plane
    const gamma = o.x * ez.x + o.y * ez.y + o.z * ez.z; // out of plane

    let sx = alpha * scale;  // scene X (toward Moon)
    let sy = gamma * scale;  // scene Y (up)
    let sz = beta * scale;   // scene Z (perpendicular)

    // Clamp near Moon surface
    const dx = sx - MOON_POS, dy = sy, dz = sz;
    const moonDist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (moonDist > 0.01 && moonDist < MOON_MIN_R) {
      const f = MOON_MIN_R / moonDist;
      sx = MOON_POS + dx * f;
      sy = dy * f;
      sz = dz * f;
    }

    const epochMs = (o.jd - 2440587.5) * 86400000;
    const hour = (epochMs - MISSION_START_MS) / 3600000;
    const distKm = Math.sqrt(o.x * o.x + o.y * o.y + o.z * o.z);
    const velKmS = Math.sqrt(o.vx * o.vx + o.vy * o.vy + o.vz * o.vz);

    raw.push({ sx, sy, sz, hour: Math.max(0, hour), distKm, velKmS });
  }

  // ── Step 3: Trim near-Earth points ──
  // The trajectory before TLI (~hour 26) includes elliptical Earth orbits that
  // loop back near Earth. Find the LAST near-Earth dip in the first half of the
  // data — everything before that is pre-TLI orbit and should be skipped.
  const halfLen = Math.floor(raw.length / 2);
  let lastDipIdx = 0;
  for (let i = 0; i < halfLen; i++) {
    const r = Math.sqrt(raw[i].sx ** 2 + raw[i].sy ** 2 + raw[i].sz ** 2);
    if (r < EARTH_CLEAR) lastDipIdx = i;
  }

  // First valid outbound point: first point at r >= EARTH_CLEAR AFTER the last dip
  let firstOutIdx = lastDipIdx + 1;
  for (let i = lastDipIdx + 1; i < raw.length; i++) {
    if (Math.sqrt(raw[i].sx ** 2 + raw[i].sy ** 2 + raw[i].sz ** 2) >= EARTH_CLEAR) {
      firstOutIdx = i; break;
    }
  }

  // Last valid return point
  let lastOutIdx = raw.length - 1;
  for (let i = raw.length - 1; i >= 0; i--) {
    if (Math.sqrt(raw[i].sx ** 2 + raw[i].sy ** 2 + raw[i].sz ** 2) >= EARTH_CLEAR) {
      lastOutIdx = i; break;
    }
  }

  console.log(`  Trimmed pre-TLI orbit: skipped points 0-${lastDipIdx} (hours 0-${raw[lastDipIdx]?.hour.toFixed(0) || '?'})`);
  console.log(`  Trajectory starts at point ${firstOutIdx} (hour ${raw[firstOutIdx]?.hour.toFixed(1) || '?'})`);
  console.log(`  Trajectory ends at point ${lastOutIdx} (hour ${raw[lastOutIdx]?.hour.toFixed(1) || '?'})`);

  // ── Step 4: Build final trajectory ──
  const pts = [];

  // Departure point on Earth surface aimed toward first outbound point
  const fo = raw[firstOutIdx];
  const foR = Math.sqrt(fo.sx ** 2 + fo.sy ** 2 + fo.sz ** 2);
  const ds = EARTH_SURFACE / foR;
  pts.push({
    x: parseFloat((fo.sx * ds).toFixed(6)),
    y: parseFloat((fo.sy * ds).toFixed(6)),
    z: parseFloat((fo.sz * ds).toFixed(6)),
    hour: 0, distanceKm: 200, velocityKmS: 7.8,
  });

  // All outbound → flyby → return points
  for (let i = firstOutIdx; i <= lastOutIdx; i++) {
    const p = raw[i];
    pts.push({
      x: parseFloat(p.sx.toFixed(6)),
      y: parseFloat(p.sy.toFixed(6)),
      z: parseFloat(p.sz.toFixed(6)),
      hour: parseFloat(p.hour.toFixed(4)),
      distanceKm: parseFloat(p.distKm.toFixed(1)),
      velocityKmS: parseFloat(p.velKmS.toFixed(4)),
    });
  }

  // Arrival point on Earth surface
  const lo = raw[lastOutIdx];
  const loR = Math.sqrt(lo.sx ** 2 + lo.sy ** 2 + lo.sz ** 2);
  const as = EARTH_SURFACE / loR;
  pts.push({
    x: parseFloat((lo.sx * as).toFixed(6)),
    y: parseFloat((lo.sy * as).toFixed(6)),
    z: parseFloat((lo.sz * as).toFixed(6)),
    hour: parseFloat(raw[raw.length - 1].hour.toFixed(4)),
    distanceKm: 200, velocityKmS: 11.0,
  });

  return pts;
}

async function main() {
  console.log('[ARTEMIS] Fetching real trajectory from JPL Horizons...');
  console.log(`  Orion ID: ${ORION_CMD} | Moon ID: ${MOON_CMD}`);
  console.log(`  Mission start: ${new Date(MISSION_START_MS).toISOString()}`);
  console.log('');

  const [orion, moon] = await Promise.all([
    queryHorizons(ORION_CMD, 'Orion MPCV'),
    queryHorizons(MOON_CMD, 'Moon'),
  ]);

  if (!orion.length) {
    console.error('[ARTEMIS] ERROR: No Orion data returned from Horizons.');
    console.error('  The spacecraft ID -1024 may not exist yet or the mission dates may be off.');
    console.error('  The app will use parametric fallback trajectory.');
    process.exit(1);
  }

  console.log('\n  Converting to scene coordinates (Earth-Moon rotating frame)...');
  const trajectory = toSceneCoords(orion, moon);

  const output = {
    trajectory,
    source: 'JPL Horizons',
    orionId: ORION_CMD,
    noradId: 68538,
    cospar: '2026-069A',
    missionStart: new Date(MISSION_START_MS).toISOString(),
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

  // Print trajectory summary
  if (trajectory.length > 0) {
    const first = trajectory[0];
    const last = trajectory[trajectory.length - 1];
    const maxDist = Math.max(...trajectory.map(p => p.distanceKm));
    console.log(`  Time range: T+${first.hour.toFixed(1)}h to T+${last.hour.toFixed(1)}h`);
    console.log(`  Max distance: ${(maxDist / 1000).toFixed(0)}k km`);
    console.log(`  Velocity range: ${Math.min(...trajectory.map(p => p.velocityKmS)).toFixed(2)} - ${Math.max(...trajectory.map(p => p.velocityKmS)).toFixed(2)} km/s`);
  }
}

main().catch(err => {
  console.error('[ARTEMIS] Fatal error:', err.message);
  process.exit(1);
});
