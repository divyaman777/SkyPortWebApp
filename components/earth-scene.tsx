'use client';

import { useRef, useState, useMemo, Suspense, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import { Satellite, categoryColors, SatelliteCategory } from '@/lib/satellite-data';

// GeoJSON types
interface GeoJSONGeometry {
  type: string;
  coordinates: number[][][] | number[][][][];
}

interface GeoJSONFeature {
  type: string;
  properties: { name: string };
  geometry: GeoJSONGeometry;
}

interface GeoJSONData {
  type: string;
  features: GeoJSONFeature[];
}

// Store loaded GeoJSON data globally so it persists across re-renders
let cachedGeoJSON: GeoJSONData | null = null;

// Detailed continent outlines as [lon, lat] coordinate arrays (fallback)
const CONTINENT_DATA: Record<string, number[][]> = {
  // North America - detailed coastline
  northAmericaWest: [
    [-168, 66], [-164, 64], [-161, 64], [-158, 62], [-155, 59], [-152, 60],
    [-149, 61], [-146, 61], [-141, 60], [-139, 60], [-137, 59], [-135, 57],
    [-133, 55], [-130, 54], [-128, 51], [-125, 49], [-124, 46], [-124, 43],
    [-122, 38], [-118, 34], [-117, 33], [-115, 31], [-112, 29], [-110, 27],
    [-107, 25], [-105, 22], [-100, 22], [-97, 26],
  ],
  northAmericaGulf: [
    [-97, 26], [-95, 29], [-93, 30], [-90, 30], [-88, 30], [-86, 30],
    [-84, 29], [-82, 27], [-81, 25], [-80, 25],
  ],
  northAmericaEast: [
    [-80, 25], [-80, 27], [-81, 30], [-80, 32], [-78, 34], [-75, 36],
    [-74, 39], [-73, 41], [-71, 42], [-70, 44], [-68, 44], [-66, 45],
    [-64, 45], [-61, 46], [-60, 47], [-56, 48], [-53, 47], [-56, 50],
    [-58, 52], [-61, 53], [-64, 54], [-62, 56], [-60, 57], [-62, 58],
    [-68, 59], [-73, 61], [-78, 63], [-82, 64], [-85, 66], [-88, 68],
    [-95, 70], [-105, 73], [-120, 72], [-130, 70], [-141, 70], [-150, 71],
    [-160, 72], [-168, 66],
  ],
  // South America - detailed coastline  
  southAmericaNorth: [
    [-77, 10], [-74, 11], [-71, 12], [-68, 11], [-65, 10], [-62, 11],
    [-60, 9], [-58, 7], [-55, 6], [-52, 5], [-50, 2], [-50, 0],
  ],
  southAmericaEast: [
    [-50, 0], [-48, -2], [-45, -3], [-42, -3], [-38, -4], [-35, -6],
    [-35, -9], [-37, -12], [-39, -15], [-40, -18], [-42, -22], [-44, -23],
    [-47, -26], [-49, -28], [-51, -30], [-52, -32], [-55, -34], [-57, -36],
    [-59, -38], [-62, -39], [-64, -42], [-65, -45], [-67, -50], [-69, -52],
    [-73, -54], [-74, -52],
  ],
  southAmericaWest: [
    [-74, -52], [-75, -48], [-74, -45], [-72, -40], [-72, -35], [-71, -30],
    [-70, -25], [-70, -20], [-72, -17], [-76, -14], [-77, -10], [-80, -6],
    [-81, -2], [-80, 0], [-78, 2], [-77, 4], [-77, 7], [-77, 10],
  ],
  // Africa - detailed coastline
  africaNorth: [
    [-17, 21], [-16, 24], [-13, 28], [-10, 32], [-6, 35], [-2, 36],
    [3, 37], [8, 37], [10, 37], [11, 34], [15, 33], [20, 32], [25, 32],
    [30, 31], [33, 32], [35, 31], [36, 30],
  ],
  africaEast: [
    [36, 30], [35, 27], [34, 24], [36, 22], [38, 18], [40, 15], [43, 12],
    [46, 10], [49, 9], [51, 11], [48, 8], [45, 3], [42, 0], [40, -3],
    [40, -7], [39, -11], [38, -15], [36, -20], [33, -26], [28, -33], [26, -34],
  ],
  africaSouth: [
    [26, -34], [22, -34], [19, -34], [18, -33], [18, -32], [17, -30],
    [15, -28], [14, -25], [13, -22], [12, -18],
  ],
  africaWest: [
    [12, -18], [11, -14], [10, -10], [8, -5], [5, 0], [0, 5], [-5, 8],
    [-10, 10], [-15, 12], [-17, 15], [-17, 21],
  ],
  // Europe - detailed coastline
  europeWest: [
    [-10, 36], [-9, 38], [-9, 40], [-8, 42], [-9, 43], [-5, 43], [-2, 44],
    [-1, 46], [-4, 48], [-5, 49], [-5, 50], [-1, 51], [2, 51], [4, 52],
    [5, 53], [7, 54], [8, 55], [10, 55], [11, 54], [13, 55], [14, 54],
  ],
  europeNorth: [
    [14, 54], [18, 55], [21, 55], [24, 58], [25, 60], [22, 60], [20, 63],
    [18, 64], [15, 66], [14, 68], [17, 69], [20, 70], [25, 71], [30, 70],
  ],
  europeEast: [
    [30, 70], [35, 67], [38, 64], [40, 62], [37, 57], [35, 55], [32, 52],
    [30, 50], [29, 46], [28, 44], [30, 42], [26, 40], [24, 38], [22, 36],
  ],
  europeSouth: [
    [22, 36], [20, 38], [18, 40], [15, 40], [12, 42], [10, 44], [8, 44],
    [6, 43], [3, 42], [0, 40], [-5, 37], [-10, 36],
  ],
  // Asia - main continent
  asiaWest: [
    [30, 42], [34, 42], [38, 40], [42, 38], [45, 38], [50, 37], [53, 36],
    [57, 34], [62, 30], [65, 26], [67, 24], [70, 22], [73, 20], [77, 15],
    [78, 10], [80, 8],
  ],
  asiaSouth: [
    [80, 8], [82, 10], [85, 15], [88, 18], [90, 22], [92, 20], [95, 17],
    [98, 15], [100, 12], [103, 8], [104, 3], [104, 1],
  ],
  asiaSouthEast: [
    [104, 1], [106, 2], [108, 6], [110, 10], [112, 14], [116, 20], [118, 22],
    [120, 24], [122, 26], [124, 28], [127, 33], [130, 35],
  ],
  asiaEast: [
    [130, 35], [132, 38], [128, 40], [125, 42], [129, 44], [132, 43],
    [135, 46], [138, 48], [142, 52], [145, 55], [150, 58], [157, 60],
    [163, 65], [170, 66], [175, 68], [180, 68],
  ],
  asiaNorth: [
    [180, 68], [180, 72], [170, 72], [150, 72], [130, 75], [110, 77],
    [90, 78], [70, 77], [60, 74], [50, 70], [42, 68], [38, 66], [30, 65],
    [28, 60], [27, 56], [30, 52], [30, 47], [30, 42],
  ],
  // Australia - detailed coastline
  australiaMain: [
    [114, -22], [118, -20], [122, -17], [127, -14], [130, -12], [135, -12],
    [138, -13], [140, -12], [142, -11], [145, -15], [146, -19], [148, -20],
    [150, -23], [153, -26], [153, -29], [151, -34], [147, -38], [143, -39],
    [140, -37], [136, -35], [133, -33], [130, -32], [125, -32], [120, -33],
    [116, -34], [114, -32], [114, -28], [114, -22],
  ],
  // Japan islands
  japanMain: [
    [130, 32], [131, 34], [133, 34], [135, 35], [137, 35], [139, 36],
    [140, 38], [141, 40], [141, 42], [143, 43], [145, 44], [146, 45],
    [144, 44], [142, 43], [140, 42], [139, 40], [140, 38], [138, 36],
    [136, 35], [133, 34], [131, 33], [130, 32],
  ],
  // UK/Ireland
  ukMain: [
    [-6, 50], [-4, 50], [-2, 51], [0, 51], [2, 52], [1, 53], [0, 54],
    [-2, 55], [-4, 56], [-5, 58], [-6, 58], [-8, 57], [-6, 56], [-5, 54],
    [-4, 53], [-6, 52], [-6, 50],
  ],
  irelandMain: [
    [-10, 52], [-9, 53], [-8, 54], [-9, 55], [-10, 54], [-10, 52],
  ],
  // Greenland
  greenlandMain: [
    [-44, 60], [-42, 63], [-37, 66], [-32, 68], [-26, 70], [-22, 72],
    [-20, 75], [-25, 77], [-35, 80], [-45, 82], [-55, 81], [-60, 78],
    [-65, 74], [-67, 70], [-62, 66], [-55, 63], [-50, 60], [-44, 60],
  ],
  // Madagascar
  madagascarMain: [
    [44, -13], [48, -14], [50, -17], [50, -22], [47, -25], [44, -24],
    [43, -20], [44, -16], [44, -13],
  ],
  // New Zealand
  nzNorth: [
    [173, -35], [175, -36], [178, -37], [178, -39], [176, -40], [175, -39],
    [173, -38], [172, -36], [173, -35],
  ],
  nzSouth: [
    [167, -44], [168, -45], [170, -46], [171, -45], [173, -44], [174, -42],
    [172, -41], [170, -42], [168, -44], [167, -44],
  ],
  // Indonesia main islands
  sumatra: [
    [95, 6], [98, 4], [101, 1], [104, -2], [106, -6], [103, -6], [99, -3],
    [97, 0], [95, 3], [95, 6],
  ],
  borneo: [
    [109, 4], [112, 3], [115, 4], [118, 5], [119, 3], [118, 0], [116, -2],
    [114, -4], [111, -3], [109, -1], [109, 2], [109, 4],
  ],
  papuaNewGuinea: [
    [141, -3], [144, -4], [147, -5], [150, -6], [152, -5], [150, -3],
    [147, -2], [144, -3], [141, -3],
  ],
};

// Convert continent data to 3D line segments
function continentToPoints(coords: number[][], radius: number): THREE.Vector3[] {
  return coords.map(([lon, lat]) => latLonToVector3(lat, lon, radius));
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

// Generate orbital path points - orbit must be OUTSIDE Earth (radius 2)
function generateOrbitPath(inclination: number, altitude: number, startLon: number, orbitRadius: number): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  // Use the same orbit radius as the satellite itself to match
  const radius = orbitRadius;
  const incRad = (inclination * Math.PI) / 180;
  
  for (let i = 0; i <= 360; i += 2) {
    const angle = (i * Math.PI) / 180;
    const x = radius * Math.cos(angle);
    const z = radius * Math.sin(angle);
    
    const y = z * Math.sin(incRad);
    const zRotated = z * Math.cos(incRad);
    
    const lonRad = (startLon * Math.PI) / 180;
    const xFinal = x * Math.cos(lonRad) - zRotated * Math.sin(lonRad);
    const zFinal = x * Math.sin(lonRad) + zRotated * Math.cos(lonRad);
    
    points.push(new THREE.Vector3(xFinal, y, zFinal));
  }
  
  return points;
}

// Earth rotation state - shared between Earth and orbit calculations
let earthRotation = 0;

// Convert GeoJSON coordinates to 3D line segments
function geoJSONToLines(geometry: GeoJSONGeometry, radius: number): THREE.Vector3[][] {
  const lines: THREE.Vector3[][] = [];
  
  if (geometry.type === 'Polygon') {
    const coords = geometry.coordinates as number[][][];
    coords.forEach(ring => {
      const points = ring.map(([lon, lat]) => latLonToVector3(lat, lon, radius));
      if (points.length > 1) lines.push(points);
    });
  } else if (geometry.type === 'MultiPolygon') {
    const coords = geometry.coordinates as number[][][][];
    coords.forEach(polygon => {
      polygon.forEach(ring => {
        const points = ring.map(([lon, lat]) => latLonToVector3(lat, lon, radius));
        if (points.length > 1) lines.push(points);
      });
    });
  }
  
  return lines;
}

// Earth component with real world map outlines from GeoJSON
function Earth() {
  const earthRef = useRef<THREE.Group>(null);
  const [geoData, setGeoData] = useState<GeoJSONData | null>(cachedGeoJSON);
  const [isLoading, setIsLoading] = useState(!cachedGeoJSON);
  
  // Load GeoJSON country data with correct India boundaries
  useEffect(() => {
    if (cachedGeoJSON) {
      setGeoData(cachedGeoJSON);
      setIsLoading(false);
      return;
    }
    
    // Load world data and India official data in parallel
    Promise.all([
      fetch('https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json').then(r => r.json()),
      fetch('https://raw.githubusercontent.com/AbhinavSwami28/india-official-geojson/main/india-states-simplified.geojson').then(r => r.json())
    ])
      .then(([worldData, indiaData]: [GeoJSONData, GeoJSONData]) => {
        // Remove incorrect India and Pakistan boundaries from world data
        const filteredFeatures = worldData.features.filter(f => {
          const name = f.properties.name?.toLowerCase() || '';
          return name !== 'india' && name !== 'pakistan';
        });
        
        // Add official India boundaries (includes J&K, Ladakh with PoK, Aksai Chin)
        const indiaFeatures = indiaData.features.map(f => ({
          ...f,
          properties: { ...f.properties, name: f.properties.name || 'India' }
        }));
        
        // Merge: world countries (except India/Pakistan) + official India states
        const mergedData: GeoJSONData = {
          type: 'FeatureCollection',
          features: [...filteredFeatures, ...indiaFeatures]
        };
        
        cachedGeoJSON = mergedData;
        setGeoData(mergedData);
        setIsLoading(false);
      })
      .catch(err => {
        console.error('Failed to load GeoJSON:', err);
        // Fallback to world data only
        fetch('https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json')
          .then(r => r.json())
          .then((data: GeoJSONData) => {
            cachedGeoJSON = data;
            setGeoData(data);
            setIsLoading(false);
          });
      });
  }, []);
  
  // Generate country border lines from GeoJSON
  const countryLines = useMemo(() => {
    if (!geoData) return [];
    
    const allLines: { points: THREE.Vector3[]; key: string }[] = [];
    
    geoData.features.forEach((feature, featureIndex) => {
      const lines = geoJSONToLines(feature.geometry, 2.01);
      lines.forEach((points, lineIndex) => {
        allLines.push({
          key: `feature-${featureIndex}-line-${lineIndex}`,
          points,
        });
      });
    });
    
    return allLines;
  }, [geoData]);
  
  // Fallback continent lines (used while loading)
  const fallbackLines = useMemo(() => {
    const lines: { points: THREE.Vector3[]; key: string }[] = [];
    Object.entries(CONTINENT_DATA).forEach(([name, coords]) => {
      lines.push({
        key: name,
        points: continentToPoints(coords, 2.02),
      });
    });
    return lines;
  }, []);
  
  // Use GeoJSON data if available, otherwise use fallback
  const linesToRender = countryLines.length > 0 ? countryLines : fallbackLines;
  
  useFrame((_, delta) => {
    if (earthRef.current) {
      earthRotation += delta * 0.02;
      earthRef.current.rotation.y = earthRotation;
    }
  });

  return (
    <group ref={earthRef}>
      {/* Ocean sphere - dark surface like reference image */}
      <mesh>
        <sphereGeometry args={[2, 128, 128]} />
        <meshStandardMaterial 
          color="#050a12"
          roughness={0.9}
          metalness={0.1}
        />
      </mesh>
      
      {/* Grid lines - latitude */}
      {[-60, -30, 0, 30, 60].map(lat => {
        const points: THREE.Vector3[] = [];
        for (let lon = -180; lon <= 180; lon += 5) {
          points.push(latLonToVector3(lat, lon, 2.005));
        }
        return (
          <Line
            key={`lat-${lat}`}
            points={points}
            color="#1a3a4a"
            lineWidth={0.5}
            opacity={0.4}
            transparent
          />
        );
      })}
      
      {/* Grid lines - longitude */}
      {[-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150, 180].map(lon => {
        const points: THREE.Vector3[] = [];
        for (let lat = -90; lat <= 90; lat += 5) {
          points.push(latLonToVector3(lat, lon, 2.005));
        }
        return (
          <Line
            key={`lon-${lon}`}
            points={points}
            color="#1a3a4a"
            lineWidth={0.5}
            opacity={0.4}
            transparent
          />
        );
      })}
      
      {/* Country borders - cyan/teal color like reference */}
      {linesToRender.map(({ points, key }) => (
        <Line
          key={key}
          points={points}
          color="#40E0D0"
          lineWidth={1.2}
          opacity={0.9}
          transparent
        />
      ))}
      
      {/* Loading indicator */}
      {isLoading && (
        <Html center>
          <div className="text-[#00FFCC] text-xs font-mono animate-pulse">
            Loading map data...
          </div>
        </Html>
      )}
      
      {/* Earth edge glow - subtle cyan rim */}
      <mesh>
        <sphereGeometry args={[2.02, 64, 64]} />
        <meshBasicMaterial 
          color="#00FFFF"
          transparent
          opacity={0.1}
          side={THREE.BackSide}
        />
      </mesh>
      
      {/* Outer atmosphere - cyan glow */}
      <mesh>
        <sphereGeometry args={[2.08, 64, 64]} />
        <meshBasicMaterial 
          color="#00AAFF"
          transparent
          opacity={0.06}
          side={THREE.BackSide}
        />
      </mesh>
      
      {/* Second outer glow for depth */}
      <mesh>
        <sphereGeometry args={[2.15, 64, 64]} />
        <meshBasicMaterial 
          color="#003366"
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

// Observer location marker on Earth with leader line like reference image
function ObserverMarker() {
  const markerRef = useRef<THREE.Group>(null);
  // Observer location: New Delhi, India (shows Kashmir region as part of India)
  const observerLat = 28.6139;
  const observerLon = 77.2090;

  const position = useMemo(() => {
    return latLonToVector3(observerLat, observerLon, 2.02);
  }, []);

  const leaderLineEnd = useMemo(() => {
    const basePos = latLonToVector3(observerLat, observerLon, 2.02);
    const direction = basePos.clone().normalize();
    return basePos.clone().add(direction.multiplyScalar(0.4));
  }, []);

  useFrame((state) => {
    if (markerRef.current) {
      const scale = 1 + Math.sin(state.clock.getElapsedTime() * 2) * 0.15;
      markerRef.current.scale.setScalar(scale);
    }
  });

  return (
    <group>
      <Line
        points={[position, leaderLineEnd]}
        color="#FF4444"
        lineWidth={1}
        opacity={0.8}
        transparent
      />
      <group position={position}>
        <group ref={markerRef}>
          <mesh>
            <sphereGeometry args={[0.025, 16, 16]} />
            <meshBasicMaterial color="#FF4444" />
          </mesh>
        </group>
      </group>
      <group position={leaderLineEnd}>
        <Html center>
          <div className="bg-[rgba(20,10,10,0.95)] border border-[rgba(255,68,68,0.6)] px-3 py-1 rounded text-xs whitespace-nowrap shadow-lg">
            <span className="text-[#FF4444] font-mono font-bold tracking-wider">YOU</span>
          </div>
        </Html>
      </group>
    </group>
  );
}

// Get current Earth rotation for orbit sync
function getEarthRotation() {
  return earthRotation;
}

// Moon orbit radius
const MOON_ORBIT_RADIUS = 8;

// Moon component with clickable orbit
interface MoonProps {
  isSelected: boolean;
  onMoonClick: () => void;
}

// Moon orbit inclination (slight tilt)
const MOON_ORBIT_INCLINATION = 0.09; // ~5 degrees in radians

function Moon({ isSelected, onMoonClick }: MoonProps) {
  const moonRef = useRef<THREE.Group>(null);
  const moonMeshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  
  useFrame((state) => {
    if (moonRef.current) {
      const time = state.clock.getElapsedTime() * 0.05;
      // Position on orbit - must match moonOrbitPoints exactly
      const x = Math.cos(time) * MOON_ORBIT_RADIUS;
      const z = Math.sin(time) * MOON_ORBIT_RADIUS;
      // Apply inclination - same formula as orbit path
      const y = MOON_ORBIT_RADIUS * Math.sin(time) * MOON_ORBIT_INCLINATION;
      
      moonRef.current.position.x = x;
      moonRef.current.position.z = z;
      moonRef.current.position.y = y;
    }
    if (moonMeshRef.current) {
      moonMeshRef.current.rotation.y += 0.001;
    }
  });

  // Moon orbit path - must match moon position calculation exactly
  const moonOrbitPoints = useMemo(() => {
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= 360; i += 2) {
      const angle = (i * Math.PI) / 180;
      const x = Math.cos(angle) * MOON_ORBIT_RADIUS;
      const z = Math.sin(angle) * MOON_ORBIT_RADIUS;
      // Apply inclination - same formula as moon position
      const y = MOON_ORBIT_RADIUS * Math.sin(angle) * MOON_ORBIT_INCLINATION;
      points.push(new THREE.Vector3(x, y, z));
    }
    return points;
  }, []);

  // Load real NASA moon texture
  const [moonTexture, setMoonTexture] = useState<THREE.Texture | null>(null);
  
  useEffect(() => {
    const loader = new THREE.TextureLoader();
    // NASA Moon texture - high resolution lunar surface map
    loader.load(
      'https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_poles_1k.jpg',
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        setMoonTexture(texture);
      },
      undefined,
      () => {
        // Fallback to a different source if NASA fails
        loader.load(
          'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/FullMoon2010.jpg/1024px-FullMoon2010.jpg',
          (texture) => {
            texture.colorSpace = THREE.SRGBColorSpace;
            setMoonTexture(texture);
          }
        );
      }
    );
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
        {/* Main Moon sphere with realistic NASA texture */}
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
          <sphereGeometry args={[0.5, 128, 128]} />
          {moonTexture ? (
            <meshStandardMaterial
              map={moonTexture}
              roughness={0.95}
              metalness={0}
            />
          ) : (
            <meshStandardMaterial
              color="#a0a0a0"
              roughness={0.95}
              metalness={0}
            />
          )}
        </mesh>

        {/* Subtle atmospheric glow when selected */}
        {isSelected && (
          <mesh>
            <sphereGeometry args={[0.53, 32, 32]} />
            <meshBasicMaterial
              color="#cccccc"
              transparent
              opacity={0.1}
              side={THREE.BackSide}
            />
          </mesh>
        )}

        {/* Leader line from moon to label - only when selected */}
        {isSelected && (
          <Line
            points={[
              new THREE.Vector3(0, 0.52, 0),
              new THREE.Vector3(0, 0.85, 0)
            ]}
            color="#666666"
            lineWidth={1}
            opacity={0.8}
            transparent
          />
        )}

        {/* MOON label - only when hovered or selected */}
        {(hovered || isSelected) && (
          <Html position={[0, 1.0, 0]} center>
            <div className="bg-[#1a1a1a] border border-[#444444] px-3 py-1.5 rounded-sm">
              <span className="text-white font-mono text-sm font-medium tracking-wider">MOON</span>
            </div>
          </Html>
        )}

        {/* Selection highlight ring */}
        {isSelected && (
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.58, 0.62, 32]} />
            <meshBasicMaterial color="#888888" transparent opacity={0.5} side={THREE.DoubleSide} />
          </mesh>
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
  const earthRotGroupRef = useRef<THREE.Group>(null);
  const satelliteRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  
  const color = categoryColors[satellite.category];
  const isISS = satellite.category === 'SPACE_STATION';
  
  const orbitRadius = getOrbitRadius(satellite.altitude);
  const incRad = (satellite.inclination * Math.PI) / 180;
  
  // Satellite position calculation - must match OrbitPath exactly
  useFrame((state) => {
    // Rotate outer group with Earth (same as OrbitPath)
    if (earthRotGroupRef.current) {
      earthRotGroupRef.current.rotation.y = getEarthRotation();
    }
    
    // Move satellite along its orbit (in local space of the Earth-rotating group)
    if (satelliteRef.current) {
      const time = state.clock.getElapsedTime();
      // Orbital speed - faster for lower orbits (Kepler's law)
      const orbitalSpeed = 0.15 / Math.sqrt(orbitRadius);
      // Satellite's orbital angle (its position along the orbit)
      const orbitAngle = time * orbitalSpeed;
      
      // Calculate position - same formula as OrbitPath
      const x = orbitRadius * Math.cos(orbitAngle);
      const z = orbitRadius * Math.sin(orbitAngle);
      // Apply inclination - tilts the orbit
      const y = orbitRadius * Math.sin(orbitAngle) * Math.sin(incRad) * 0.5;
      
      satelliteRef.current.position.set(x, y, z);
    }
  });
  
  const satelliteScale = isISS ? 1.5 : isSelected || hovered ? 1.2 : 1;
  
  return (
    <group ref={earthRotGroupRef}>
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
    </group>
  );
}

// Satellite orbit path - rendered at scene root, rotates with Earth
interface OrbitPathProps {
  satellite: Satellite;
}

function OrbitPath({ satellite }: OrbitPathProps) {
  const orbitRef = useRef<THREE.Group>(null);
  const orbitRadius = getOrbitRadius(satellite.altitude);
  const color = categoryColors[satellite.category];
  const incRad = (satellite.inclination * Math.PI) / 180;
  
  // Generate orbit points - must match SatelliteMarker position calculation exactly
  const orbitPoints = useMemo(() => {
    const points: THREE.Vector3[] = [];
    
    for (let i = 0; i <= 360; i += 2) {
      const angle = (i * Math.PI) / 180;
      const x = orbitRadius * Math.cos(angle);
      const z = orbitRadius * Math.sin(angle);
      // Apply inclination - tilts the orbit (same formula as SatelliteMarker)
      const y = orbitRadius * Math.sin(angle) * Math.sin(incRad) * 0.5;
      
      points.push(new THREE.Vector3(x, y, z));
    }
    return points;
  }, [orbitRadius, incRad]);
  
  // Rotate with Earth so orbit stays fixed relative to Earth
  useFrame(() => {
    if (orbitRef.current) {
      orbitRef.current.rotation.y = getEarthRotation();
    }
  });
  
  return (
    <group ref={orbitRef}>
      <Line 
        points={orbitPoints}
        color={color}
        lineWidth={2}
        opacity={0.8}
        transparent
      />
    </group>
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
            {/* Main orbit ring - horizontal */}
            <Line
              points={generateCircle(zone.radius)}
              color={zone.color}
              lineWidth={isSelected ? 2 : 1.5}
              opacity={isSelected ? 0.6 : 0.35}
              transparent
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
      points.push(latLonToVector3(lat, lon - 180, 2.01));
    }
    lines.push(points);
  }
  
  for (let lon = 0; lon < 360; lon += 30) {
    const points: THREE.Vector3[] = [];
    for (let lat = -90; lat <= 90; lat += 10) {
      points.push(latLonToVector3(lat, lon - 180, 2.01));
    }
    lines.push(points);
  }

  return (
    <group>
      {lines.map((points, i) => (
        <Line
          key={i}
          points={points}
          color="#00FF41"
          lineWidth={0.5}
          opacity={0.08}
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
    // Toggle moon selection
    setMoonSelected(prev => !prev);
  };
  
  const handleBackgroundClick = () => {
    // Deselect satellite and moon when clicking background
    setMoonSelected(false);
    if (selectedSatellite) {
      onSatelliteClick(selectedSatellite); // This will toggle off
    }
  };
  
  return (
    <Canvas
      camera={{ position: [-3, 2, 5], fov: 45 }}
      gl={{ antialias: true, alpha: true }}
      style={{ background: 'transparent' }}
    >
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 3, 5]} intensity={1} />
      <directionalLight position={[-5, -3, -5]} intensity={0.2} color="#00D4FF" />
      <pointLight position={[0, 0, 8]} intensity={0.3} color="#00FFCC" />
      
      {/* Invisible background sphere to catch clicks */}
      <BackgroundClick onBackgroundClick={handleBackgroundClick} />
      
      <Suspense fallback={<LoadingFallback />}>
        <Earth />
        <Moon isSelected={moonSelected} onMoonClick={handleMoonClick} />
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
        maxDistance={15}
        autoRotate={false}
        enableDamping
        dampingFactor={0.05}
      />
    </Canvas>
  );
}
