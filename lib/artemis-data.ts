/**
 * artemis-data.ts
 *
 * Artemis II mission constants, phase definitions, crew data,
 * and free-return trajectory generation for 3D visualization.
 */

// ─── Mission Constants ──────────────────────────────────────

export const ARTEMIS_COLOR = '#448AFF'; // Blue — distinct from LEO/MEO/GEO orbit colors

/** Mission start: April 1, 2026 22:35 UTC (actual SLS launch from KSC LC-39B) */
export const MISSION_START = new Date('2026-04-01T22:35:00Z');

/** Total mission duration in hours (~10 days) */
export const MISSION_DURATION_HOURS = 226;

/** Simulation playback: 1 real second = 2 mission hours */
export const SIM_HOURS_PER_SECOND = 2;

/** Closest approach to lunar surface in km */
export const PERILUNE_KM = 6513;

// ─── Scene-Scale Constants ──────────────────────────────────
// Must match earth-scene.tsx values

export const EARTH_RADIUS_SCENE = 2; // Three.js units
export const MOON_ORBIT_RADIUS = 20; // Three.js units (from earth-scene.tsx)
export const MOON_RADIUS_SCENE = 0.55; // Three.js units (from earth-scene.tsx)

/** Visual perilune clearance — Moon radius + buffer so path visibly clears the Moon */
export const PERILUNE_RADIUS_SCENE = MOON_RADIUS_SCENE + 0.6;

/** LEO departure altitude in scene units */
export const LEO_RADIUS_SCENE = 2.4;

// ─── Mission Phases ─────────────────────────────────────────

export interface MissionPhase {
  id: string;
  name: string;
  shortName: string;
  startHour: number;
  endHour: number;
  description: string;
  velocity: number; // approximate km/s during this phase
  color: string;
}

export const MISSION_PHASES: MissionPhase[] = [
  {
    id: 'launch',
    name: 'Launch & Earth Orbit',
    shortName: 'LAUNCH',
    startHour: 0,
    endHour: 2,
    description: 'SLS launches from Kennedy Space Center LC-39B. Orion reaches low Earth orbit for systems checkout.',
    velocity: 7.8,
    color: '#00FF41',
  },
  {
    id: 'tli',
    name: 'Trans-Lunar Injection',
    shortName: 'TLI',
    startHour: 2,
    endHour: 4,
    description: 'ICPS upper stage fires to accelerate Orion from LEO to trans-lunar velocity, escaping Earth orbit.',
    velocity: 10.8,
    color: '#FFB300',
  },
  {
    id: 'outbound',
    name: 'Outbound Transit',
    shortName: 'OUTBOUND',
    startHour: 4,
    endHour: 96,
    description: 'Orion coasts toward the Moon on a free-return trajectory. Crew conducts deep-space operations and system tests.',
    velocity: 3.5,
    color: ARTEMIS_COLOR,
  },
  {
    id: 'flyby',
    name: 'Lunar Flyby',
    shortName: 'FLYBY',
    startHour: 96,
    endHour: 106,
    description: 'Orion swings behind the far side of the Moon at closest approach of 6,513 km — the farthest humans have traveled from Earth since Apollo 17.',
    velocity: 1.2,
    color: '#FFFFFF',
  },
  {
    id: 'return',
    name: 'Return Transit',
    shortName: 'RETURN',
    startHour: 106,
    endHour: 220,
    description: 'Free-return trajectory brings Orion back toward Earth. Crew prepares for re-entry.',
    velocity: 4.0,
    color: ARTEMIS_COLOR,
  },
  {
    id: 'reentry',
    name: 'Earth Return & Splashdown',
    shortName: 'SPLASHDOWN',
    startHour: 220,
    endHour: 226,
    description: 'Orion re-enters atmosphere at ~11 km/s using skip re-entry, deploys parachutes, and splashes down in the Pacific Ocean.',
    velocity: 11.0,
    color: '#00D4FF',
  },
];

export function getCurrentPhase(elapsedHours: number): MissionPhase {
  for (const phase of MISSION_PHASES) {
    if (elapsedHours >= phase.startHour && elapsedHours < phase.endHour) {
      return phase;
    }
  }
  return MISSION_PHASES[MISSION_PHASES.length - 1];
}

