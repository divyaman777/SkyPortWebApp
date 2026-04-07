'use client';

import { useRef, useState, useEffect, useMemo, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import { Satellite, categoryColors, SatelliteCategory } from '@/lib/satellite-data';
import { computeECIPosition, computeOrbitPathECI, computeMoonPositionECI, computeMoonOrbitNormal, getJWSTPositionECI, getGMST } from '@/lib/satellite-engine';
import { trackMoonClick, trackOrbitZoneClick } from '@/lib/analytics';
import { registerPresence, subscribePresence, type ActiveUser } from '@/lib/presence';

// ─── GeoJSON Border Loading ─────────────────────────────────
const WORLD_GEOJSON_URL = 'https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json';
const INDIA_GEOJSON_URL = 'https://raw.githubusercontent.com/AbhinavSwami28/india-official-geojson/main/india-states-simplified.geojson';

// Convert GeoJSON geometry to 3D line arrays on the sphere
function geoJSONToLines(geometry: { type: string; coordinates: number[][][] | number[][][][] }, radius: number): THREE.Vector3[][] {
  const lines: THREE.Vector3[][] = [];

  if (geometry.type === 'Polygon') {
    for (const ring of geometry.coordinates as number[][][]) {
      if (ring.length > 2) {
        lines.push(ring.map(([lon, lat]) => latLonToVector3(lat, lon, radius)));
      }
    }
  } else if (geometry.type === 'MultiPolygon') {
    for (const polygon of geometry.coordinates as number[][][][]) {
      for (const ring of polygon) {
        if (ring.length > 2) {
          lines.push(ring.map(([lon, lat]) => latLonToVector3(lat, lon, radius)));
        }
      }
    }
  }

  return lines;
}

// Module-level cache so borders load only once across remounts
let cachedBorderLines: THREE.Vector3[][] | null = null;
let borderLoadPromise: Promise<THREE.Vector3[][]> | null = null;

async function loadGeoJSONBorders(radius: number): Promise<THREE.Vector3[][]> {
  if (cachedBorderLines) return cachedBorderLines;
  if (borderLoadPromise) return borderLoadPromise;

  borderLoadPromise = (async () => {
    const [worldRes, indiaRes] = await Promise.all([
      fetch(WORLD_GEOJSON_URL),
      fetch(INDIA_GEOJSON_URL),
    ]);

    const worldData = await worldRes.json();
    const indiaData = await indiaRes.json();

    // Remove incorrect India and Pakistan from world data
    const filteredFeatures = worldData.features.filter((f: { properties?: { name?: string } }) => {
      const name = (f.properties?.name || '').toLowerCase();
      return name !== 'india' && name !== 'pakistan';
    });

    // Add official India state boundaries
    const indiaFeatures = indiaData.features.map((f: { properties?: Record<string, string>; [key: string]: unknown }) => ({
      ...f,
      properties: { ...f.properties, name: f.properties?.name || 'India' },
    }));

    const allFeatures = [...filteredFeatures, ...indiaFeatures];

    const lines: THREE.Vector3[][] = [];
    for (const feature of allFeatures) {
      if (feature.geometry) {
        lines.push(...geoJSONToLines(feature.geometry, radius));
      }
    }

    cachedBorderLines = lines;
    console.log(`[SKYPORT] Loaded ${lines.length} border segments from GeoJSON`);
    return lines;
  })();

  return borderLoadPromise;
}

interface EarthSceneProps {
  satellites: Satellite[];
  selectedSatellite: Satellite | null;
  onSatelliteClick: (satellite: Satellite) => void;
  onSatelliteHover: (satellite: Satellite | null, x: number, y: number) => void;
  filters: Record<SatelliteCategory, boolean>;
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

// Simulation time: 120x real-time — Earth rotates once per ~12 min, satellites still clickable
const TIME_SCALE = 120;
// Moon revolution multiplier — Moon orbits in ~22 min (real: 27.3 days per Earth rotation × 27.3)
// Keeps Moon visibly moving without spinning unrealistically fast
const MOON_SPEED_MULT = 15;
// Moon tidal-lock rotation rate: one rotation per orbit (rad/s in sim time)
const MOON_ROT_RATE = (2 * Math.PI) / (27.3 * 24 * 3600 / (TIME_SCALE * MOON_SPEED_MULT));
const simStartReal = Date.now();
const simStartDate = new Date();

function getSimDate(): Date {
  const realElapsed = Date.now() - simStartReal;
  return new Date(simStartDate.getTime() + realElapsed * TIME_SCALE);
}

function getMoonSimDate(): Date {
  const realElapsed = Date.now() - simStartReal;
  return new Date(simStartDate.getTime() + realElapsed * TIME_SCALE * MOON_SPEED_MULT);
}

// Earth rotation state
let earthRotation = 0;

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
  const [borderLines, setBorderLines] = useState<THREE.Vector3[][]>([]);

  // Fetch GeoJSON borders on mount
  useEffect(() => {
    loadGeoJSONBorders(2.01).then(setBorderLines).catch(err => {
      console.warn('[SKYPORT] GeoJSON border load failed:', err);
    });
  }, []);

  useFrame(() => {
    if (earthRef.current) {
      earthRotation = getGMST(getSimDate());
      earthRef.current.rotation.y = earthRotation;
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
  const [observerLat, setObserverLat] = useState(40.7128); // Default: New York
  const [observerLon, setObserverLon] = useState(-74.0060);

  // Get approximate location from IP address (no permission popup) and register presence
  useEffect(() => {
    let cleanup: (() => void) | null = null;

    fetch('https://ipapi.co/json/')
      .then(r => r.json())
      .then(data => {
        if (data.latitude && data.longitude) {
          setObserverLat(data.latitude);
          setObserverLon(data.longitude);
          console.log(`[SKYPORT] Observer location (IP): ${data.latitude.toFixed(2)}, ${data.longitude.toFixed(2)} (${data.city || 'unknown'})`);
          // Register presence in Firebase for live user density map
          cleanup = registerPresence(data.latitude, data.longitude);
        }
      })
      .catch(() => {
        console.log('[SKYPORT] IP geolocation failed, using default (New York)');
      });

    return () => { if (cleanup) cleanup(); };
  }, []);

  const position = useMemo(() => {
    return latLonToVector3(observerLat, observerLon, 2.03);
  }, [observerLat, observerLon]);
  
  useFrame((state) => {
    if (markerRef.current) {
      // Pulse effect
      const scale = 1 + Math.sin(state.clock.getElapsedTime() * 3) * 0.2;
      markerRef.current.scale.setScalar(scale);
    }
  });
  
  return (
    <group position={position}>
      <group ref={markerRef}>
        {/* Observer dot */}
        <mesh>
          <sphereGeometry args={[0.04, 16, 16]} />
          <meshBasicMaterial color="#FF4444" />
        </mesh>
        {/* Glow ring */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.06, 0.08, 32]} />
          <meshBasicMaterial color="#FF4444" transparent opacity={0.6} side={THREE.DoubleSide} />
        </mesh>
        {/* Outer pulse ring */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.1, 0.11, 32]} />
          <meshBasicMaterial color="#FF4444" transparent opacity={0.3} side={THREE.DoubleSide} />
        </mesh>
      </group>
      {/* Label */}
      <Html position={[0, 0.12, 0]} center>
        <div className="bg-[rgba(0,0,0,0.8)] border border-[rgba(255,68,68,0.5)] px-2 py-0.5 rounded text-xs whitespace-nowrap">
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
          <sphereGeometry args={[0.012, 6, 6]} />
          <meshBasicMaterial color="#00D4FF" transparent opacity={0.6} />
        </mesh>
      ))}
    </group>
  );
}

