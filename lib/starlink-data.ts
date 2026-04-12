/**
 * starlink-data.ts
 *
 * Starlink constellation orbital parameters, Keplerian propagation,
 * and laser link topology for the 3D simulation.
 *
 * Shell 1 (primary): 550 km, 53° inclination, 22 planes × 72 sats = 1,584 total
 * Source: FCC filings + SpaceX public data
 */

// ─── Constellation Constants ────────────────────────────────

export const STARLINK_COLOR = '#B0C4DE'; // Light steel blue — the sats look silvery-white
export const STARLINK_LINK_COLOR = '#4FC3F7'; // Light blue for laser links

/** Shell 1: the primary operational shell */
export const ALTITUDE_KM = 550;
export const INCLINATION_DEG = 53;
export const NUM_PLANES = 22;
export const SATS_PER_PLANE = 72;
export const TOTAL_SATS = NUM_PLANES * SATS_PER_PLANE; // 1,584

/** Physical constants */
const MU_EARTH = 398600.4418; // km³/s² — Earth gravitational parameter
const R_EARTH = 6371; // km
const ORBIT_RADIUS_KM = R_EARTH + ALTITUDE_KM; // 6921 km
const ORBITAL_PERIOD = 2 * Math.PI * Math.sqrt(ORBIT_RADIUS_KM ** 3 / MU_EARTH); // ~5732 seconds ≈ 95.5 min
export const MEAN_MOTION = (2 * Math.PI) / ORBITAL_PERIOD; // rad/s

/** Visual scene radius — matches getOrbitRadius(550) in earth-scene.tsx */
// LEO: 160-2000 km maps to 2.3-3.5 scene units
const LEO_MIN_ALT = 160;
const LEO_MAX_ALT = 2000;
const LEO_MIN_R = 2.3;
const LEO_MAX_R = 3.5;
const t = (ALTITUDE_KM - LEO_MIN_ALT) / (LEO_MAX_ALT - LEO_MIN_ALT);
export const SCENE_ORBIT_RADIUS = LEO_MIN_R + t * (LEO_MAX_R - LEO_MIN_R); // ≈ 2.554

const INCLINATION_RAD = (INCLINATION_DEG * Math.PI) / 180;

// Pre-computed trig for inclination (constant for all sats)
const COS_INC = Math.cos(INCLINATION_RAD);
const SIN_INC = Math.sin(INCLINATION_RAD);

// ─── Per-satellite orbital elements (pre-computed once) ──────

export interface SatOrbitalElements {
  planeIdx: number;
  satIdx: number;
  raan: number; // Right Ascension of Ascending Node (rad)
  phaseOffset: number; // Initial mean anomaly offset (rad)
  cosRaan: number;
  sinRaan: number;
}

/** Pre-computed orbital elements for all 1,584 satellites */
export const ORBITAL_ELEMENTS: SatOrbitalElements[] = (() => {
  const elements: SatOrbitalElements[] = [];
  for (let p = 0; p < NUM_PLANES; p++) {
    const raan = (p / NUM_PLANES) * 2 * Math.PI;
    const cosR = Math.cos(raan);
    const sinR = Math.sin(raan);
    for (let s = 0; s < SATS_PER_PLANE; s++) {
      const phaseOffset = (s / SATS_PER_PLANE) * 2 * Math.PI;
      elements.push({
        planeIdx: p,
        satIdx: s,
        raan,
        phaseOffset,
        cosRaan: cosR,
        sinRaan: sinR,
      });
    }
  }
  return elements;
})();

// ─── Position computation ────────────────────────────────────

/**
 * Compute Three.js position for a Starlink satellite at a given time.
 * Uses Keplerian circular orbit propagation (no perturbations needed
 * for visual accuracy at this scale).
 *
 * @param elem Pre-computed orbital elements
 * @param simTimeSec Simulation Unix timestamp in seconds
 * @returns [x, y, z] in scene coordinates
 */
export function getStarlinkPosition(
  elem: SatOrbitalElements,
  simTimeSec: number
): [number, number, number] {
  // Mean anomaly at this time (modular to avoid precision loss)
  const orbits = (simTimeSec / ORBITAL_PERIOD) % 1;
  const meanAnomaly = elem.phaseOffset + orbits * 2 * Math.PI;

  // Position in orbital plane
  const cosM = Math.cos(meanAnomaly);
  const sinM = Math.sin(meanAnomaly);

  // Rotate: orbital plane → ECI (J2000)
  // x_eci = x_orb * cos(Ω) - y_orb * cos(i) * sin(Ω)
  // y_eci = x_orb * sin(Ω) + y_orb * cos(i) * cos(Ω)
  // z_eci = y_orb * sin(i)
  const eciX = cosM * elem.cosRaan - sinM * COS_INC * elem.sinRaan;
  const eciY = cosM * elem.sinRaan + sinM * COS_INC * elem.cosRaan;
  const eciZ = sinM * SIN_INC;

  // ECI unit vector → Three.js (scaled to scene orbit radius)
  // Three.x = ECI.x, Three.y = ECI.z (north up), Three.z = -ECI.y
  return [
    eciX * SCENE_ORBIT_RADIUS,
    eciZ * SCENE_ORBIT_RADIUS,
    -eciY * SCENE_ORBIT_RADIUS,
  ];
}

