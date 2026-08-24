'use client';

import { useRef, useState, useEffect, useMemo, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import { Satellite, categoryColors, SatelliteCategory } from '@/lib/satellite-data';
import { computeECIPosition, computeOrbitPathECI, computeMoonPositionECI, getJWSTPositionECI, getSunDirectionECI, getGMST } from '@/lib/satellite-engine';
import { trackMoonClick, trackOrbitZoneClick } from '@/lib/analytics';
import { registerPresence, subscribePresence, type ActiveUser } from '@/lib/presence';
import { getSimDate, getMoonSimDate, getSimTimeOverride } from '@/lib/sim-clock';
import { getObserverLocation } from '@/lib/observer-location';
import { ArtemisSimulation } from '@/components/simulations/artemis-ii-simulation';
import { StarlinkSimulation } from '@/components/simulations/starlink-simulation';
import { type SelectedStarlinkSat } from '@/lib/starlink-data';

// ─── Pre-processed GeoJSON Borders ──────────────────────────
// Borders are baked at build time by scripts/build-earth-borders.mjs
// so they render instantly with the Earth — no runtime fetch.
import borderData from '@/lib/earth-borders.json';

// Module-level cache so we only convert lat/lon → Vector3 once
let cachedBorderLines: THREE.Vector3[][] | null = null;

function getBorderLines(radius: number): THREE.Vector3[][] {
  if (cachedBorderLines) return cachedBorderLines;
  const lines: THREE.Vector3[][] = [];
  for (const ring of borderData.rings as [number, number][][]) {
    lines.push(ring.map(([lon, lat]) => latLonToVector3(lat, lon, radius)));
  }
  cachedBorderLines = lines;
  return lines;
}

interface EarthSceneProps {
  satellites: Satellite[];
  selectedSatellite: Satellite | null;
  onSatelliteClick: (satellite: Satellite) => void;
  onSatelliteHover: (satellite: Satellite | null, x: number, y: number) => void;
  filters: Record<SatelliteCategory, boolean>;
  isSimulating?: boolean;
  onSimElapsedUpdate?: (hours: number) => void;
  onOrionClick?: () => void;
  isOrionSelected?: boolean;
  isPlayback?: boolean;
  isStarlinkActive?: boolean;
  onStarlinkSelect?: (sat: SelectedStarlinkSat | null) => void;
  selectedStarlink?: SelectedStarlinkSat | null;
}

// Convert lat/lon to 3D position on sphere
function latLonToVector3(lat: number, lon: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  
  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const y = radius * Math.cos(phi);
  const z = radius * Math.sin(phi) * Math.sin(theta);
  
  return new THREE.Vector3(x, y, z);
}

// ─── ECI Coordinate Helpers ─────────────────────────────────
const EARTH_RADIUS_KM = 6371;

// Convert ECI satellite position to Three.js, scaling by visual orbit radius
function eciToThreeJSSat(eciX: number, eciY: number, eciZ: number): THREE.Vector3 {
  const distKm = Math.sqrt(eciX ** 2 + eciY ** 2 + eciZ ** 2);
  const altKm = distKm - EARTH_RADIUS_KM;
  const visualR = getOrbitRadius(altKm);
  const scale = visualR / distKm;
  // ECI X → Three X, ECI Z (north pole) → Three Y (up), ECI Y → -Three Z
  return new THREE.Vector3(eciX * scale, eciZ * scale, -eciY * scale);
}

// Convert ECI unit direction to Three.js position at given radius
function eciDirToThreeJS(eciX: number, eciY: number, eciZ: number, radius: number): THREE.Vector3 {
  const dist = Math.sqrt(eciX ** 2 + eciY ** 2 + eciZ ** 2);
  const scale = radius / dist;
  return new THREE.Vector3(eciX * scale, eciZ * scale, -eciY * scale);
}

// Simulation time comes from the shared clock in lib/sim-clock.ts so the
// UI panels and the 3D scene always agree (see TIME_SCALE / MOON_SPEED_MULT there).

// Sun — a directional light at the Sun's REAL position for the current sim
// time. Gives the Moon its true phase and every spacecraft correct shading.
// Follows mission time during replay.
function SunLight() {
  const lightRef = useRef<THREE.DirectionalLight>(null);

  useFrame(() => {
    if (!lightRef.current) return;
    const sun = getSunDirectionECI(getSimDate());
    const p = eciDirToThreeJS(sun.eciX, sun.eciY, sun.eciZ, 60);
    lightRef.current.position.set(p.x, p.y, p.z);
  });

  return <directionalLight ref={lightRef} intensity={2.0} color="#fff3e0" />;
}

// Procedural ocean texture — subtle deep blue variation over dark base
function generateOceanTexture(): HTMLCanvasElement {
  const W = 1024, H = 512;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Dark base matching the existing ocean color
  ctx.fillStyle = '#050a12';
  ctx.fillRect(0, 0, W, H);

  // Seeded random
  let seed = 137;
  const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

  // Large-scale ocean current / depth variation — soft blueish patches
  const patches = [
    { cx: 0.15, cy: 0.45, rx: 0.18, ry: 0.14 },  // Pacific
    { cx: 0.85, cy: 0.50, rx: 0.12, ry: 0.16 },  // Indian Ocean
    { cx: 0.48, cy: 0.55, rx: 0.10, ry: 0.12 },  // Atlantic south
    { cx: 0.45, cy: 0.35, rx: 0.08, ry: 0.10 },  // Atlantic north
    { cx: 0.10, cy: 0.60, rx: 0.14, ry: 0.10 },  // South Pacific
    { cx: 0.70, cy: 0.40, rx: 0.09, ry: 0.08 },  // Arabian Sea
    { cx: 0.25, cy: 0.30, rx: 0.11, ry: 0.09 },  // North Pacific
    { cx: 0.60, cy: 0.70, rx: 0.13, ry: 0.08 },  // Southern Ocean
  ];

  for (const p of patches) {
    const cx = p.cx * W, cy = p.cy * H;
    const rx = p.rx * W, ry = p.ry * H;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, ry / rx);
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    grad.addColorStop(0, 'rgba(8,22,42,0.9)');
    grad.addColorStop(0.4, 'rgba(6,18,35,0.6)');
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Medium scattered blue shimmer spots
  for (let i = 0; i < 120; i++) {
    const x = rand() * W, y = rand() * H;
    const r = 8 + rand() * 20;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    const blue = Math.floor(30 + rand() * 25);
    const green = Math.floor(12 + rand() * 10);
    grad.addColorStop(0, `rgba(${Math.floor(4 + rand() * 4)},${green},${blue},${0.3 + rand() * 0.25})`);
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Fine pixel-level noise for subtle texture
  const imgData = ctx.getImageData(0, 0, W, H);
  const d = imgData.data;
  for (let i = 0; i < d.length; i += 4) {
    // Add slight blue-biased noise
    const n = (rand() - 0.5) * 6;
    d[i] = Math.max(0, Math.min(255, d[i] + n * 0.5));       // R: minimal
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n * 0.7)); // G: slight
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n * 1.2)); // B: most variation
  }
  ctx.putImageData(imgData, 0, 0);

  return canvas;
}

// Earth component with accurate GeoJSON country borders
function Earth() {
  const earthRef = useRef<THREE.Group>(null);
  // Borders are pre-baked & bundled — computed synchronously, ready on first render
  const borderLines = useMemo(() => getBorderLines(2.01), []);

  useFrame(() => {
    if (earthRef.current) {
      earthRef.current.rotation.y = getGMST(getSimDate());
    }
  });

  // Procedural ocean texture with subtle blue variation
  const oceanTexture = useMemo(() => {
    const canvas = generateOceanTexture();
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);

  return (
    <group ref={earthRef}>
      {/* Ocean sphere - deep dark blue with subtle water variation */}
      <mesh>
        <sphereGeometry args={[2, 128, 128]} />
        <meshStandardMaterial
          map={oceanTexture}
          roughness={0.85}
          metalness={0.15}
        />
      </mesh>

      {/* Country/continent borders from GeoJSON */}
      {borderLines.map((points, i) => (
        <Line
          key={`border-${i}`}
          points={points}
          color="#40E0D0"
          lineWidth={1.2}
          opacity={0.9}
          transparent
        />
      ))}

      {/* Earth edge glow - visible bright rim */}
      <mesh>
        <sphereGeometry args={[2.03, 64, 64]} />
        <meshBasicMaterial
          color="#00FFFF"
          transparent
          opacity={0.12}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Atmosphere glow */}
      <mesh>
        <sphereGeometry args={[2.08, 64, 64]} />
        <meshBasicMaterial
          color="#00AAFF"
          transparent
          opacity={0.06}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Outer atmosphere for depth */}
      <mesh>
        <sphereGeometry args={[2.18, 64, 64]} />
        <meshBasicMaterial
          color="#004488"
          transparent
          opacity={0.04}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Lat/lon grid — Earth-fixed, so it must rotate with the surface */}
      <GridLines />

      {/* Live user presence dots */}
      <UserPresenceDots />

      {/* Observer location marker */}
      <ObserverMarker />
    </group>
  );
}