// ─── Crew ───────────────────────────────────────────────────

export interface CrewMember {
  name: string;
  role: string;
  agency: string;
}

export const ARTEMIS_CREW: CrewMember[] = [
  { name: 'Reid Wiseman', role: 'Commander', agency: 'NASA' },
  { name: 'Victor Glover', role: 'Pilot', agency: 'NASA' },
  { name: 'Christina Koch', role: 'Mission Specialist 1', agency: 'NASA' },
  { name: 'Jeremy Hansen', role: 'Mission Specialist 2', agency: 'CSA' },
];

// ─── Trajectory Generation ──────────────────────────────────

export interface TrajectoryPoint {
  x: number;
  y: number;
  z: number;
  hour: number; // mission elapsed hours at this point
}

/**
 * Generate the full Artemis II free-return trajectory in scene coordinates.
 *
 * The trajectory forms an elongated figure-8:
 *   1. Earth departure arc (LEO → outward, curving up)
 *   2. Outbound coast (gentle arc, upper path toward Moon)
 *   3. Lunar flyby (semicircle around Moon's far side)
 *   4. Return coast (lower path back toward Earth)
 *   5. Earth arrival arc (converging back to LEO)
 *
 * Coordinate system (scene space):
 *   x = toward Moon (positive), y = up, z = lateral
 *   Earth at origin, Moon at (MOON_ORBIT_RADIUS, 0, 0)
 */
export function generateTrajectory(numPoints: number = 600): TrajectoryPoint[] {
  const points: TrajectoryPoint[] = [];
  const moonX = MOON_ORBIT_RADIUS;

  // Vertical separation between outbound (positive z) and return (negative z) paths
  const pathSpread = 1.8;

  // ── Phase 1: Earth departure spiral (hours 0–4) ───────────
  // From LEO orbit arc up to departure direction
  const departurePoints = Math.floor(numPoints * 0.05);
  for (let i = 0; i <= departurePoints; i++) {
    const t = i / departurePoints; // 0→1
    const hour = t * 4; // hours 0–4

    // Spiral outward from LEO
    const r = LEO_RADIUS_SCENE + t * 1.5;
    const angle = -Math.PI / 2 + t * Math.PI * 0.4; // arc from bottom up

    points.push({
      x: r * Math.cos(angle) + t * 2,
      y: 0,
      z: r * Math.sin(angle) + t * pathSpread * 0.5,
      hour,
    });
  }

  // ── Phase 2: Outbound transit (hours 4–96) ────────────────
  // Smooth Bezier-like curve from departure to near-Moon, upper path
  const outboundPoints = Math.floor(numPoints * 0.35);
  const departEnd = points[points.length - 1];
  for (let i = 1; i <= outboundPoints; i++) {
    const t = i / outboundPoints; // 0→1
    const hour = 4 + t * 92; // hours 4–96

    // Cubic interpolation with control points for gentle arc
    const cp1x = departEnd.x + (moonX - departEnd.x) * 0.3;
    const cp1z = pathSpread * 0.8;
    const cp2x = departEnd.x + (moonX - departEnd.x) * 0.7;
    const cp2z = pathSpread * 0.5;
    const endX = moonX - PERILUNE_RADIUS_SCENE;
    const endZ = PERILUNE_RADIUS_SCENE;

    // Cubic Bezier
    const mt = 1 - t;
    const x = mt * mt * mt * departEnd.x + 3 * mt * mt * t * cp1x + 3 * mt * t * t * cp2x + t * t * t * endX;
    const z = mt * mt * mt * departEnd.z + 3 * mt * mt * t * cp1z + 3 * mt * t * t * cp2z + t * t * t * endZ;

    points.push({ x, y: 0, z, hour });
  }

  // ── Phase 3: Lunar flyby — semicircle around far side (hours 96–106) ──
  // Arc from +z side → far side → -z side (around x > moonX)
  const flybyPoints = Math.floor(numPoints * 0.15);
  for (let i = 1; i <= flybyPoints; i++) {
    const t = i / flybyPoints; // 0→1
    const hour = 96 + t * 10; // hours 96–106

    // Semicircular arc: angle from +90° to -90° (far side of Moon)
    const angle = (Math.PI / 2) - t * Math.PI; // π/2 → -π/2
    const x = moonX + Math.cos(angle) * PERILUNE_RADIUS_SCENE;
    const z = Math.sin(angle) * PERILUNE_RADIUS_SCENE;

    points.push({ x, y: 0, z, hour });
  }

  // ── Phase 4: Return transit (hours 106–220) ───────────────
  // Lower path (negative z) from near-Moon back to Earth
  const returnPoints = Math.floor(numPoints * 0.35);
  const returnStart = points[points.length - 1];
  const returnEndX = LEO_RADIUS_SCENE + 1.5;
  const returnEndZ = -pathSpread * 0.5;
  for (let i = 1; i <= returnPoints; i++) {
    const t = i / returnPoints; // 0→1
    const hour = 106 + t * 114; // hours 106–220

    // Cubic Bezier return path (mirror of outbound, lower)
    const cp1x = returnStart.x - (returnStart.x - returnEndX) * 0.3;
    const cp1z = -pathSpread * 0.5;
    const cp2x = returnStart.x - (returnStart.x - returnEndX) * 0.7;
    const cp2z = -pathSpread * 0.8;

    const mt = 1 - t;
    const x = mt * mt * mt * returnStart.x + 3 * mt * mt * t * cp1x + 3 * mt * t * t * cp2x + t * t * t * returnEndX;
    const z = mt * mt * mt * returnStart.z + 3 * mt * mt * t * cp1z + 3 * mt * t * t * cp2z + t * t * t * returnEndZ;

    points.push({ x, y: 0, z, hour });
  }

  // ── Phase 5: Earth return spiral (hours 220–226) ──────────
  const arrivalPoints = Math.floor(numPoints * 0.05);
  const arriveStart = points[points.length - 1];
  for (let i = 1; i <= arrivalPoints; i++) {
    const t = i / arrivalPoints; // 0→1
    const hour = 220 + t * 6; // hours 220–226

    // Spiral inward to Earth
    const r = arriveStart.x * (1 - t) + LEO_RADIUS_SCENE * t;
    const angle = -Math.PI * 0.4 * t;

    points.push({
      x: r * Math.cos(angle) * (1 - t * 0.5),
      y: 0,
      z: arriveStart.z * (1 - t) + Math.sin(angle) * r * 0.3,
      hour,
    });
  }

  return points;
}

