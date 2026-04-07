'use client';

import { useRef, useState, useEffect, useMemo, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import { Satellite, categoryColors, SatelliteCategory } from '@/lib/satellite-data';
import { computeECIPosition, computeOrbitPathECI, computeMoonPositionECI, computeMoonOrbitNormal, getJWSTPositionECI, getGMST } from '@/lib/satellite-engine';

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
  const geoRequested = useRef(false);

  // Request geolocation once
  if (!geoRequested.current && typeof navigator !== 'undefined' && navigator.geolocation) {
    geoRequested.current = true;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setObserverLat(pos.coords.latitude);
        setObserverLon(pos.coords.longitude);
        console.log(`[SKYPORT] Observer location: ${pos.coords.latitude.toFixed(2)}, ${pos.coords.longitude.toFixed(2)}`);
      },
      () => { console.log('[SKYPORT] Geolocation denied, using default (New York)'); }
    );
  }

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
  const isISS = satellite.category === 'SPACE_STATION';

  // Position satellite using ECI coordinates (inertial frame)
  useFrame(() => {
    if (satelliteRef.current) {
      const simDate = getSimDate();
      let pos: THREE.Vector3 | null = null;

      if (satellite.special === 'L2_POINT') {
        // JWST: anti-sunward direction at visual radius
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
  
  const satelliteScale = isISS ? 1.5 : isSelected || hovered ? 1.2 : 1;
  
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
        {isISS ? (
          // ISS - larger with solar panels
          <group>
            <mesh>
              <boxGeometry args={[0.08, 0.04, 0.04]} />
              <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.8} />
            </mesh>
            <mesh position={[0, 0, 0.08]}>
              <boxGeometry args={[0.2, 0.01, 0.08]} />
              <meshStandardMaterial color="#00D4FF" emissive="#00D4FF" emissiveIntensity={0.5} />
            </mesh>
            <mesh position={[0, 0, -0.08]}>
              <boxGeometry args={[0.2, 0.01, 0.08]} />
              <meshStandardMaterial color="#00D4FF" emissive="#00D4FF" emissiveIntensity={0.5} />
            </mesh>
          </group>
        ) : satellite.category === 'GPS_GNSS' ? (
          // GPS - cylindrical with antenna arrays
          <group>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.025, 0.025, 0.06, 8]} />
              <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.8} />
            </mesh>
            <mesh position={[0.05, 0, 0]}>
              <boxGeometry args={[0.05, 0.006, 0.025]} />
              <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
            </mesh>
            <mesh position={[-0.05, 0, 0]}>
              <boxGeometry args={[0.05, 0.006, 0.025]} />
              <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
            </mesh>
          </group>
        ) : satellite.category === 'WEATHER_SAT' ? (
          // Weather satellite - box with dish
          <group>
            <mesh>
              <boxGeometry args={[0.04, 0.05, 0.04]} />
              <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.8} />
            </mesh>
            <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 4, 0, 0]}>
              <coneGeometry args={[0.025, 0.015, 16]} />
              <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.4} />
            </mesh>
          </group>
        ) : (
          // Generic satellite - cube with solar panels
          <group>
            <mesh>
              <boxGeometry args={[0.03, 0.03, 0.03]} />
              <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.8} />
            </mesh>
            <mesh position={[0.04, 0, 0]}>
              <boxGeometry args={[0.05, 0.006, 0.025]} />
              <meshStandardMaterial color="#00D4FF" emissive="#00D4FF" emissiveIntensity={0.5} />
            </mesh>
            <mesh position={[-0.04, 0, 0]}>
              <boxGeometry args={[0.05, 0.006, 0.025]} />
              <meshStandardMaterial color="#00D4FF" emissive="#00D4FF" emissiveIntensity={0.5} />
            </mesh>
          </group>
        )}
        
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

  // Compute orbit path in ECI coordinates (proper circle/ellipse in inertial frame)
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

    // For LEO/MEO sats, compute one full orbit in ECI (proper circular path)
    try {
      const eciPositions = computeOrbitPathECI(satellite.noradId, 20);
      if (eciPositions.length < 2) return [];

      return eciPositions.map(pos => eciToThreeJSSat(pos.eciX, pos.eciY, pos.eciZ));
    } catch {
      return [];
    }
  }, [satellite.noradId, satellite.altitude, isGeo]);

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
    setSelectedZone(selectedZone === zoneName ? null : zoneName);
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
    setMoonSelected(prev => !prev);
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