// Observer location marker on Earth
function ObserverMarker() {
  const markerRef = useRef<THREE.Group>(null);
  // null until geolocation succeeds — no marker shown for unknown locations
  const [observer, setObserver] = useState<{ lat: number; lon: number } | null>(null);

  // Get approximate location from IP address (no permission popup) and register presence
  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | null = null;

    getObserverLocation().then(loc => {
      if (!loc) return;
      if (cancelled) return; // unmounted while the fetch was in flight
      setObserver({ lat: loc.lat, lon: loc.lon });
      // Register presence in Firebase for live user density map
      cleanup = registerPresence(loc.lat, loc.lon);
    });

    return () => {
      cancelled = true;
      if (cleanup) cleanup();
    };
  }, []);

  // Position on Earth surface, with quaternion pointing the pin outward
  const { position, quaternion } = useMemo(() => {
    const pos = latLonToVector3(observer?.lat ?? 0, observer?.lon ?? 0, 2.015);
    const q = new THREE.Quaternion();
    q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), pos.clone().normalize());
    return { position: pos, quaternion: q };
  }, [observer]);

  useFrame((state) => {
    if (markerRef.current) {
      const pulse = 0.8 + Math.sin(state.clock.getElapsedTime() * 4) * 0.2;
      markerRef.current.scale.setScalar(pulse);
    }
  });

  if (!observer) return null;

  return (
    <group position={position} quaternion={quaternion}>
      <group ref={markerRef}>
        {/* Pin point — small diamond shape */}
        <mesh position={[0, 0.012, 0]}>
          <octahedronGeometry args={[0.01, 0]} />
          <meshBasicMaterial color="#FF4444" />
        </mesh>
        {/* Tiny base ring on surface */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.012, 0.016, 16]} />
          <meshBasicMaterial color="#FF4444" transparent opacity={0.5} side={THREE.DoubleSide} />
        </mesh>
      </group>
      {/* Label */}
      <Html position={[0, 0.05, 0]} center>
        <div className="bg-[rgba(0,0,0,0.85)] border border-[rgba(255,68,68,0.4)] px-1.5 py-0.5 rounded text-[10px] whitespace-nowrap">
          <span className="text-[#FF4444] font-mono">YOU</span>
        </div>
      </Html>
    </group>
  );
}

// Live user presence dots — tiny subtle dots showing other active users on the globe
function UserPresenceDots() {
  const [users, setUsers] = useState<ActiveUser[]>([]);

  useEffect(() => {
    const unsubscribe = subscribePresence(setUsers);
    return unsubscribe;
  }, []);

  // Pre-compute positions for all users, placed just above Earth surface
  const dots = useMemo(() => {
    return users.map((u, i) => ({
      key: `${u.lat.toFixed(1)}-${u.lon.toFixed(1)}-${i}`,
      position: latLonToVector3(u.lat, u.lon, 2.015),
    }));
  }, [users]);

  if (dots.length === 0) return null;

  return (
    <group>
      {dots.map(dot => (
        <mesh key={dot.key} position={dot.position}>
          <sphereGeometry args={[0.006, 6, 6]} />
          <meshBasicMaterial color="#E0E0E0" transparent opacity={0.75} />
        </mesh>
      ))}
    </group>
  );
}

// Moon sizing — real ratio: Moon radius ≈ 0.273× Earth radius, orbit ≈ 60× Earth radii
// Visual compromise: orbit at 10× Earth radius so Moon is visible but clearly distant
const MOON_RADIUS = 0.55; // 0.273 × 2 (Earth radius) ≈ 0.55
const MOON_ORBIT_RADIUS = 20; // 10× Earth radius — visible compromise vs real 60×

// JWST sits at Sun-Earth L2, ~4× farther than the Moon. Keep the same visual
// compression spirit: beyond the Moon's ring, not to scale.
const JWST_VISUAL_RADIUS = 26;

// Moon component with clickable orbit
interface MoonProps {
  isSelected: boolean;
  onMoonClick: () => void;
}

function Moon({ isSelected, onMoonClick }: MoonProps) {
  const moonRef = useRef<THREE.Group>(null);
  const moonMeshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const lastMoonUpdate = useRef(0);
  const moonTargetPos = useRef(new THREE.Vector3(MOON_ORBIT_RADIUS, 0, 0));

  // NASA LROC Moon texture (public domain, from NASA SVS CGI Moon Kit #4720)
  const moonTexture = useMemo(() => {
    const loader = new THREE.TextureLoader();
    const tex = loader.load('/moon-texture.jpg');
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);

  useFrame(() => {
    // During mission replay the clock jumps fast — recompute every frame and
    // snap; otherwise throttle to 50 ms and ease with a lerp
    const replaying = getSimTimeOverride() !== null;
    const now = Date.now();
    if (replaying || now - lastMoonUpdate.current > 50) {
      lastMoonUpdate.current = now;
      const moonEci = computeMoonPositionECI(getMoonSimDate());
      // Scene radius from the Moon's REAL distance (356k–406k km), using the
      // same radial compression as satellites and the Artemis trajectory
      const sceneR = getOrbitRadius(moonEci.distance - 6371);
      moonTargetPos.current = eciDirToThreeJS(moonEci.eciX, moonEci.eciY, moonEci.eciZ, sceneR);
    }
    if (moonRef.current) {
      if (replaying) {
        moonRef.current.position.copy(moonTargetPos.current);
      } else {
        moonRef.current.position.lerp(moonTargetPos.current, 0.15);
      }
      // Tidal lock — same face toward Earth, derived from the position itself
      // so it stays correct at any playback speed
      if (moonMeshRef.current) {
        const p = moonRef.current.position;
        moonMeshRef.current.rotation.y = Math.atan2(p.x, p.z);
      }
    }
  });

  // Moon orbit — one sidereal month of REAL positions (astronomy-engine),
  // mapped with the same radial compression as the Moon itself
  const moonOrbitPoints = useMemo(() => {
    const points: THREE.Vector3[] = [];
    const start = Date.now();
    const SIDEREAL_MONTH_MS = 27.32 * 86400000;
    const STEPS = 120;
    for (let i = 0; i <= STEPS; i++) {
      const date = new Date(start + (i / STEPS) * SIDEREAL_MONTH_MS);
      const eci = computeMoonPositionECI(date);
      const sceneR = getOrbitRadius(eci.distance - 6371);
      points.push(eciDirToThreeJS(eci.eciX, eci.eciY, eci.eciZ, sceneR));
    }
    return points;
  }, []);

  return (
    <>
      {/* Moon orbit path - shown when selected */}
      {isSelected && (
        <Line
          points={moonOrbitPoints}
          color="#AAAAAA"
          lineWidth={2}
          opacity={0.7}
          transparent
        />
      )}
      
      <group ref={moonRef} position={[MOON_ORBIT_RADIUS, 0, 0]}>
        <mesh
          ref={moonMeshRef}
          onClick={(e) => { e.stopPropagation(); onMoonClick(); }}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onPointerOver={() => {
            setHovered(true);
            document.body.style.cursor = 'pointer';
          }}
          onPointerOut={() => {
            setHovered(false);
            document.body.style.cursor = 'auto';
          }}
          scale={hovered || isSelected ? 1.1 : 1}
        >
          <sphereGeometry args={[MOON_RADIUS, 64, 64]} />
          <meshStandardMaterial
            map={moonTexture}
            roughness={0.9}
            metalness={0.05}
          />
        </mesh>
        {/* Moon glow */}
        <mesh>
          <sphereGeometry args={[MOON_RADIUS * 1.1, 32, 32]} />
          <meshBasicMaterial
            color="#ffffff"
            transparent
            opacity={isSelected ? 0.2 : 0.1}
            side={THREE.BackSide}
          />
        </mesh>

        {/* Selection ring */}
        {isSelected && (
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[MOON_RADIUS * 1.2, MOON_RADIUS * 1.3, 32]} />
            <meshBasicMaterial color="#888888" transparent opacity={0.8} side={THREE.DoubleSide} />
          </mesh>
        )}

        {/* Label when selected */}
        {isSelected && (
          <Html position={[0, MOON_RADIUS * 1.6, 0]} center>
            <div className="bg-[rgba(0,0,0,0.8)] border border-[rgba(136,136,136,0.5)] px-2 py-1 rounded text-xs whitespace-nowrap">
              <span className="text-[#cccccc] font-mono">MOON</span>
            </div>
          </Html>
        )}
      </group>
    </>
  );
}

// Single satellite component
interface SatelliteMarkerProps {
  satellite: Satellite;
  isSelected: boolean;
  onClick: () => void;
  onPointerOver: (e: THREE.Event) => void;
  onPointerOut: () => void;
}

// Orbit zone boundaries (in km)
const ORBIT_ZONES = {
  LEO: { min: 160, max: 2000 },     // Low Earth Orbit
  MEO: { min: 2000, max: 35786 },   // Medium Earth Orbit  
  GEO: { altitude: 35786 },         // Geostationary Orbit
};

// Visual radius ranges for each orbit zone
const VISUAL_RADII = {
  earthRadius: 2,
  leoMin: 2.3,   // 160km maps here
  leoMax: 3.5,   // 2000km maps here
  meoMax: 4.5,   // 35786km maps here
  geoMax: 5.0,   // Beyond GEO
};