// Moon sizing — real ratio: Moon radius ≈ 0.273× Earth radius, orbit ≈ 60× Earth radii
// Visual compromise: orbit at 10× Earth radius so Moon is visible but clearly distant
const MOON_RADIUS = 0.55; // 0.273 × 2 (Earth radius) ≈ 0.55
const MOON_ORBIT_RADIUS = 20; // 10× Earth radius — visible compromise vs real 60×

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

  useFrame((_, delta) => {
    // Compute Moon ECI position at accelerated moon time
    const now = Date.now();
    if (now - lastMoonUpdate.current > 50) {
      lastMoonUpdate.current = now;
      const moonDate = getMoonSimDate();
      const moonEci = computeMoonPositionECI(moonDate);
      moonTargetPos.current = eciDirToThreeJS(moonEci.eciX, moonEci.eciY, moonEci.eciZ, MOON_ORBIT_RADIUS);
    }
    if (moonRef.current) {
      moonRef.current.position.lerp(moonTargetPos.current, 0.15);
    }
    // Moon axis rotation (tidally locked — one rotation per orbit)
    if (moonMeshRef.current) {
      moonMeshRef.current.rotation.y += delta * MOON_ROT_RATE;
    }
  });

  // Moon orbit — smooth geometric ellipse in the computed orbital plane
  const moonOrbitPoints = useMemo(() => {
    const normalEci = computeMoonOrbitNormal();
    // Convert ECI normal to Three.js space
    const normal = new THREE.Vector3(normalEci.eciX, normalEci.eciZ, -normalEci.eciY).normalize();

    // Build orthonormal basis in the orbital plane
    const arbitrary = Math.abs(normal.y) < 0.9
      ? new THREE.Vector3(0, 1, 0)
      : new THREE.Vector3(1, 0, 0);
    const u = new THREE.Vector3().crossVectors(arbitrary, normal).normalize();
    const v = new THREE.Vector3().crossVectors(normal, u).normalize();

    // Smooth ellipse (Moon eccentricity ~0.0549)
    const a = MOON_ORBIT_RADIUS;
    const b = MOON_ORBIT_RADIUS * Math.sqrt(1 - 0.0549 * 0.0549); // ≈ 0.9985
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= 360; i++) {
      const angle = (i * Math.PI) / 180;
      const px = a * Math.cos(angle);
      const py = b * Math.sin(angle);
      points.push(new THREE.Vector3(
        px * u.x + py * v.x,
        px * u.y + py * v.y,
        px * u.z + py * v.z,
      ));
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
          onClick={onMoonClick}
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
    // GEO and beyond: 35786km+ maps to radius 4.5+
    const extra = altitude - ORBIT_ZONES.GEO.altitude;
    return meoMax + (extra * 0.00001);
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

// ISS — cylindrical modules + 4 large accordion-style solar array wings + truss
function ISSModel({ color }: { color: string }) {
  const panelColor = '#1a3a5c';
  const panelEmissive = '#0a2040';
  return (
    <group scale={1.8}>
      {/* Main pressurized module (Zarya-like) */}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.025, 0.025, 0.12, 12]} />
        <meshStandardMaterial color="#e8e4dc" roughness={0.6} metalness={0.3} emissive="#e8e4dc" emissiveIntensity={0.15} />
      </mesh>
      {/* Forward module */}
      <mesh position={[0.07, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.02, 0.022, 0.04, 12]} />
        <meshStandardMaterial color="#d4cfc5" roughness={0.5} metalness={0.3} emissive="#d4cfc5" emissiveIntensity={0.1} />
      </mesh>
      {/* Truss (horizontal backbone) */}
      <mesh>
        <boxGeometry args={[0.02, 0.008, 0.28]} />
        <meshStandardMaterial color="#b0a898" roughness={0.7} metalness={0.4} emissive="#b0a898" emissiveIntensity={0.1} />
      </mesh>
      {/* Solar array wing 1 (port far) */}
      <mesh position={[0, 0, 0.12]}>
        <boxGeometry args={[0.1, 0.003, 0.06]} />
        <meshStandardMaterial color={panelColor} roughness={0.3} metalness={0.6} emissive={panelEmissive} emissiveIntensity={0.4} />
      </mesh>
      {/* Solar array wing 2 (port near) */}
      <mesh position={[0, 0, 0.06]}>
        <boxGeometry args={[0.1, 0.003, 0.04]} />
        <meshStandardMaterial color={panelColor} roughness={0.3} metalness={0.6} emissive={panelEmissive} emissiveIntensity={0.4} />
      </mesh>
      {/* Solar array wing 3 (starboard near) */}
      <mesh position={[0, 0, -0.06]}>
        <boxGeometry args={[0.1, 0.003, 0.04]} />
        <meshStandardMaterial color={panelColor} roughness={0.3} metalness={0.6} emissive={panelEmissive} emissiveIntensity={0.4} />
      </mesh>
      {/* Solar array wing 4 (starboard far) */}
      <mesh position={[0, 0, -0.12]}>
        <boxGeometry args={[0.1, 0.003, 0.06]} />
        <meshStandardMaterial color={panelColor} roughness={0.3} metalness={0.6} emissive={panelEmissive} emissiveIntensity={0.4} />
      </mesh>
      {/* Docking port indicators */}
      <mesh position={[0.09, 0, 0]}>
        <sphereGeometry args={[0.006, 8, 8]} />
        <meshStandardMaterial color="#cccccc" emissive="#aaaaaa" emissiveIntensity={0.3} />
      </mesh>
      <mesh position={[-0.065, 0, 0]}>
        <sphereGeometry args={[0.006, 8, 8]} />
        <meshStandardMaterial color="#cccccc" emissive="#aaaaaa" emissiveIntensity={0.3} />
      </mesh>
      {/* Radiator panels (copper/gold tint) */}
      <mesh position={[0.03, 0.015, 0.03]} rotation={[0, 0.3, 0]}>
        <boxGeometry args={[0.04, 0.002, 0.015]} />
        <meshStandardMaterial color="#c8956c" roughness={0.4} metalness={0.7} emissive="#c8956c" emissiveIntensity={0.15} />
      </mesh>
      <mesh position={[0.03, 0.015, -0.03]} rotation={[0, -0.3, 0]}>
        <boxGeometry args={[0.04, 0.002, 0.015]} />
        <meshStandardMaterial color="#c8956c" roughness={0.4} metalness={0.7} emissive="#c8956c" emissiveIntensity={0.15} />
      </mesh>
    </group>
  );
}