// ─── Helpers ────────────────────────────────────────────────

/** Get distance from Earth in km — uses live Horizons data when available. */
export function getDistanceFromEarth(elapsedHours: number): number {
  const live = interpolateLive(elapsedHours, 'distanceKm');
  if (live !== null) return live;

  // Fallback: approximate profile
  const t = Math.min(elapsedHours / MISSION_DURATION_HOURS, 1);
  const phase = getCurrentPhase(elapsedHours);

  // Rough distance profile (Earth surface = 0, Moon = 384,400 km)
  if (phase.id === 'launch') return 200 + (elapsedHours / 2) * 200;
  if (phase.id === 'tli') return 400 + ((elapsedHours - 2) / 2) * 5000;

  // Outbound: 5400 → ~384400
  if (phase.id === 'outbound') {
    const pt = (elapsedHours - 4) / 92;
    return 5400 + pt * (384400 - 5400);
  }
  // Flyby: near Moon
  if (phase.id === 'flyby') return 384400 - PERILUNE_KM + Math.abs(elapsedHours - 101) * 1000;

  // Return: ~384400 → 5400
  if (phase.id === 'return') {
    const pt = (elapsedHours - 106) / 114;
    return 384400 - pt * (384400 - 5400);
  }
  // Reentry: 5400 → 0
  const pt = (elapsedHours - 220) / 6;
  return 5400 * (1 - pt);
}