// Calculate orbit radius for a satellite - continuous scaling within each zone
function getOrbitRadius(altitude: number): number {
  const { earthRadius, leoMin, leoMax, meoMax, geoMax } = VISUAL_RADII;
  
  if (altitude <= ORBIT_ZONES.LEO.max) {
    // LEO: 160-2000km maps to radius 2.3-3.5
    const t = (altitude - ORBIT_ZONES.LEO.min) / (ORBIT_ZONES.LEO.max - ORBIT_ZONES.LEO.min);
    return leoMin + t * (leoMax - leoMin);
  } else if (altitude <= ORBIT_ZONES.GEO.altitude) {
    // MEO: 2000-35786km maps to radius 3.5-4.5
    const t = (altitude - ORBIT_ZONES.MEO.min) / (ORBIT_ZONES.MEO.max - ORBIT_ZONES.MEO.min);
    return leoMax + t * (meoMax - leoMax);
  } else {
    // Beyond GEO: linear out to the Moon's mean distance at scene radius 20.
    // MUST match radialMapKm() in scripts/fetch-artemis-trajectory.mjs — the
    // Artemis trajectory is baked with this same compression.
    const MOON_MEAN_ALT = 384400 - 6371; // 378,029 km
    return meoMax + ((altitude - ORBIT_ZONES.GEO.altitude) / (MOON_MEAN_ALT - ORBIT_ZONES.GEO.altitude)) * (MOON_ORBIT_RADIUS - meoMax);
  }
}

// Get orbit type from altitude
function getOrbitType(altitude: number): 'LEO' | 'MEO' | 'GEO' {
  if (altitude <= ORBIT_ZONES.LEO.max) return 'LEO';
  if (altitude <= ORBIT_ZONES.GEO.altitude) return 'MEO';
  return 'GEO';
}

// ─── Satellite 3D Models ────────────────────────────────────
// Detailed models for registry satellites, category-based for generics

// ─── Shared spacecraft material presets ─────────────────────
// Low emissive: the real sun light does the shading; emissive only keeps
// hardware faintly readable on the night side.
const M = {
  issGold:   { color: '#96712f', roughness: 0.45, metalness: 0.5, emissive: '#3d2c10', emissiveIntensity: 0.25 },
  cellBlue:  { color: '#16233f', roughness: 0.3, metalness: 0.6, emissive: '#0a1424', emissiveIntensity: 0.3 },
  cellDark:  { color: '#10192e', roughness: 0.25, metalness: 0.65, emissive: '#080e1c', emissiveIntensity: 0.3 },
  whiteHull: { color: '#e3e1da', roughness: 0.55, metalness: 0.15, emissive: '#7a7972', emissiveIntensity: 0.08 },
  grayHull:  { color: '#b9b6ae', roughness: 0.55, metalness: 0.3, emissive: '#5c5a54', emissiveIntensity: 0.08 },
  silverMLI: { color: '#c9ccd1', roughness: 0.2, metalness: 0.9, emissive: '#5c5e63', emissiveIntensity: 0.08 },
  goldMLI:   { color: '#c9982f', roughness: 0.3, metalness: 0.85, emissive: '#57400f', emissiveIntensity: 0.2 },
  darkMLI:   { color: '#25272c', roughness: 0.5, metalness: 0.55, emissive: '#101114', emissiveIntensity: 0.25 },
  radiator:  { color: '#dfe3e6', roughness: 0.4, metalness: 0.2, emissive: '#6d7073', emissiveIntensity: 0.08 },
  blackOptic:{ color: '#141414', roughness: 0.25, metalness: 0.8, emissive: '#060606', emissiveIntensity: 0.2 },
  strut:     { color: '#9a9a98', roughness: 0.5, metalness: 0.6 },
} as const;

// ISS — integrated truss with 4 pairs of bronze-gold solar wings (the real
// arrays are gold, not blue), white radiators, and the pressurized module
// stack (Zvezda→Zarya→Unity→Destiny→Harmony) with Columbus/Kibo laterals
function ISSModel({ color: _color }: { color: string }) {
  return (
    <group scale={1.8}>
      {/* Integrated truss — segmented backbone, port-starboard */}
      <mesh>
        <boxGeometry args={[0.016, 0.012, 0.3]} />
        <meshStandardMaterial {...M.grayHull} />
      </mesh>
      {[-0.09, 0.09].map((z, i) => (
        <mesh key={`truss-j-${i}`} position={[0, 0, z]}>
          <boxGeometry args={[0.02, 0.016, 0.014]} />
          <meshStandardMaterial {...M.whiteHull} />
        </mesh>
      ))}

      {/* Solar wings — 8 bronze blankets in 4 gimbaled pairs at the truss ends */}
      {[0.105, 0.155].map((z, zi) =>
        [1, -1].map(sign =>
          [1, -1].map(side => (
            <group key={`saw-${zi}-${sign}-${side}`} position={[0, 0, z * sign]}>
              <mesh position={[side * 0.055, 0, 0]}>
                <boxGeometry args={[0.095, 0.0025, 0.042]} />
                <meshStandardMaterial {...M.issGold} />
              </mesh>
              {/* blanket center seam */}
              <mesh position={[side * 0.055, 0.0002, 0]}>
                <boxGeometry args={[0.096, 0.0026, 0.0025]} />
                <meshStandardMaterial color="#6e5322" roughness={0.5} metalness={0.4} />
              </mesh>
              {/* wing mast */}
              <mesh position={[side * 0.03, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.0018, 0.0018, 0.055, 6]} />
                <meshStandardMaterial {...M.strut} />
              </mesh>
            </group>
          ))
        )
      )}

      {/* Heat radiators — white panels perpendicular to the arrays */}
      {[-0.045, -0.065].map((z, i) => (
        <mesh key={`rad-${i}`} position={[0, -0.035, z]} rotation={[Math.PI / 2, 0, 0]}>
          <boxGeometry args={[0.055, 0.0018, 0.022]} />
          <meshStandardMaterial {...M.radiator} />
        </mesh>
      ))}
      <mesh position={[0, -0.035, 0.055]} rotation={[Math.PI / 2, 0, 0]}>
        <boxGeometry args={[0.055, 0.0018, 0.022]} />
        <meshStandardMaterial {...M.radiator} />
      </mesh>

      {/* Pressurized module stack along velocity axis */}
      {/* Zvezda (aft, with small solar wings) */}
      <mesh position={[-0.095, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.016, 0.019, 0.05, 12]} />
        <meshStandardMaterial {...M.grayHull} />
      </mesh>
      {[1, -1].map(s => (
        <mesh key={`zv-${s}`} position={[-0.1, 0, s * 0.028]}>
          <boxGeometry args={[0.03, 0.0018, 0.032]} />
          <meshStandardMaterial {...M.issGold} />
        </mesh>
      ))}
      {/* Zarya (gold-tinged MLI) */}
      <mesh position={[-0.05, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.019, 0.019, 0.045, 12]} />
        <meshStandardMaterial {...M.goldMLI} />
      </mesh>
      {/* Unity node */}
      <mesh position={[-0.018, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.021, 0.021, 0.024, 12]} />
        <meshStandardMaterial {...M.whiteHull} />
      </mesh>
      {/* Destiny lab */}
      <mesh position={[0.015, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.02, 0.02, 0.042, 12]} />
        <meshStandardMaterial {...M.whiteHull} />
      </mesh>
      {/* Harmony node */}
      <mesh position={[0.05, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.02, 0.02, 0.028, 12]} />
        <meshStandardMaterial {...M.whiteHull} />
      </mesh>
      {/* Columbus + Kibo — lateral modules on Harmony */}
      <mesh position={[0.05, 0, 0.026]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.014, 0.014, 0.026, 10]} />
        <meshStandardMaterial {...M.whiteHull} />
      </mesh>
      <mesh position={[0.05, 0, -0.03]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.016, 0.016, 0.034, 10]} />
        <meshStandardMaterial {...M.whiteHull} />
      </mesh>
      {/* Cupola — nadir on Unity */}
      <mesh position={[-0.018, -0.024, 0]}>
        <cylinderGeometry args={[0.008, 0.012, 0.008, 8]} />
        <meshStandardMaterial {...M.blackOptic} />
      </mesh>
      {/* Docked crew vehicle (forward port) */}
      <mesh position={[0.075, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.012, 0.02, 10]} />
        <meshStandardMaterial {...M.silverMLI} />
      </mesh>
      {/* Docked Soyuz/Progress (aft) */}
      <mesh position={[-0.128, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.008, 0.01, 0.018, 8]} />
        <meshStandardMaterial {...M.grayHull} />
      </mesh>
    </group>
  );
}