// Hubble — silver cylinder + aperture door + two rectangular solar panels
function HubbleModel() {
  return (
    <group scale={1.4}>
      {/* Main tube (silver metallic) */}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.03, 0.03, 0.14, 16]} />
        <meshStandardMaterial color="#c0c0c0" roughness={0.25} metalness={0.85} emissive="#808080" emissiveIntensity={0.1} />
      </mesh>
      {/* Aperture door (darker ring at front) */}
      <mesh position={[0.07, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.032, 0.028, 0.01, 16]} />
        <meshStandardMaterial color="#555555" roughness={0.4} metalness={0.8} emissive="#333333" emissiveIntensity={0.15} />
      </mesh>
      {/* Aft shroud (slightly wider) */}
      <mesh position={[-0.06, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.035, 0.032, 0.03, 16]} />
        <meshStandardMaterial color="#aaaaaa" roughness={0.3} metalness={0.8} emissive="#777777" emissiveIntensity={0.1} />
      </mesh>
      {/* Solar panel left */}
      <mesh position={[0, 0, 0.055]}>
        <boxGeometry args={[0.08, 0.003, 0.035]} />
        <meshStandardMaterial color="#1a2a4a" roughness={0.3} metalness={0.5} emissive="#0a1530" emissiveIntensity={0.4} />
      </mesh>
      {/* Solar panel right */}
      <mesh position={[0, 0, -0.055]}>
        <boxGeometry args={[0.08, 0.003, 0.035]} />
        <meshStandardMaterial color="#1a2a4a" roughness={0.3} metalness={0.5} emissive="#0a1530" emissiveIntensity={0.4} />
      </mesh>
      {/* High-gain antenna arm */}
      <mesh position={[0.02, 0.035, 0]} rotation={[0, 0, 0.2]}>
        <cylinderGeometry args={[0.002, 0.002, 0.04, 6]} />
        <meshStandardMaterial color="#cccccc" roughness={0.5} metalness={0.6} />
      </mesh>
      <mesh position={[0.03, 0.05, 0]}>
        <sphereGeometry args={[0.008, 8, 8]} />
        <meshStandardMaterial color="#dddddd" roughness={0.4} metalness={0.7} emissive="#aaaaaa" emissiveIntensity={0.15} />
      </mesh>
    </group>
  );
}