// ─── Laser link topology ─────────────────────────────────────

/**
 * Each Starlink satellite has 4 laser terminals:
 * - 2 intra-plane links (fore/aft neighbors in same orbital plane)
 * - 2 cross-plane links (nearest sats in adjacent orbital planes)
 *
 * Returns pairs of satellite indices [satA, satB] for unique links.
 */
export function computeLaserLinks(): [number, number][] {
  const links: [number, number][] = [];

  for (let p = 0; p < NUM_PLANES; p++) {
    const planeStart = p * SATS_PER_PLANE;

    for (let s = 0; s < SATS_PER_PLANE; s++) {
      const idx = planeStart + s;

      // Intra-plane: connect to next satellite in same plane (wraps around)
      const nextInPlane = planeStart + ((s + 1) % SATS_PER_PLANE);
      links.push([idx, nextInPlane]);

      // Cross-plane: connect to nearest sat in next plane (wraps around)
      const nextPlane = ((p + 1) % NUM_PLANES) * SATS_PER_PLANE;
      const crossIdx = nextPlane + s; // same slot index in adjacent plane
      links.push([idx, crossIdx]);
    }
  }

  return links;
}

/** Pre-computed laser link pairs */
export const LASER_LINKS = computeLaserLinks();
// Total: 1,584 intra-plane + 1,584 cross-plane = 3,168 unique links

// ─── Selected satellite interface ────────────────────────────

export interface SelectedStarlinkSat {
  instanceId: number;
  planeIdx: number;
  satIdx: number;
  raan: number; // radians
}

// ─── Orbit ring computation ─────────────────────────────────

/**
 * Compute 3D points for a full orbital ring of a given plane.
 * Used to draw the orbit path when a Starlink satellite is selected.
 */
export function getOrbitRingPoints(raan: number, numPoints = 180): [number, number, number][] {
  const cosRaan = Math.cos(raan);
  const sinRaan = Math.sin(raan);
  const points: [number, number, number][] = [];

  for (let i = 0; i <= numPoints; i++) {
    const theta = (i / numPoints) * 2 * Math.PI;
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);

    // Position in ECI
    const eciX = SCENE_ORBIT_RADIUS * (cosRaan * cosT - sinRaan * sinT * COS_INC);
    const eciY = SCENE_ORBIT_RADIUS * (sinRaan * cosT + cosRaan * sinT * COS_INC);
    const eciZ = SCENE_ORBIT_RADIUS * sinT * SIN_INC;

    // ECI → Three.js
    points.push([eciX, eciZ, -eciY]);
  }
  return points;
}

// ─── Constellation info ──────────────────────────────────────
// Sources: FCC filings (Gen1 modification DA 19-342), SpaceX public data,
// ITU filings, official launch manifests

export const STARLINK_SPECS = {
  // Operator
  operator: 'SpaceX',
  constellation: 'Starlink',
  shell: 'Shell 1 (Gen1)',
  variant: 'v2 Mini',

  // Constellation stats
  totalOnOrbit: '~6,400',     // operational as of early 2025
  totalLaunched: '~7,000+',   // cumulative
  simulatedCount: TOTAL_SATS,
  coverage: '75+ countries',
  subscribers: '4M+',

  // Orbital parameters
  altitudeKm: ALTITUDE_KM,
  inclinationDeg: INCLINATION_DEG,
  orbitalPlanes: NUM_PLANES,
  satsPerPlane: SATS_PER_PLANE,
  orbitalPeriodMin: +(ORBITAL_PERIOD / 60).toFixed(1),
  velocityKmS: +((2 * Math.PI * ORBIT_RADIUS_KM) / ORBITAL_PERIOD).toFixed(2),

  // Satellite specs (from FCC filings + SpaceX data)
  launchMassKg: '~800',
  bodyDimensions: '4.1m × 2.7m',
  solarArraySpan: '~30m',
  powerKw: '12–14',
  propulsion: 'Hall-effect (Krypton)',
  designLifeYears: '~5',
  perSatThroughputGbps: '60–80',

  // Communication
  laserTerminals: 4,
  intraPlaneLinks: 2,
  crossPlaneLinks: 2,
  laserLinksTotal: LASER_LINKS.length,
  userBand: 'Ku-band (10.7–12.7 / 14.0–14.5 GHz)',
  gatewayBand: 'Ka-band (17.8–19.3 / 27.5–30.0 GHz)',

  // Launch
  launchVehicle: 'Falcon 9',
  satsPerLaunch: 21,
};