// Hubble — silver MLI forward shell + darker aft shroud, OPEN aperture door,
// twin rigid SA3 solar wings, two high-gain antenna dishes on booms
function HubbleModel() {
  return (
    <group scale={1.4}>
      {/* Forward shell — bright silver MLI */}
      <mesh position={[0.025, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.029, 0.029, 0.095, 20]} />
        <meshStandardMaterial {...M.silverMLI} roughness={0.15} />
      </mesh>
      {/* Light shield ring at the very front */}
      <mesh position={[0.075, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.0295, 0.029, 0.012, 20]} />
        <meshStandardMaterial color="#9ea2a8" roughness={0.35} metalness={0.85} />
      </mesh>
      {/* Open aperture — black optical cavity */}
      <mesh position={[0.081, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.026, 0.026, 0.002, 20]} />
        <meshStandardMaterial color="#050505" roughness={0.9} metalness={0.1} />
      </mesh>
      {/* Aperture door — hinged open ~65° above the opening */}
      <mesh position={[0.096, 0.026, 0]} rotation={[0, 0, 1.15]}>
        <cylinderGeometry args={[0.029, 0.029, 0.0025, 20]} />
        <meshStandardMaterial {...M.silverMLI} roughness={0.15} />
      </mesh>
      {/* Equipment section — wider gray band */}
      <mesh position={[-0.04, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.033, 0.033, 0.04, 20]} />
        <meshStandardMaterial {...M.grayHull} metalness={0.6} />
      </mesh>
      {/* Aft shroud — darker */}
      <mesh position={[-0.078, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.031, 0.033, 0.038, 20]} />
        <meshStandardMaterial color="#7d8187" roughness={0.4} metalness={0.75} emissive="#3a3c40" emissiveIntensity={0.08} />
      </mesh>
      {/* Aft bulkhead */}
      <mesh position={[-0.098, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.031, 0.028, 0.006, 20]} />
        <meshStandardMaterial {...M.darkMLI} />
      </mesh>
      {/* Twin rigid solar wings on short masts */}
      {[1, -1].map(s => (
        <group key={`hst-sa-${s}`}>
          <mesh position={[-0.02, 0, s * 0.034]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.002, 0.002, 0.014, 6]} />
            <meshStandardMaterial {...M.strut} />
          </mesh>
          <mesh position={[-0.02, 0, s * 0.062]}>
            <boxGeometry args={[0.075, 0.0025, 0.042]} />
            <meshStandardMaterial {...M.cellBlue} />
          </mesh>
        </group>
      ))}
      {/* Two high-gain antenna dishes on deployed booms */}
      {[1, -1].map(s => (
        <group key={`hst-hga-${s}`}>
          <mesh position={[0.03, s * 0.042, 0]} rotation={[0, 0, s * -0.35]}>
            <cylinderGeometry args={[0.0015, 0.0015, 0.036, 6]} />
            <meshStandardMaterial {...M.strut} />
          </mesh>
          <mesh position={[0.036, s * 0.06, 0]} rotation={[s * Math.PI / 2.4, 0, 0]}>
            <coneGeometry args={[0.009, 0.005, 14]} />
            <meshStandardMaterial color="#d8dade" roughness={0.35} metalness={0.7} emissive="#63656a" emissiveIntensity={0.08} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// GOES-R series (GOES-19/18) — dark charcoal MLI bus (the real spacecraft is
// wrapped nearly black), single 5-panel solar wing on the south side, long
// magnetometer boom opposite, ABI + GLM on the Earth-facing deck
function GOESModel() {
  return (
    <group scale={1.3}>
      {/* Bus — dark MLI wrap */}
      <mesh>
        <boxGeometry args={[0.055, 0.048, 0.05]} />
        <meshStandardMaterial {...M.darkMLI} />
      </mesh>
      {/* Gold MLI trim on the sun-facing edge */}
      <mesh position={[0, 0, 0.0255]}>
        <boxGeometry args={[0.05, 0.043, 0.002]} />
        <meshStandardMaterial {...M.goldMLI} />
      </mesh>
      {/* ABI — the main imager, silver housing with black aperture */}
      <mesh position={[-0.012, -0.027, 0.008]}>
        <boxGeometry args={[0.02, 0.01, 0.018]} />
        <meshStandardMaterial {...M.silverMLI} />
      </mesh>
      <mesh position={[-0.012, -0.033, 0.008]}>
        <cylinderGeometry args={[0.007, 0.007, 0.004, 12]} />
        <meshStandardMaterial {...M.blackOptic} />
      </mesh>
      {/* GLM — lightning mapper beside ABI */}
      <mesh position={[0.014, -0.028, -0.01]}>
        <cylinderGeometry args={[0.005, 0.006, 0.008, 10]} />
        <meshStandardMaterial {...M.blackOptic} />
      </mesh>
      {/* Earth-pointing antenna farm */}
      <mesh position={[0.02, -0.028, 0.012]}>
        <coneGeometry args={[0.006, 0.008, 10]} />
        <meshStandardMaterial color="#cfd2d6" roughness={0.4} metalness={0.6} />
      </mesh>
      {/* Magnetometer boom — long truss away from the wing */}
      <mesh position={[0, 0.004, -0.075]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.0015, 0.0015, 0.1, 6]} />
        <meshStandardMaterial {...M.strut} />
      </mesh>
      <mesh position={[0, 0.004, -0.128]}>
        <boxGeometry args={[0.006, 0.006, 0.008]} />
        <meshStandardMaterial {...M.grayHull} />
      </mesh>
      {/* Solar wing — yoke + 5 segmented panels, south side */}
      <mesh position={[0, 0, 0.042]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.002, 0.002, 0.034, 6]} />
        <meshStandardMaterial {...M.strut} />
      </mesh>
      {[0, 1, 2, 3, 4].map(i => (
        <mesh key={`goes-sa-${i}`} position={[0, 0, 0.068 + i * 0.0335]}>
          <boxGeometry args={[0.075, 0.0025, 0.031]} />
          <meshStandardMaterial {...M.cellDark} />
        </mesh>
      ))}
      {/* SUVI/EXIS solar-pointing platform on the wing yoke */}
      <mesh position={[0.03, 0.008, 0.05]}>
        <boxGeometry args={[0.012, 0.01, 0.012]} />
        <meshStandardMaterial {...M.grayHull} />
      </mesh>
    </group>
  );
}

// NOAA-19 (POES) — long silver-MLI cylinder bus, one large 8-segment solar
// paddle on a canted boom, AVHRR/instrument cluster at the forward end
function NOAAModel() {
  return (
    <group scale={1.3}>
      {/* Main bus — silver-wrapped cylinder */}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.017, 0.017, 0.075, 14]} />
        <meshStandardMaterial {...M.silverMLI} roughness={0.3} />
      </mesh>
      {/* Equipment support module — boxy forward section */}
      <mesh position={[0.045, 0, 0]}>
        <boxGeometry args={[0.02, 0.03, 0.028]} />
        <meshStandardMaterial {...M.grayHull} />
      </mesh>
      {/* AVHRR — black scanner on the forward nadir face */}
      <mesh position={[0.045, -0.018, 0]}>
        <boxGeometry args={[0.012, 0.008, 0.012]} />
        <meshStandardMaterial {...M.blackOptic} />
      </mesh>
      {/* HIRS + MHS sounder boxes along the nadir side */}
      <mesh position={[0.01, -0.02, 0]}>
        <boxGeometry args={[0.014, 0.006, 0.014]} />
        <meshStandardMaterial {...M.darkMLI} />
      </mesh>
      <mesh position={[-0.015, -0.019, 0.005]}>
        <boxGeometry args={[0.01, 0.005, 0.01]} />
        <meshStandardMaterial {...M.grayHull} />
      </mesh>
      {/* Single large solar paddle on canted boom (sun-tracking) */}
      <mesh position={[-0.03, 0.012, 0.02]} rotation={[Math.PI / 2.6, 0, 0]}>
        <cylinderGeometry args={[0.002, 0.002, 0.03, 6]} />
        <meshStandardMaterial {...M.strut} />
      </mesh>
      <group position={[-0.03, 0.02, 0.048]} rotation={[0.35, 0, 0]}>
        <mesh>
          <boxGeometry args={[0.052, 0.0025, 0.062]} />
          <meshStandardMaterial {...M.cellBlue} />
        </mesh>
        {/* paddle segment seams */}
        {[-0.02, 0, 0.02].map((z, i) => (
          <mesh key={`noaa-seam-${i}`} position={[0, 0.0002, z]}>
            <boxGeometry args={[0.053, 0.0026, 0.0012]} />
            <meshStandardMaterial color="#0c1526" roughness={0.4} />
          </mesh>
        ))}
      </group>
      {/* S-band + SAR antennas */}
      <mesh position={[0.02, 0.02, 0]}>
        <cylinderGeometry args={[0.0012, 0.0012, 0.018, 6]} />
        <meshStandardMaterial {...M.strut} />
      </mesh>
      <mesh position={[-0.03, -0.02, -0.008]} rotation={[0.3, 0, 0.2]}>
        <cylinderGeometry args={[0.001, 0.001, 0.016, 4]} />
        <meshStandardMaterial {...M.strut} />
      </mesh>
    </group>
  );
}