// GOES-16/18 — boxy bus + single large solar wing + ABI instrument
function GOESModel() {
  return (
    <group scale={1.3}>
      {/* Spacecraft bus */}
      <mesh>
        <boxGeometry args={[0.06, 0.05, 0.05]} />
        <meshStandardMaterial color="#e0ddd5" roughness={0.5} metalness={0.3} emissive="#c0bdb5" emissiveIntensity={0.1} />
      </mesh>
      {/* ABI instrument (dark lens on nadir face) */}
      <mesh position={[0, -0.028, 0]}>
        <cylinderGeometry args={[0.015, 0.012, 0.008, 12]} />
        <meshStandardMaterial color="#222222" roughness={0.2} metalness={0.9} emissive="#111111" emissiveIntensity={0.2} />
      </mesh>
      {/* GLM (smaller instrument beside ABI) */}
      <mesh position={[0.015, -0.028, 0.015]}>
        <cylinderGeometry args={[0.006, 0.006, 0.006, 8]} />
        <meshStandardMaterial color="#333333" roughness={0.3} metalness={0.8} />
      </mesh>
      {/* Single large solar array (extending to one side) */}
      <mesh position={[0, 0, 0.08]}>
        <boxGeometry args={[0.08, 0.003, 0.08]} />
        <meshStandardMaterial color="#1a2a4a" roughness={0.3} metalness={0.5} emissive="#0a1530" emissiveIntensity={0.4} />
      </mesh>
      {/* Solar array yoke/arm */}
      <mesh position={[0, 0, 0.04]}>
        <boxGeometry args={[0.006, 0.006, 0.03]} />
        <meshStandardMaterial color="#999999" roughness={0.5} metalness={0.5} />
      </mesh>
      {/* Antenna dish */}
      <mesh position={[-0.035, 0.01, 0]} rotation={[0, 0, Math.PI / 6]}>
        <coneGeometry args={[0.015, 0.01, 12]} />
        <meshStandardMaterial color="#dddddd" roughness={0.4} metalness={0.6} emissive="#aaaaaa" emissiveIntensity={0.1} />
      </mesh>
      {/* Gold Kapton thermal foil accents */}
      <mesh position={[0.032, 0, 0]}>
        <boxGeometry args={[0.002, 0.048, 0.048]} />
        <meshStandardMaterial color="#c8a832" roughness={0.35} metalness={0.8} emissive="#8a7420" emissiveIntensity={0.15} />
      </mesh>
    </group>
  );
}