/** Get velocity in km/s — uses live Horizons data when available. */
export function getVelocity(elapsedHours: number): number {
  const live = interpolateLive(elapsedHours, 'velocityKmS');
  if (live !== null) return live;

  // Fallback: approximate interpolation between phases
  const phase = getCurrentPhase(elapsedHours);
  const phaseProgress = (elapsedHours - phase.startHour) / (phase.endHour - phase.startHour);

  // Smooth interpolation between phase start/end velocities
  const nextPhaseIdx = MISSION_PHASES.indexOf(phase) + 1;
  const nextVelocity = nextPhaseIdx < MISSION_PHASES.length
    ? MISSION_PHASES[nextPhaseIdx].velocity
    : phase.velocity;

  return phase.velocity + (nextVelocity - phase.velocity) * phaseProgress;
}

/** Format elapsed hours as T+Xd XXh XXm */
export function formatMET(elapsedHours: number): string {
  const totalSeconds = Math.max(0, elapsedHours * 3600);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  if (days > 0) {
    return `T+${days}d ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `T+${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/** Get interpolated position on trajectory for a given elapsed hour */
export function getPositionAtTime(trajectory: TrajectoryPoint[], elapsedHours: number): TrajectoryPoint {
  const clamped = Math.max(0, Math.min(elapsedHours, MISSION_DURATION_HOURS));

  // Find surrounding points
  for (let i = 0; i < trajectory.length - 1; i++) {
    if (trajectory[i].hour <= clamped && trajectory[i + 1].hour >= clamped) {
      const segT = (clamped - trajectory[i].hour) / (trajectory[i + 1].hour - trajectory[i].hour);
      return {
        x: trajectory[i].x + (trajectory[i + 1].x - trajectory[i].x) * segT,
        y: trajectory[i].y + (trajectory[i + 1].y - trajectory[i].y) * segT,
        z: trajectory[i].z + (trajectory[i + 1].z - trajectory[i].z) * segT,
        hour: clamped,
      };
    }
  }

  return trajectory[trajectory.length - 1];
}

/** Get trajectory point index closest to given elapsed hours */
export function getTrajectoryIndex(trajectory: TrajectoryPoint[], elapsedHours: number): number {
  const clamped = Math.max(0, Math.min(elapsedHours, MISSION_DURATION_HOURS));
  for (let i = 0; i < trajectory.length - 1; i++) {
    if (trajectory[i + 1].hour >= clamped) return i;
  }
  return trajectory.length - 1;
}

// ─── Live Trajectory Data (JPL Horizons) ──────────────────

export interface LiveTrajectoryPoint extends TrajectoryPoint {
  distanceKm: number;
  velocityKmS: number;
}

// Module-level cache for real ephemeris data
let _liveCache: LiveTrajectoryPoint[] | null = null;
let _liveSource: string | null = null;

export function getLiveTrajectory(): LiveTrajectoryPoint[] | null {
  return _liveCache;
}

export function getLiveDataSource(): string | null {
  return _liveSource;
}

/**
 * Fetch real Orion trajectory from pre-generated Horizons data.
 * Data is generated by: node scripts/fetch-artemis-trajectory.mjs
 * Falls back silently to parametric trajectory if file not found.
 */
export async function fetchLiveTrajectory(): Promise<LiveTrajectoryPoint[] | null> {
  if (_liveCache) return _liveCache;

  try {
    const res = await fetch('/artemis-live-trajectory.json');
    if (!res.ok) return null;

    const data = await res.json();
    if (!data.trajectory?.length) return null;

    _liveCache = data.trajectory as LiveTrajectoryPoint[];
    _liveSource = data.source || 'JPL Horizons';
    return _liveCache;
  } catch {
    return null;
  }
}

/** Interpolate a field from live trajectory data at given elapsed hours. */
function interpolateLive(
  elapsedHours: number,
  field: 'velocityKmS' | 'distanceKm',
): number | null {
  if (!_liveCache) return null;
  const h = Math.max(0, Math.min(elapsedHours, MISSION_DURATION_HOURS));

  for (let i = 0; i < _liveCache.length - 1; i++) {
    const a = _liveCache[i];
    const b = _liveCache[i + 1];
    if (a.hour <= h && b.hour >= h) {
      const t = (h - a.hour) / (b.hour - a.hour || 1);
      return a[field] + (b[field] - a[field]) * t;
    }
  }
  // Past the end — return last value
  if (_liveCache.length > 0) {
    return _liveCache[_liveCache.length - 1][field];
  }
  return null;
}