// Landsat 9 — bus wrapped in gold + black MLI, OLI-2 and TIRS-2 telescope
// apertures on the nadir deck, X-band dish, single articulating solar wing
function LandsatModel() {
  return (
    <group scale={1.3}>
      {/* Bus — dark MLI body */}
      <mesh>
        <boxGeometry args={[0.042, 0.05, 0.038]} />
        <meshStandardMaterial {...M.darkMLI} />
      </mesh>
      {/* Gold MLI wrap — dominant on the real spacecraft */}
      <mesh position={[0.0215, 0, 0]}>
        <boxGeometry args={[0.002, 0.048, 0.036]} />
        <meshStandardMaterial {...M.goldMLI} />
      </mesh>
      <mesh position={[0, 0.0255, 0]}>
        <boxGeometry args={[0.04, 0.002, 0.036]} />
        <meshStandardMaterial {...M.goldMLI} />
      </mesh>
      <mesh position={[-0.0215, 0, 0.008]}>
        <boxGeometry args={[0.002, 0.044, 0.02]} />
        <meshStandardMaterial {...M.goldMLI} />
      </mesh>
      {/* OLI-2 — larger telescope, canted on the nadir deck */}
      <mesh position={[0.008, -0.03, 0.004]} rotation={[0.15, 0, 0]}>
        <cylinderGeometry args={[0.009, 0.011, 0.014, 12]} />
        <meshStandardMaterial {...M.silverMLI} />
      </mesh>
      <mesh position={[0.008, -0.038, 0.005]} rotation={[0.15, 0, 0]}>
        <cylinderGeometry args={[0.008, 0.008, 0.002, 12]} />
        <meshStandardMaterial {...M.blackOptic} />
      </mesh>
      {/* TIRS-2 — thermal imager, smaller cryocooled housing */}
      <mesh position={[-0.012, -0.03, -0.006]}>
        <boxGeometry args={[0.013, 0.012, 0.013]} />
        <meshStandardMaterial {...M.grayHull} />
      </mesh>
      <mesh position={[-0.012, -0.037, -0.006]}>
        <cylinderGeometry args={[0.005, 0.005, 0.002, 10]} />
        <meshStandardMaterial {...M.blackOptic} />
      </mesh>
      {/* X-band downlink dish on the nadir deck */}
      <mesh position={[0.012, -0.028, -0.013]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.006, 0.005, 12]} />
        <meshStandardMaterial color="#d5d7db" roughness={0.35} metalness={0.7} />
      </mesh>
      {/* Star trackers on the zenith deck */}
      {[0.008, -0.008].map((x, i) => (
        <mesh key={`ls-st-${i}`} position={[x, 0.028, 0.01]} rotation={[-0.4, 0, i ? 0.3 : -0.3]}>
          <cylinderGeometry args={[0.003, 0.004, 0.008, 8]} />
          <meshStandardMaterial {...M.blackOptic} />
        </mesh>
      ))}
      {/* Single articulating solar wing — 3 segmented panels */}
      <mesh position={[0, 0.008, 0.032]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.002, 0.002, 0.026, 6]} />
        <meshStandardMaterial {...M.strut} />
      </mesh>
      <group position={[0, 0.008, 0.045]} rotation={[-0.25, 0, 0]}>
        {[0, 1, 2].map(i => (
          <mesh key={`ls-sa-${i}`} position={[0, 0, 0.017 + i * 0.033]}>
            <boxGeometry args={[0.052, 0.0025, 0.031]} />
            <meshStandardMaterial {...M.cellDark} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

// JWST — 18 gold hex segments in the true honeycomb (6-ring + 12-ring around
// a central gap), secondary mirror on a converging tripod, 5 separate
// kite-shaped sunshield layers, spacecraft bus + solar array underneath
const JWST_HEX_R = 0.0115;
const JWST_HEX_POSITIONS: [number, number][] = (() => {
  const d = JWST_HEX_R * Math.sqrt(3) * 1.05; // center-to-center with a thin gap
  const pts: [number, number][] = [];
  // Inner ring — 6 segments around the (empty) center
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    pts.push([d * Math.cos(a), d * Math.sin(a)]);
  }
  // Outer ring — 6 corner + 6 edge segments
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    pts.push([2 * d * Math.cos(a), 2 * d * Math.sin(a)]);
    const b = a + Math.PI / 6;
    pts.push([d * Math.sqrt(3) * Math.cos(b), d * Math.sqrt(3) * Math.sin(b)]);
  }
  return pts;
})();

function JWSTModel() {
  const kiteShape = useMemo(() => {
    // The sunshield's signature kite silhouette
    const s = new THREE.Shape();
    s.moveTo(0.078, 0);
    s.lineTo(0.02, 0.047);
    s.lineTo(-0.05, 0.04);
    s.lineTo(-0.078, 0);
    s.lineTo(-0.05, -0.04);
    s.lineTo(0.02, -0.047);
    s.closePath();
    return s;
  }, []);

  return (
    <group scale={1.6}>
      {/* Primary mirror — 18 gold hexes, honeycomb-packed */}
      {JWST_HEX_POSITIONS.map(([hx, hz], i) => (
        <mesh key={`jwst-hex-${i}`} position={[hx, 0.012, hz]} rotation={[0, Math.PI / 6, 0]}>
          <cylinderGeometry args={[JWST_HEX_R, JWST_HEX_R, 0.0018, 6]} />
          <meshStandardMaterial color="#e8b83a" roughness={0.08} metalness={1.0} emissive="#6b4d0e" emissiveIntensity={0.25} />
        </mesh>
      ))}
      {/* Aft optics — black stack in the central gap */}
      <mesh position={[0, 0.016, 0]}>
        <cylinderGeometry args={[0.006, 0.008, 0.01, 8]} />
        <meshStandardMaterial {...M.blackOptic} />
      </mesh>
      {/* Secondary mirror on converging tripod */}
      <mesh position={[0, 0.066, 0]} rotation={[Math.PI, 0, 0]}>
        <cylinderGeometry args={[0.0045, 0.0045, 0.0025, 12]} />
        <meshStandardMaterial color="#d9b545" roughness={0.1} metalness={1.0} emissive="#5c430e" emissiveIntensity={0.2} />
      </mesh>
      {[0, (2 * Math.PI) / 3, (4 * Math.PI) / 3].map((a, i) => {
        const bx = Math.cos(a) * 0.036;
        const bz = Math.sin(a) * 0.036;
        return (
          <group key={`jwst-strut-${i}`} position={[bx / 2, 0.039, bz / 2]}>
            <mesh rotation={[Math.atan2(bz, 0.054), 0, -Math.atan2(bx, 0.054)]}>
              <cylinderGeometry args={[0.0012, 0.0012, 0.062, 4]} />
              <meshStandardMaterial {...M.darkMLI} />
            </mesh>
          </group>
        );
      })}
      {/* Sunshield — 5 discrete kapton layers, silver → violet, spread apart */}
      {[0, 1, 2, 3, 4].map(i => (
        <mesh
          key={`jwst-shield-${i}`}
          position={[0, -0.012 - i * 0.0035, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          scale={1 + i * 0.025}
        >
          <shapeGeometry args={[kiteShape]} />
          <meshStandardMaterial
            color={['#d9dbe0', '#cfc9dd', '#c4b8d8', '#b9a8d2', '#ae98cc'][i]}
            roughness={0.25}
            metalness={0.85}
            emissive="#3d3552"
            emissiveIntensity={0.15}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
      {/* Deployable tower between shield and mirror */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.003, 0.003, 0.024, 8]} />
        <meshStandardMaterial {...M.grayHull} />
      </mesh>
      {/* Spacecraft bus below the shield */}
      <mesh position={[0, -0.034, 0]}>
        <boxGeometry args={[0.028, 0.014, 0.02]} />
        <meshStandardMaterial {...M.darkMLI} />
      </mesh>
      {/* Solar array — fixed panel angled off the bus bottom */}
      <mesh position={[-0.005, -0.046, 0]} rotation={[0, 0, 0.35]}>
        <boxGeometry args={[0.036, 0.0022, 0.016]} />
        <meshStandardMaterial {...M.cellDark} />
      </mesh>
      {/* High-gain antenna */}
      <mesh position={[0.012, -0.044, 0.008]} rotation={[0.6, 0, 0]}>
        <coneGeometry args={[0.005, 0.004, 10]} />
        <meshStandardMaterial color="#d5d7db" roughness={0.35} metalness={0.7} />
      </mesh>
    </group>
  );
}

// AO-91 (Fox-1B) — 1U CubeSat: gold-rail chassis, dark solar cells with gold
// busbar frames on every face, four deployed whip antennas
function CubeSatModel({ color: _color }: { color: string }) {
  return (
    <group scale={1.2}>
      {/* Chassis — gold anodized rails */}
      <mesh>
        <boxGeometry args={[0.03, 0.03, 0.03]} />
        <meshStandardMaterial {...M.goldMLI} roughness={0.4} />
      </mesh>
      {/* Solar cell faces — dark cells inset within the gold frame */}
      {[
        { pos: [0, 0, 0.0152], rot: [0, 0, 0] },
        { pos: [0, 0, -0.0152], rot: [0, Math.PI, 0] },
        { pos: [0.0152, 0, 0], rot: [0, Math.PI / 2, 0] },
        { pos: [-0.0152, 0, 0], rot: [0, -Math.PI / 2, 0] },
        { pos: [0, 0.0152, 0], rot: [-Math.PI / 2, 0, 0] },
        { pos: [0, -0.0152, 0], rot: [Math.PI / 2, 0, 0] },
      ].map((face, i) => (
        <mesh key={i} position={face.pos as [number, number, number]} rotation={face.rot as [number, number, number]}>
          <planeGeometry args={[0.024, 0.024]} />
          <meshStandardMaterial {...M.cellDark} roughness={0.2} />
        </mesh>
      ))}
      {/* Four deployed whip antennas (2m/70cm turnstile) */}
      {[
        { rot: [0.5, 0, 0.5], len: 0.045 },
        { rot: [-0.5, 0, 0.55], len: 0.045 },
        { rot: [0.55, 0, -0.5], len: 0.032 },
        { rot: [-0.55, 0, -0.55], len: 0.032 },
      ].map((w, i) => (
        <mesh key={`whip-${i}`} position={[0, 0.016, 0]} rotation={w.rot as [number, number, number]}>
          <cylinderGeometry args={[0.0004, 0.0004, w.len, 4]} />
          <meshStandardMaterial color="#d8d8d8" roughness={0.4} metalness={0.8} emissive="#666666" emissiveIntensity={0.15} />
        </mesh>
      ))}
    </group>
  );
}

// Tiangong (CSS) — T-shape: Tianhe core with docking hub, Wentian + Mengtian
// labs each carrying the station's signature LARGE flexible wing pairs, with
// docked Shenzhou (nadir) and Tianzhou (aft)
function TiangongModel({ color: _color }: { color: string }) {
  const wing = { color: '#1d3557', roughness: 0.25, metalness: 0.65, emissive: '#0d1a2e', emissiveIntensity: 0.3 };
  return (
    <group scale={1.5}>
      {/* Tianhe core module */}
      <mesh position={[-0.015, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.019, 0.019, 0.085, 14]} />
        <meshStandardMaterial {...M.whiteHull} />
      </mesh>
      {/* Docking hub node at the forward end */}
      <mesh position={[0.035, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.022, 0.022, 0.026, 14]} />
        <meshStandardMaterial {...M.grayHull} />
      </mesh>
      {/* Hub radial ports */}
      {[[0, 0.024, 0], [0, -0.024, 0]].map((p, i) => (
        <mesh key={`cssport-${i}`} position={[0.035 + p[0], p[1], p[2]]}>
          <cylinderGeometry args={[0.008, 0.008, 0.008, 10]} />
          <meshStandardMaterial {...M.grayHull} />
        </mesh>
      ))}
      {/* Wentian + Mengtian labs — perpendicular, forming the T */}
      {[1, -1].map(s => (
        <mesh key={`csslab-${s}`} position={[0.035, 0, s * 0.05]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.017, 0.017, 0.07, 14]} />
          <meshStandardMaterial {...M.whiteHull} />
        </mesh>
      ))}
      {/* The signature giant flexible wings on each lab's far end */}
      {[1, -1].map(s =>
        [1, -1].map(side => (
          <group key={`csswing-${s}-${side}`} position={[0.035, 0, s * 0.088]}>
            <mesh position={[side * 0.062, 0, 0]}>
              <boxGeometry args={[0.11, 0.002, 0.026]} />
              <meshStandardMaterial {...wing} />
            </mesh>
            <mesh position={[side * 0.062, 0.0002, 0]}>
              <boxGeometry args={[0.111, 0.0021, 0.0018]} />
              <meshStandardMaterial color="#0f1e33" roughness={0.4} />
            </mesh>
          </group>
        ))
      )}
      {/* Tianhe's smaller wing pair near the aft */}
      {[1, -1].map(s => (
        <mesh key={`cssthw-${s}`} position={[-0.048, 0, s * 0.038]}>
          <boxGeometry args={[0.024, 0.002, 0.05]} />
          <meshStandardMaterial {...wing} />
        </mesh>
      ))}
      {/* Docked Shenzhou — nadir port (white/green-tinged) */}
      <group position={[0.035, -0.043, 0]}>
        <mesh rotation={[0, 0, 0]}>
          <cylinderGeometry args={[0.009, 0.011, 0.022, 10]} />
          <meshStandardMaterial {...M.whiteHull} />
        </mesh>
        {[1, -1].map(s => (
          <mesh key={`sz-${s}`} position={[s * 0.018, -0.006, 0]}>
            <boxGeometry args={[0.018, 0.0015, 0.012]} />
            <meshStandardMaterial {...M.cellBlue} />
          </mesh>
        ))}
      </group>
      {/* Docked Tianzhou cargo — aft */}
      <mesh position={[-0.068, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.013, 0.015, 0.026, 10]} />
        <meshStandardMaterial {...M.grayHull} />
      </mesh>
      {/* Robotic arm hint on the core */}
      <mesh position={[-0.01, 0.021, 0.008]} rotation={[0.3, 0, 1.2]}>
        <cylinderGeometry args={[0.0015, 0.0015, 0.035, 6]} />
        <meshStandardMaterial color="#d9d3c8" roughness={0.5} metalness={0.4} />
      </mesh>
    </group>
  );
}

// Generic satellite with solar panels — used for category-based rendering
function GenericSatModel({ color, category }: { color: string; category: SatelliteCategory }) {
  const isComms = category === 'COMMS';
  const isGPS = category === 'GPS_GNSS';
  const isWeather = category === 'WEATHER_SAT';
  const isEarthObs = category === 'EARTH_OBS';

  return (
    <group>
      {isGPS ? (
        // GPS — cylindrical bus + two solar wings
        <group>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 0.05, 10]} />
            <meshStandardMaterial color="#d0cdc5" roughness={0.5} metalness={0.4} emissive="#a0a098" emissiveIntensity={0.12} />
          </mesh>
          <mesh position={[0, 0, 0.05]}>
            <boxGeometry args={[0.06, 0.003, 0.04]} />
            <meshStandardMaterial color="#1a2a4a" roughness={0.3} metalness={0.5} emissive="#0a1530" emissiveIntensity={0.4} />
          </mesh>
          <mesh position={[0, 0, -0.05]}>
            <boxGeometry args={[0.06, 0.003, 0.04]} />
            <meshStandardMaterial color="#1a2a4a" roughness={0.3} metalness={0.5} emissive="#0a1530" emissiveIntensity={0.4} />
          </mesh>
          {/* Antenna array (nadir) */}
          <mesh position={[0, -0.03, 0]}>
            <coneGeometry args={[0.012, 0.01, 8]} />
            <meshStandardMaterial color="#cccccc" roughness={0.4} metalness={0.6} emissive="#888888" emissiveIntensity={0.1} />
          </mesh>
        </group>
      ) : isWeather ? (
        // Weather — boxy + single solar wing + sensor
        <group>
          <mesh>
            <boxGeometry args={[0.035, 0.04, 0.035]} />
            <meshStandardMaterial color="#d8d5cc" roughness={0.5} metalness={0.3} emissive="#b0ada5" emissiveIntensity={0.1} />
          </mesh>
          <mesh position={[0, 0, 0.05]}>
            <boxGeometry args={[0.05, 0.003, 0.04]} />
            <meshStandardMaterial color="#1a2a4a" roughness={0.3} metalness={0.5} emissive="#0a1530" emissiveIntensity={0.4} />
          </mesh>
          <mesh position={[0, -0.024, 0]}>
            <cylinderGeometry args={[0.008, 0.006, 0.006, 8]} />
            <meshStandardMaterial color="#333333" roughness={0.3} metalness={0.7} emissive="#1a1a1a" emissiveIntensity={0.2} />
          </mesh>
        </group>
      ) : isComms ? (
        // Comms — flat bus + large solar wings (Starlink-like)
        <group>
          <mesh>
            <boxGeometry args={[0.04, 0.008, 0.025]} />
            <meshStandardMaterial color="#cccccc" roughness={0.5} metalness={0.4} emissive="#999999" emissiveIntensity={0.1} />
          </mesh>
          <mesh position={[0, 0, 0.04]}>
            <boxGeometry args={[0.06, 0.002, 0.04]} />
            <meshStandardMaterial color="#1a2a4a" roughness={0.3} metalness={0.5} emissive="#0a1530" emissiveIntensity={0.4} />
          </mesh>
          {/* Antenna (phased array face) */}
          <mesh position={[0, -0.006, 0]}>
            <boxGeometry args={[0.035, 0.002, 0.02]} />
            <meshStandardMaterial color="#444444" roughness={0.3} metalness={0.7} emissive="#222222" emissiveIntensity={0.15} />
          </mesh>
        </group>
      ) : isEarthObs ? (
        // Earth obs — boxy + single solar array + instrument
        <group>
          <mesh>
            <boxGeometry args={[0.035, 0.04, 0.03]} />
            <meshStandardMaterial color="#d0cdc5" roughness={0.5} metalness={0.3} emissive="#b0ada5" emissiveIntensity={0.1} />
          </mesh>
          <mesh position={[0, 0, 0.05]}>
            <boxGeometry args={[0.05, 0.003, 0.04]} />
            <meshStandardMaterial color="#1a2a4a" roughness={0.3} metalness={0.5} emissive="#0a1530" emissiveIntensity={0.4} />
          </mesh>
          <mesh position={[0, -0.024, 0]}>
            <cylinderGeometry args={[0.009, 0.007, 0.008, 10]} />
            <meshStandardMaterial color="#333333" roughness={0.3} metalness={0.7} emissive="#1a1a1a" emissiveIntensity={0.2} />
          </mesh>
          {/* Gold thermal foil strip */}
          <mesh position={[0.019, 0, 0]}>
            <boxGeometry args={[0.002, 0.038, 0.028]} />
            <meshStandardMaterial color="#c8a832" roughness={0.35} metalness={0.8} emissive="#8a7420" emissiveIntensity={0.12} />
          </mesh>
        </group>
      ) : (
        // Amateur radio / generic CubeSat
        <group>
          <mesh>
            <boxGeometry args={[0.025, 0.025, 0.025]} />
            <meshStandardMaterial color="#1a1a2a" roughness={0.4} metalness={0.5} emissive="#0a0a15" emissiveIntensity={0.3} />
          </mesh>
          <mesh position={[0.03, 0, 0]}>
            <boxGeometry args={[0.03, 0.003, 0.02]} />
            <meshStandardMaterial color="#1a2a4a" roughness={0.3} metalness={0.5} emissive="#0a1530" emissiveIntensity={0.4} />
          </mesh>
          <mesh position={[-0.03, 0, 0]}>
            <boxGeometry args={[0.03, 0.003, 0.02]} />
            <meshStandardMaterial color="#1a2a4a" roughness={0.3} metalness={0.5} emissive="#0a1530" emissiveIntensity={0.4} />
          </mesh>
          {/* Antenna */}
          <mesh position={[0.012, 0.02, 0]} rotation={[0, 0, 0.4]}>
            <cylinderGeometry args={[0.0005, 0.0005, 0.025, 4]} />
            <meshStandardMaterial color="#cccccc" roughness={0.5} metalness={0.6} />
          </mesh>
        </group>
      )}
    </group>
  );
}

// Resolve which 3D model to render for a given satellite
function SatelliteModel({ satellite, color }: { satellite: Satellite; color: string }) {
  const rid = satellite.registryId;
  if (rid === 'iss') return <ISSModel color={color} />;
  if (rid === 'hubble') return <HubbleModel />;
  if (rid === 'goes-19' || rid === 'goes-18') return <GOESModel />;
  if (rid === 'noaa-19') return <NOAAModel />;
  if (rid === 'landsat-9') return <LandsatModel />;
  if (rid === 'jwst') return <JWSTModel />;
  if (rid === 'ao-91') return <CubeSatModel color={color} />;
  // Tiangong
  if (satellite.name?.includes('TIANGONG')) return <TiangongModel color={color} />;
  // Fallback: category-based generic model
  return <GenericSatModel color={color} category={satellite.category} />;
}

function SatelliteMarker({
  satellite,
  isSelected,
  onClick,
  onPointerOver,
  onPointerOut,
}: SatelliteMarkerProps) {
  const satelliteRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  const color = categoryColors[satellite.category];
  const isStation = satellite.category === 'SPACE_STATION';

  // Position satellite using ECI coordinates (inertial frame)
  useFrame(() => {
    if (satelliteRef.current) {
      const simDate = getSimDate();
      let pos: THREE.Vector3 | null = null;

      if (satellite.special === 'L2_POINT') {
        const eciDir = getJWSTPositionECI(simDate);
        pos = eciDirToThreeJS(eciDir.eciX, eciDir.eciY, eciDir.eciZ, JWST_VISUAL_RADIUS);
      } else {
        const eciPos = computeECIPosition(satellite.noradId, simDate);
        if (eciPos) {
          pos = eciToThreeJSSat(eciPos.eciX, eciPos.eciY, eciPos.eciZ);
        }
      }

      if (pos) {
        // During mission replay satellites move fast — snap to the true
        // position; lerp only at normal speed for smoothness
        if (getSimTimeOverride()) {
          satelliteRef.current.position.copy(pos);
        } else {
          satelliteRef.current.position.lerp(pos, 0.2);
        }
      }
    }
  });

  const satelliteScale = isStation ? 1.5 : isSelected || hovered ? 1.2 : 1;

  // Reset the cursor if this marker unmounts mid-hover (e.g. selection hides others)
  useEffect(() => () => { document.body.style.cursor = 'auto'; }, []);

  return (
    <group ref={satelliteRef}>
      <group
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
        onPointerOver={(e) => {
          setHovered(true);
          onPointerOver(e as unknown as THREE.Event);
        }}
        onPointerOut={() => {
          setHovered(false);
          onPointerOut();
        }}
        scale={satelliteScale}
      >
        <SatelliteModel satellite={satellite} color={color} />

        {isSelected && (
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.1, 0.12, 32]} />
            <meshBasicMaterial color={color} transparent opacity={0.9} side={THREE.DoubleSide} />
          </mesh>
        )}
      </group>

      {isSelected && (
        <Html position={[0, 0.15, 0]} center>
          <div className="bg-[rgba(0,0,0,0.8)] border border-[rgba(0,255,65,0.5)] px-2 py-1 rounded text-xs whitespace-nowrap">
            <span className="text-[#00FF41] font-mono">{satellite.name}</span>
          </div>
        </Html>
      )}
    </group>
  );
}