// NOAA-19 — tall slender bus + single solar wing + AVHRR sensor
function NOAAModel() {
  return (
    <group scale={1.3}>
      {/* Tall slender spacecraft bus */}
      <mesh>
        <boxGeometry args={[0.03, 0.07, 0.03]} />
        <meshStandardMaterial color="#d8d5cc" roughness={0.5} metalness={0.3} emissive="#b8b5ac" emissiveIntensity={0.1} />
      </mesh>
      {/* Single solar wing */}
      <mesh position={[0, 0, 0.055]}>
        <boxGeometry args={[0.06, 0.003, 0.05]} />
        <meshStandardMaterial color="#1a2a4a" roughness={0.3} metalness={0.5} emissive="#0a1530" emissiveIntensity={0.4} />
      </mesh>
      {/* Solar wing arm */}
      <mesh position={[0, 0, 0.03]}>
        <boxGeometry args={[0.004, 0.004, 0.02]} />
        <meshStandardMaterial color="#888888" roughness={0.5} metalness={0.5} />
      </mesh>
      {/* AVHRR/3 sensor (bottom) */}
      <mesh position={[0, -0.04, 0]} rotation={[0, 0, 0]}>
        <cylinderGeometry args={[0.012, 0.01, 0.012, 10]} />
        <meshStandardMaterial color="#444444" roughness={0.3} metalness={0.7} emissive="#222222" emissiveIntensity={0.2} />
      </mesh>
      {/* Antenna mast (top) */}
      <mesh position={[0, 0.045, 0]}>
        <cylinderGeometry args={[0.002, 0.002, 0.025, 6]} />
        <meshStandardMaterial color="#cccccc" roughness={0.5} metalness={0.6} />
      </mesh>
      {/* UHF antenna */}
      <mesh position={[0.015, 0.04, 0]} rotation={[0, 0, -0.4]}>
        <cylinderGeometry args={[0.001, 0.001, 0.02, 4]} />
        <meshStandardMaterial color="#bbbbbb" roughness={0.5} metalness={0.6} />
      </mesh>
    </group>
  );
}