// Satellite orbit path — computed in the ECI inertial frame at scene root,
// so it stays fixed while the Earth rotates underneath it
interface OrbitPathProps {
  satellite: Satellite;
}

function OrbitPath({ satellite }: OrbitPathProps) {
  const color = categoryColors[satellite.category];
  const isL2 = satellite.special === 'L2_POINT';
  const isGeo = !isL2 && (satellite.special === 'GEOSTATIONARY' || satellite.altitude > 35000);

  // Refresh orbit path every ~5 seconds to stay in sync with accelerated sim time
  const [epoch, setEpoch] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setEpoch(e => e + 1), 5000);
    return () => clearInterval(timer);
  }, []);

  // Compute orbit path in ECI coordinates at current sim time
  const orbitPoints = useMemo(() => {
    // JWST orbits the Sun-Earth L2 point — no Earth-centered orbit to draw
    if (isL2 || satellite.noradId <= 0) return [];

    // For geostationary sats, draw an equatorial ring in ECI
    if (isGeo) {
      const geoRadius = getOrbitRadius(satellite.altitude);
      const points: THREE.Vector3[] = [];
      for (let i = 0; i <= 360; i += 2) {
        const angle = (i * Math.PI) / 180;
        points.push(new THREE.Vector3(
          geoRadius * Math.cos(angle),
          0,
          geoRadius * Math.sin(angle)
        ));
      }
      return points;
    }

    // For LEO/MEO sats, compute one full orbit from current sim time
    try {
      const simDate = getSimDate();
      const eciPositions = computeOrbitPathECI(satellite.noradId, 20, simDate);
      if (eciPositions.length < 2) return [];

      return eciPositions.map(pos => eciToThreeJSSat(pos.eciX, pos.eciY, pos.eciZ));
    } catch {
      return [];
    }
  }, [satellite.noradId, satellite.altitude, isGeo, isL2, epoch]);

  if (orbitPoints.length < 2) return null;

  return (
    <Line
      points={orbitPoints}
      color={color}
      lineWidth={2}
      opacity={0.6}
      transparent
    />
  );
}

// All satellites container
interface SatellitesProps {
  satellites: Satellite[];
  selectedSatellite: Satellite | null;
  onSatelliteClick: (satellite: Satellite) => void;
  onSatelliteHover: (satellite: Satellite | null, x: number, y: number) => void;
  filters: Record<SatelliteCategory, boolean>;
}

function Satellites({ 
  satellites, 
  selectedSatellite, 
  onSatelliteClick, 
  onSatelliteHover,
  filters 
}: SatellitesProps) {
  const { gl } = useThree();
  
  const filteredSatellites = useMemo(() => 
    satellites.filter(sat => filters[sat.category]),
    [satellites, filters]
  );

  const handlePointerOver = (satellite: Satellite) => () => {
    // Don't show hover when another satellite is selected
    if (selectedSatellite && selectedSatellite.id !== satellite.id) return;
    const rect = gl.domElement.getBoundingClientRect();
    onSatelliteHover(satellite, rect.left + rect.width / 2, rect.top + rect.height / 2);
    document.body.style.cursor = 'pointer';
  };

  const handlePointerOut = () => {
    onSatelliteHover(null, 0, 0);
    document.body.style.cursor = 'auto';
  };

  // When a satellite is selected, only show that satellite
  // Otherwise show all filtered satellites
  const visibleSatellites = selectedSatellite
    ? filteredSatellites.filter(sat => sat.id === selectedSatellite.id)
    : filteredSatellites;

  return (
    <group>
      {/* Render orbit path for selected satellite */}
      {selectedSatellite && filters[selectedSatellite.category] && (
        <OrbitPath satellite={selectedSatellite} />
      )}
      
      {visibleSatellites.map(satellite => (
        <SatelliteMarker
          key={satellite.id}
          satellite={satellite}
          isSelected={selectedSatellite?.id === satellite.id}
          onClick={() => onSatelliteClick(satellite)}
          onPointerOver={handlePointerOver(satellite)}
          onPointerOut={handlePointerOut}
        />
      ))}
    </group>
  );
}