// Landsat 9 — rugged boxy bus + 3-panel solar array + instrument apertures
function LandsatModel() {
  return (
    <group scale={1.3}>
      {/* Spacecraft bus */}
      <mesh>
        <boxGeometry args={[0.04, 0.05, 0.04]} />
        <meshStandardMaterial color="#d0cdc5" roughness={0.55} metalness={0.3} emissive="#b0ada5" emissiveIntensity={0.1} />
      </mesh>
      {/* 3-panel solar array */}
      <mesh position={[0, 0, 0.07]}>
        <boxGeometry args={[0.035, 0.003, 0.03]} />
        <meshStandardMaterial color="#1a2a4a" roughness={0.3} metalness={0.5} emissive="#0a1530" emissiveIntensity={0.4} />
      </mesh>
      <mesh position={[0, 0, 0.1]}>
        <boxGeometry args={[0.035, 0.003, 0.03]} />
        <meshStandardMaterial color="#1a2a4a" roughness={0.3} metalness={0.5} emissive="#0a1530" emissiveIntensity={0.4} />
      </mesh>
      <mesh position={[0, 0, 0.13]}>
        <boxGeometry args={[0.035, 0.003, 0.03]} />
        <meshStandardMaterial color="#1a2a4a" roughness={0.3} metalness={0.5} emissive="#0a1530" emissiveIntensity={0.4} />
      </mesh>
      {/* Solar array arm */}
      <mesh position={[0, 0, 0.045]}>
        <boxGeometry args={[0.004, 0.004, 0.03]} />
        <meshStandardMaterial color="#888888" roughness={0.5} metalness={0.5} />
      </mesh>
      {/* OLI-2 instrument aperture (Earth-facing) */}
      <mesh position={[0.01, -0.028, 0]}>
        <cylinderGeometry args={[0.01, 0.008, 0.008, 10]} />
        <meshStandardMaterial color="#333333" roughness={0.3} metalness={0.8} emissive="#1a1a1a" emissiveIntensity={0.2} />
      </mesh>
      {/* TIRS-2 instrument aperture */}
      <mesh position={[-0.01, -0.028, 0]}>
        <cylinderGeometry args={[0.008, 0.006, 0.008, 10]} />
        <meshStandardMaterial color="#2a2a2a" roughness={0.3} metalness={0.8} emissive="#151515" emissiveIntensity={0.2} />
      </mesh>
      {/* Gold thermal foil on one face */}
      <mesh position={[0.022, 0, 0]}>
        <boxGeometry args={[0.002, 0.048, 0.038]} />
        <meshStandardMaterial color="#c8a832" roughness={0.35} metalness={0.8} emissive="#8a7420" emissiveIntensity={0.15} />
      </mesh>
    </group>
  );
}