// Orbit zone indicators showing LEO, MEO, GEO ranges
function OrbitZones() {
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  
  // Show orbit zone boundaries - each ring marks the OUTER edge of the zone
  // Uses VISUAL_RADII directly for exact positioning
  const leoOuterRadius = VISUAL_RADII.leoMax;   // LEO outer boundary at 2,000 km
  const meoOuterRadius = VISUAL_RADII.meoMax;   // MEO outer boundary at 35,786 km (GEO altitude)
  const geoRadius = VISUAL_RADII.geoMax;        // GEO ring slightly beyond
  
  const zones = [
    { 
      name: 'LEO', 
      fullName: 'Low Earth Orbit',
      radius: leoOuterRadius, 
      color: '#00FF41', 
      altitude: '160 - 2,000 km',
      period: '88 - 127 min',
      uses: 'ISS, Imaging, Starlink, Internet',
      examples: 'ISS, Hubble, Starlink'
    },
    { 
      name: 'MEO', 
      fullName: 'Medium Earth Orbit',
      radius: meoOuterRadius, 
      color: '#00D4FF', 
      altitude: '2,000 - 35,786 km',
      period: '2 - 24 hours',
      uses: 'Navigation (GPS, Galileo, GLONASS)',
      examples: 'GPS, Galileo, GLONASS'
    },
    { 
      name: 'GEO', 
      fullName: 'Geostationary Orbit',
      radius: geoRadius, 
      color: '#FFB300', 
      altitude: '35,786 km',
      period: '24 hours (stationary)',
      uses: 'Weather, Television, Telecom',
      examples: 'GOES, DirecTV, Intelsat'
    },
  ];
  
  // Generate circle points for each zone — static, computed once
  const zoneCircles = useMemo(() => {
    const generateCircle = (radius: number) => {
      const points: THREE.Vector3[] = [];
      for (let i = 0; i <= 360; i += 2) {
        const angle = (i * Math.PI) / 180;
        points.push(new THREE.Vector3(
          radius * Math.cos(angle),
          0,
          radius * Math.sin(angle)
        ));
      }
      return points;
    };
    return {
      LEO: generateCircle(leoOuterRadius),
      MEO: generateCircle(meoOuterRadius),
      GEO: generateCircle(geoRadius),
    } as Record<string, THREE.Vector3[]>;
  }, [leoOuterRadius, meoOuterRadius, geoRadius]);


  const handleZoneClick = (zoneName: string) => {
    const opening = selectedZone !== zoneName;
    setSelectedZone(opening ? zoneName : null);
    if (opening) trackOrbitZoneClick(zoneName);
  };
  
  return (
    <group>
      {zones.map(zone => {
        const isSelected = selectedZone === zone.name;
        
        return (
          <group key={zone.name}>
            {/* Main orbit ring - horizontal, dashed to distinguish from satellite orbits */}
            <Line
              points={zoneCircles[zone.name]}
              color={zone.color}
              lineWidth={isSelected ? 2 : 1}
              opacity={isSelected ? 0.45 : 0.2}
              transparent
              dashed
              dashSize={0.15}
              gapSize={0.1}
            />
            
            {/* Label - clickable */}
            <Html position={[zone.radius + 0.15, 0.15, 0]} center>
              <button
                onClick={() => handleZoneClick(zone.name)}
                className={`text-xs font-mono px-2 py-1 rounded transition-all cursor-pointer ${
                  isSelected 
                    ? 'bg-[rgba(0,0,0,0.9)] border opacity-100' 
                    : 'bg-[rgba(0,0,0,0.6)] border border-transparent opacity-70 hover:opacity-100'
                }`}
                style={{ 
                  color: zone.color,
                  borderColor: isSelected ? zone.color : 'transparent'
                }}
              >
                {zone.name}
              </button>
            </Html>
            
            {/* Description box when selected */}
            {isSelected && (
              <Html position={[zone.radius + 0.5, -0.5, 0]} center>
                <div 
                  className="bg-[rgba(0,0,0,0.95)] border rounded-lg p-3 w-56 text-xs font-mono"
                  style={{ borderColor: zone.color }}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between mb-2 pb-2 border-b" style={{ borderColor: `${zone.color}40` }}>
                    <span style={{ color: zone.color }} className="font-bold">{zone.fullName}</span>
                    <button 
                      onClick={() => setSelectedZone(null)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      [x]
                    </button>
                  </div>
                  
                  {/* Details */}
                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">ALTITUDE:</span>
                      <span className="text-foreground">{zone.altitude}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">PERIOD:</span>
                      <span className="text-foreground">{zone.period}</span>
                    </div>
                    <div className="mt-2">
                      <span className="text-muted-foreground">PRIMARY USE:</span>
                      <div className="text-foreground mt-0.5">{zone.uses}</div>
                    </div>
                    <div className="mt-2">
                      <span className="text-muted-foreground">EXAMPLES:</span>
                      <div style={{ color: zone.color }} className="mt-0.5">{zone.examples}</div>
                    </div>
                  </div>
                </div>
              </Html>
            )}
          </group>
        );
      })}
    </group>
  );
}

// Lat/lon grid lines — Earth-fixed, rendered inside the rotating Earth group
function GridLines() {
  const lines = useMemo(() => {
    const result: THREE.Vector3[][] = [];

    for (let lat = -60; lat <= 60; lat += 30) {
      const points: THREE.Vector3[] = [];
      for (let lon = 0; lon <= 360; lon += 10) {
        points.push(latLonToVector3(lat, lon - 180, 2.005));
      }
      result.push(points);
    }

    for (let lon = 0; lon < 360; lon += 30) {
      const points: THREE.Vector3[] = [];
      for (let lat = -90; lat <= 90; lat += 10) {
        points.push(latLonToVector3(lat, lon - 180, 2.005));
      }
      result.push(points);
    }

    return result;
  }, []);

  return (
    <group>
      {lines.map((points, i) => (
        <Line
          key={i}
          points={points}
          color="#1a3a4a"
          lineWidth={0.5}
          opacity={0.4}
          transparent
        />
      ))}
    </group>
  );
}



// Loading fallback
function LoadingFallback() {
  return (
    <Html center>
      <div className="text-[#00FF41] font-mono text-sm">
        Loading Earth...
        <span className="cursor-blink ml-1">|</span>
      </div>
    </Html>
  );
}

// Background click handler component - only triggers on actual clicks, not drags
interface BackgroundClickProps {
  onBackgroundClick: () => void;
}

function BackgroundClick({ onBackgroundClick }: BackgroundClickProps) {
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null);
  
  const handlePointerDown = (e: THREE.Event) => {
    const event = e as unknown as { clientX: number; clientY: number };
    pointerDownPos.current = { x: event.clientX, y: event.clientY };
  };
  
  const handlePointerUp = (e: THREE.Event) => {
    if (!pointerDownPos.current) return;
    
    const event = e as unknown as { clientX: number; clientY: number };
    const dx = Math.abs(event.clientX - pointerDownPos.current.x);
    const dy = Math.abs(event.clientY - pointerDownPos.current.y);
    
    // Only trigger click if pointer didn't move much (not a drag)
    if (dx < 5 && dy < 5) {
      onBackgroundClick();
    }
    
    pointerDownPos.current = null;
  };
  
  return (
    <mesh 
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
    >
      <sphereGeometry args={[50, 16, 16]} />
      <meshBasicMaterial transparent opacity={0} side={THREE.BackSide} />
    </mesh>
  );
}

// Main component
export function EarthScene({
  satellites,
  selectedSatellite,
  onSatelliteClick,
  onSatelliteHover,
  filters,
  isSimulating,
  onSimElapsedUpdate,
  onOrionClick,
  isOrionSelected,
  isPlayback,
  isStarlinkActive,
  onStarlinkSelect,
  selectedStarlink,
}: EarthSceneProps) {
  const [moonSelected, setMoonSelected] = useState(false);

  const handleSatelliteClick = (satellite: Satellite) => {
    setMoonSelected(false);
    onStarlinkSelect?.(null);
    onSatelliteClick(satellite);
  };

  const handleMoonClick = () => {
    setMoonSelected(prev => {
      if (!prev) trackMoonClick();
      return !prev;
    });
  };

  const handleBackgroundClick = () => {
    setMoonSelected(false);
    onStarlinkSelect?.(null);
    if (selectedSatellite) {
      onSatelliteClick(selectedSatellite);
    }
  };

  return (
    <Canvas
      camera={{ position: [0, 3, 10], fov: 45 }}
      gl={{ antialias: true, alpha: true }}
      style={{ background: 'transparent' }}
    >
      {/* Real sun — drives the moon phase and spacecraft shading */}
      <SunLight />
      {/* Fills so the unlit side stays readable */}
      <ambientLight intensity={0.3} />
      <directionalLight position={[-5, -3, -5]} intensity={0.2} color="#4488cc" />

      {/* Invisible background sphere to catch clicks */}
      <BackgroundClick onBackgroundClick={handleBackgroundClick} />

      <Suspense fallback={<LoadingFallback />}>
        <Earth />
        <Moon
          isSelected={moonSelected}
          onMoonClick={handleMoonClick}
        />
        <OrbitZones />
        <Satellites
          satellites={satellites}
          selectedSatellite={selectedSatellite}
          onSatelliteClick={handleSatelliteClick}
          onSatelliteHover={onSatelliteHover}
          filters={filters}
        />
        {isSimulating && onSimElapsedUpdate && (
          <ArtemisSimulation
            isSimulating={isSimulating}
            onElapsedUpdate={onSimElapsedUpdate}
            onOrionClick={onOrionClick}
            isOrionSelected={isOrionSelected}
            isPlayback={!!isPlayback}
          />
        )}
        {isStarlinkActive && (
          <StarlinkSimulation isSimulating={isStarlinkActive} onStarlinkSelect={onStarlinkSelect} selectedSat={selectedStarlink} />
        )}
      </Suspense>

      <OrbitControls
        enablePan={false}
        enableZoom={true}
        minDistance={4}
        maxDistance={40}
        autoRotate={false}
        enableDamping
        dampingFactor={0.05}
      />
    </Canvas>
  );
}