// JWST — hexagonal gold mirror array + secondary mirror tripod + kite-shaped sunshield
function JWSTModel() {
  const goldColor = '#d4a017';
  const goldEmissive = '#8a6a10';
  // Hexagonal mirror segments arranged in the iconic pattern
  const hexPositions = [
    [0, 0.015, 0], [-0.022, 0.015, 0.013], [0.022, 0.015, 0.013],
    [-0.022, 0.015, -0.013], [0.022, 0.015, -0.013], [0, 0.015, 0.026],
    [0, 0.015, -0.026], [-0.044, 0.015, 0], [0.044, 0.015, 0],
    [-0.033, 0.015, 0.02], [0.033, 0.015, 0.02], [-0.033, 0.015, -0.02],
    [0.033, 0.015, -0.02], [-0.011, 0.015, 0.033], [0.011, 0.015, 0.033],
    [-0.011, 0.015, -0.033], [0.011, 0.015, -0.033], [0.044, 0.015, 0.013],
  ];
  return (
    <group scale={1.6}>
      {/* Primary mirror — 18 gold hexagonal segments */}
      {hexPositions.map((pos, i) => (
        <mesh key={i} position={pos as [number, number, number]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.011, 0.011, 0.002, 6]} />
          <meshStandardMaterial color={goldColor} roughness={0.15} metalness={0.95} emissive={goldEmissive} emissiveIntensity={0.3} />
        </mesh>
      ))}
      {/* Secondary mirror on tripod */}
      <mesh position={[0, 0.06, 0]}>
        <cylinderGeometry args={[0.005, 0.005, 0.002, 6]} />
        <meshStandardMaterial color={goldColor} roughness={0.2} metalness={0.9} emissive={goldEmissive} emissiveIntensity={0.25} />
      </mesh>
      {/* Tripod struts */}
      {[0, 2.1, 4.2].map((angle, i) => (
        <mesh key={`strut-${i}`} position={[
          Math.sin(angle) * 0.025, 0.038, Math.cos(angle) * 0.025
        ]} rotation={[Math.sin(angle) * 0.6, 0, -Math.cos(angle) * 0.6]}>
          <cylinderGeometry args={[0.001, 0.001, 0.06, 4]} />
          <meshStandardMaterial color="#aaaaaa" roughness={0.5} metalness={0.6} />
        </mesh>
      ))}
      {/* Sunshield — 5-layer kite shape (purple/silver Kapton) */}
      <mesh position={[0, -0.02, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <boxGeometry args={[0.11, 0.065, 0.008]} />
        <meshStandardMaterial color="#8a6aaa" roughness={0.4} metalness={0.6} emissive="#4a3a6a" emissiveIntensity={0.2} transparent opacity={0.85} />
      </mesh>
      {/* Sunshield silver bottom layer */}
      <mesh position={[0, -0.026, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <boxGeometry args={[0.12, 0.07, 0.002]} />
        <meshStandardMaterial color="#c0c0c0" roughness={0.3} metalness={0.8} emissive="#808080" emissiveIntensity={0.1} transparent opacity={0.6} />
      </mesh>
      {/* Spacecraft bus (behind sunshield) */}
      <mesh position={[0, -0.01, 0]}>
        <boxGeometry args={[0.03, 0.015, 0.02]} />
        <meshStandardMaterial color="#888888" roughness={0.5} metalness={0.5} emissive="#555555" emissiveIntensity={0.1} />
      </mesh>
    </group>
  );
}

// AO-91 CubeSat — 1U cube with solar cells on all faces + whip antennas
function CubeSatModel({ color }: { color: string }) {
  return (
    <group scale={1.2}>
      {/* 1U CubeSat body — dark with solar cell tint */}
      <mesh>
        <boxGeometry args={[0.03, 0.03, 0.03]} />
        <meshStandardMaterial color="#1a1a2a" roughness={0.4} metalness={0.5} emissive="#0a0a15" emissiveIntensity={0.3} />
      </mesh>
      {/* Solar cell faces (slightly offset, blue-black) */}
      {[
        { pos: [0, 0, 0.0155], rot: [0, 0, 0] },
        { pos: [0, 0, -0.0155], rot: [0, Math.PI, 0] },
        { pos: [0.0155, 0, 0], rot: [0, Math.PI / 2, 0] },
        { pos: [-0.0155, 0, 0], rot: [0, -Math.PI / 2, 0] },
        { pos: [0, 0.0155, 0], rot: [-Math.PI / 2, 0, 0] },
        { pos: [0, -0.0155, 0], rot: [Math.PI / 2, 0, 0] },
      ].map((face, i) => (
        <mesh key={i} position={face.pos as [number, number, number]} rotation={face.rot as [number, number, number]}>
          <planeGeometry args={[0.028, 0.028]} />
          <meshStandardMaterial color="#0d1525" roughness={0.3} metalness={0.6} emissive="#05101a" emissiveIntensity={0.3} />
        </mesh>
      ))}
      {/* Whip antenna 1 */}
      <mesh position={[0.015, 0.015, 0.015]} rotation={[0.4, 0, 0.4]}>
        <cylinderGeometry args={[0.0005, 0.0005, 0.04, 4]} />
        <meshStandardMaterial color="#cccccc" roughness={0.5} metalness={0.7} emissive="#888888" emissiveIntensity={0.2} />
      </mesh>
      {/* Whip antenna 2 */}
      <mesh position={[0.015, 0.015, 0.012]} rotation={[-0.3, 0, 0.5]}>
        <cylinderGeometry args={[0.0005, 0.0005, 0.035, 4]} />
        <meshStandardMaterial color="#cccccc" roughness={0.5} metalness={0.7} emissive="#888888" emissiveIntensity={0.2} />
      </mesh>
    </group>
  );
}

// Tiangong (CSS) — T-shaped station with core module + two lab modules + solar panels
function TiangongModel({ color }: { color: string }) {
  const panelColor = '#1a3a5c';
  return (
    <group scale={1.5}>
      {/* Core module (Tianhe) */}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.02, 0.02, 0.1, 12]} />
        <meshStandardMaterial color="#e0dcd4" roughness={0.5} metalness={0.3} emissive="#c0bcb4" emissiveIntensity={0.12} />
      </mesh>
      {/* Lab module 1 (Wentian) — perpendicular */}
      <mesh position={[0, 0, 0.04]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.018, 0.018, 0.06, 12]} />
        <meshStandardMaterial color="#d8d4cc" roughness={0.5} metalness={0.3} emissive="#b8b4ac" emissiveIntensity={0.1} />
      </mesh>
      {/* Lab module 2 (Mengtian) — perpendicular other side */}
      <mesh position={[0, 0, -0.04]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.018, 0.018, 0.06, 12]} />
        <meshStandardMaterial color="#d8d4cc" roughness={0.5} metalness={0.3} emissive="#b8b4ac" emissiveIntensity={0.1} />
      </mesh>
      {/* Solar panels (core) */}
      <mesh position={[0.06, 0, 0]}>
        <boxGeometry args={[0.04, 0.003, 0.08]} />
        <meshStandardMaterial color={panelColor} roughness={0.3} metalness={0.6} emissive="#0a1530" emissiveIntensity={0.4} />
      </mesh>
      <mesh position={[-0.06, 0, 0]}>
        <boxGeometry args={[0.04, 0.003, 0.08]} />
        <meshStandardMaterial color={panelColor} roughness={0.3} metalness={0.6} emissive="#0a1530" emissiveIntensity={0.4} />
      </mesh>
      {/* Solar panels (lab modules) */}
      <mesh position={[0, 0, 0.075]}>
        <boxGeometry args={[0.06, 0.003, 0.02]} />
        <meshStandardMaterial color={panelColor} roughness={0.3} metalness={0.6} emissive="#0a1530" emissiveIntensity={0.35} />
      </mesh>
      <mesh position={[0, 0, -0.075]}>
        <boxGeometry args={[0.06, 0.003, 0.02]} />
        <meshStandardMaterial color={panelColor} roughness={0.3} metalness={0.6} emissive="#0a1530" emissiveIntensity={0.35} />
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
  if (rid === 'goes-16' || rid === 'goes-18') return <GOESModel />;
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
        pos = eciDirToThreeJS(eciDir.eciX, eciDir.eciY, eciDir.eciZ, getOrbitRadius(satellite.altitude));
      } else {
        const eciPos = computeECIPosition(satellite.noradId, simDate);
        if (eciPos) {
          pos = eciToThreeJSSat(eciPos.eciX, eciPos.eciY, eciPos.eciZ);
        }
      }

      if (pos) {
        satelliteRef.current.position.lerp(pos, 0.2);
      }
    }
  });

  const satelliteScale = isStation ? 1.5 : isSelected || hovered ? 1.2 : 1;

  return (
    <group ref={satelliteRef}>
      <group
        onClick={onClick}
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

// Satellite orbit path - rendered at scene root, rotates with Earth
interface OrbitPathProps {
  satellite: Satellite;
}

function OrbitPath({ satellite }: OrbitPathProps) {
  const color = categoryColors[satellite.category];
  const isGeo = satellite.special === 'GEOSTATIONARY' || satellite.altitude > 35000;

  // Refresh orbit path every ~5 seconds to stay in sync with accelerated sim time
  const [epoch, setEpoch] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setEpoch(e => e + 1), 5000);
    return () => clearInterval(timer);
  }, []);

  // Compute orbit path in ECI coordinates at current sim time
  const orbitPoints = useMemo(() => {
    if (satellite.noradId <= 0) return [];

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
  }, [satellite.noradId, satellite.altitude, isGeo, epoch]);

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
  
  // Generate circle points for each zone
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
              points={generateCircle(zone.radius)}
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

// Grid lines around Earth
function GridLines() {
  const lines: THREE.Vector3[][] = [];
  
  for (let lat = -60; lat <= 60; lat += 30) {
    const points: THREE.Vector3[] = [];
    for (let lon = 0; lon <= 360; lon += 10) {
      points.push(latLonToVector3(lat, lon - 180, 2.005));
    }
    lines.push(points);
  }

  for (let lon = 0; lon < 360; lon += 30) {
    const points: THREE.Vector3[] = [];
    for (let lat = -90; lat <= 90; lat += 10) {
      points.push(latLonToVector3(lat, lon - 180, 2.005));
    }
    lines.push(points);
  }

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
  filters
}: EarthSceneProps) {
  const [moonSelected, setMoonSelected] = useState(false);

  const handleSatelliteClick = (satellite: Satellite) => {
    setMoonSelected(false);
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
      <ambientLight intensity={0.3} />
      <directionalLight position={[5, 3, 5]} intensity={1.2} />
      <directionalLight position={[-5, -3, -5]} intensity={0.3} color="#00D4FF" />
      <pointLight position={[0, 0, 10]} intensity={0.5} color="#FFB300" />

      {/* Invisible background sphere to catch clicks */}
      <BackgroundClick onBackgroundClick={handleBackgroundClick} />

      <Suspense fallback={<LoadingFallback />}>
        <Earth />
        <Moon
          isSelected={moonSelected}
          onMoonClick={handleMoonClick}
        />
        <GridLines />
        <OrbitZones />
        <Satellites
          satellites={satellites}
          selectedSatellite={selectedSatellite}
          onSatelliteClick={handleSatelliteClick}
          onSatelliteHover={onSatelliteHover}
          filters={filters}
        />
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
