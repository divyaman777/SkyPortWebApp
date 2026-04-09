'use client';

import { useRef, useState, useMemo, useEffect, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import {
  ARTEMIS_COLOR,
  MISSION_START,
  MISSION_DURATION_HOURS,
  SIM_HOURS_PER_SECOND,
  MOON_ORBIT_RADIUS,
  MOON_RADIUS_SCENE,
  PERILUNE_KM,
  generateTrajectory,
  getPositionAtTime,
  getTrajectoryIndex,
  getCurrentPhase,
  getVelocity,
  formatMET,
  fetchLiveTrajectory,
  type LiveTrajectoryPoint,
  type TrajectoryPoint,
} from '@/lib/artemis-data';

// ─── Orion MPCV 3D Model ──────────────────────────────────
// Accurate model based on NASA specs:
// Crew Module (truncated cone, 5.02m base), Spacecraft Adapter,
// European Service Module (cylinder, 4.5m dia), 4 X-config solar wings (19m span),
// AJ10-190 engine nozzle, auxiliary thrusters, S-band/Ka-band antennas

function OrionModel() {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.002;
    }
  });

  const goldFoil = '#c8a832';
  const goldEmissive = '#8a7420';
  const panelColor = '#0d1a30';
  const panelEmissive = '#061020';
  const bodyWhite = '#e8e4dc';
  const bodyGray = '#b0aaa0';

  return (
    <group ref={groupRef} scale={1.8}>
      {/* Crew Module — truncated cone */}
      <mesh position={[0, 0.06, 0]}>
        <cylinderGeometry args={[0.02, 0.055, 0.07, 16]} />
        <meshStandardMaterial color={bodyWhite} roughness={0.5} metalness={0.3} emissive={bodyWhite} emissiveIntensity={0.1} />
      </mesh>
      {/* Heat shield */}
      <mesh position={[0, 0.023, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.055, 0.055, 0.004, 16]} />
        <meshStandardMaterial color="#2a2018" roughness={0.8} metalness={0.2} emissive="#1a1008" emissiveIntensity={0.1} />
      </mesh>
      {/* Forward bay / docking adapter */}
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.012, 0.018, 0.015, 12]} />
        <meshStandardMaterial color="#cccccc" roughness={0.4} metalness={0.5} emissive="#888888" emissiveIntensity={0.1} />
      </mesh>
      {/* Docking ring */}
      <mesh position={[0, 0.108, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.012, 0.002, 8, 16]} />
        <meshStandardMaterial color="#aaaaaa" roughness={0.3} metalness={0.7} />
      </mesh>
      {/* Windows */}
      {[0, Math.PI / 2, Math.PI, -Math.PI / 2].map((angle, i) => (
        <mesh key={`win-${i}`} position={[Math.sin(angle) * 0.032, 0.075, Math.cos(angle) * 0.032]} rotation={[0, angle, 0]}>
          <boxGeometry args={[0.008, 0.005, 0.002]} />
          <meshStandardMaterial color="#1a2a3a" roughness={0.2} metalness={0.8} emissive="#0a1520" emissiveIntensity={0.3} />
        </mesh>
      ))}
      {/* Spacecraft Adapter */}
      <mesh position={[0, 0.01, 0]}>
        <cylinderGeometry args={[0.055, 0.048, 0.02, 16]} />
        <meshStandardMaterial color={bodyGray} roughness={0.5} metalness={0.4} emissive="#909088" emissiveIntensity={0.08} />
      </mesh>
      {/* ESM cylinder */}
      <mesh position={[0, -0.035, 0]}>
        <cylinderGeometry args={[0.048, 0.048, 0.06, 16]} />
        <meshStandardMaterial color={bodyGray} roughness={0.45} metalness={0.4} emissive="#a0a098" emissiveIntensity={0.08} />
      </mesh>
      {/* Gold Kapton band */}
      <mesh position={[0, -0.02, 0]}>
        <cylinderGeometry args={[0.0495, 0.0495, 0.025, 16, 1, true]} />
        <meshStandardMaterial color={goldFoil} roughness={0.3} metalness={0.8} emissive={goldEmissive} emissiveIntensity={0.2} side={THREE.DoubleSide} />
      </mesh>
      {/* Radiator panels */}
      {[0, Math.PI / 2, Math.PI, -Math.PI / 2].map((angle, i) => (
        <mesh key={`rad-${i}`} position={[Math.sin(angle + Math.PI / 4) * 0.05, -0.04, Math.cos(angle + Math.PI / 4) * 0.05]} rotation={[0, angle + Math.PI / 4, 0]}>
          <boxGeometry args={[0.025, 0.04, 0.002]} />
          <meshStandardMaterial color="#d0d0d0" roughness={0.4} metalness={0.5} emissive="#aaaaaa" emissiveIntensity={0.08} />
        </mesh>
      ))}
      {/* 4 Solar Array Wings — X-configuration */}
      {[0, Math.PI / 2, Math.PI, -Math.PI / 2].map((angle, i) => (
        <group key={`wing-${i}`}>
          <mesh position={[Math.sin(angle) * 0.06, -0.035, Math.cos(angle) * 0.06]} rotation={[0, angle, 0]}>
            <boxGeometry args={[0.004, 0.004, 0.04]} />
            <meshStandardMaterial color="#888888" roughness={0.5} metalness={0.6} />
          </mesh>
          <mesh position={[Math.sin(angle) * 0.11, -0.035, Math.cos(angle) * 0.11]} rotation={[0, angle, 0]}>
            <boxGeometry args={[0.03, 0.002, 0.09]} />
            <meshStandardMaterial color={panelColor} roughness={0.25} metalness={0.6} emissive={panelEmissive} emissiveIntensity={0.45} />
          </mesh>
        </group>
      ))}
      {/* AJ10-190 Engine Nozzle */}
      <mesh position={[0, -0.072, 0]}>
        <cylinderGeometry args={[0.008, 0.018, 0.02, 12]} />
        <meshStandardMaterial color="#555555" roughness={0.3} metalness={0.8} emissive="#333333" emissiveIntensity={0.15} />
      </mesh>
      <mesh position={[0, -0.083, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.018, 0.0015, 8, 16]} />
        <meshStandardMaterial color="#444444" roughness={0.3} metalness={0.7} />
      </mesh>
      {/* Auxiliary Thrusters */}
      {[0, Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4, Math.PI, -(3 * Math.PI) / 4, -Math.PI / 2, -Math.PI / 4].map((angle, i) => (
        <mesh key={`thr-${i}`} position={[Math.sin(angle) * 0.052, -0.055, Math.cos(angle) * 0.052]}>
          <sphereGeometry args={[0.003, 6, 6]} />
          <meshStandardMaterial color="#888888" roughness={0.4} metalness={0.6} />
        </mesh>
      ))}
      {/* S-band antenna */}
      <mesh position={[0.035, 0.08, 0]} rotation={[0, 0, -0.3]}>
        <cylinderGeometry args={[0.001, 0.001, 0.015, 4]} />
        <meshStandardMaterial color="#cccccc" roughness={0.5} metalness={0.6} />
      </mesh>
      <mesh position={[0.04, 0.088, 0]} rotation={[0, 0, -0.3]}>
        <coneGeometry args={[0.005, 0.004, 8]} />
        <meshStandardMaterial color="#dddddd" roughness={0.4} metalness={0.7} emissive="#aaaaaa" emissiveIntensity={0.1} />
      </mesh>
      {/* Ka-band phased array */}
      <mesh position={[-0.03, 0.07, 0.02]} rotation={[0.2, 0.5, 0]}>
        <boxGeometry args={[0.012, 0.008, 0.002]} />
        <meshStandardMaterial color="#333333" roughness={0.3} metalness={0.7} emissive="#1a1a1a" emissiveIntensity={0.15} />
      </mesh>
    </group>
  );
}

// ─── Orion Spacecraft wrapper with click/select ────────────

interface OrionProps {
  position: [number, number, number];
  elapsedHours: number;
  isSelected: boolean;
  onClick?: () => void;
}

function OrionSpacecraft({ position, elapsedHours, isSelected, onClick }: OrionProps) {
  const [hovered, setHovered] = useState(false);
  const phase = getCurrentPhase(elapsedHours);
  const velocity = getVelocity(elapsedHours);
  const met = formatMET(elapsedHours);

  return (
    <group position={position}>
      <group
        onClick={(e) => { e.stopPropagation(); onClick?.(); }}
        onPointerOver={() => { setHovered(true); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { setHovered(false); document.body.style.cursor = 'auto'; }}
        scale={hovered || isSelected ? 1.15 : 1}
      >
        <OrionModel />

        {/* Glow */}
        <mesh>
          <sphereGeometry args={[0.2, 16, 16]} />
          <meshBasicMaterial color={ARTEMIS_COLOR} transparent opacity={isSelected ? 0.15 : 0.06} />
        </mesh>

        {/* Selection ring */}
        {isSelected && (
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.22, 0.25, 32]} />
            <meshBasicMaterial color={ARTEMIS_COLOR} transparent opacity={0.6} side={THREE.DoubleSide} />
          </mesh>
        )}
      </group>

      {/* Label — only when selected */}
      {isSelected && (
        <Html position={[0, 0.4, 0]} center>
          <div className="bg-[rgba(0,0,0,0.9)] border border-[rgba(68,138,255,0.5)] px-2.5 py-2 rounded text-[10px] whitespace-nowrap font-mono">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[#448AFF] font-bold">ORION MPCV</span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#448AFF] animate-pulse" />
              <span className="text-[#448AFF] text-[8px]">LIVE</span>
            </div>
            <div className="text-muted-foreground text-[9px]">{phase.shortName} — {phase.name}</div>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="text-foreground text-[9px]">{velocity.toFixed(1)} km/s</span>
              <span className="text-[#448AFF] text-[9px]">{met}</span>
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}

// ─── Ghost Moon ────────────────────────────────────────────

function GhostMoon({ moonTexture }: { moonTexture: THREE.Texture | null }) {
  return (
    <group position={[MOON_ORBIT_RADIUS, 0, 0]}>
      <mesh>
        <sphereGeometry args={[MOON_RADIUS_SCENE, 32, 32]} />
        {moonTexture ? (
          <meshStandardMaterial map={moonTexture} roughness={0.9} metalness={0.05} transparent opacity={0.3} />
        ) : (
          <meshBasicMaterial color="#888888" transparent opacity={0.2} />
        )}
      </mesh>
      <Html position={[0, MOON_RADIUS_SCENE * 1.7, 0]} center>
        <div className="bg-[rgba(0,0,0,0.85)] border border-[rgba(68,138,255,0.3)] px-2.5 py-1.5 rounded text-[10px] whitespace-nowrap font-mono">
          <div className="text-muted-foreground">Moon will be here at Orion flyby</div>
          <div className="text-[#448AFF] mt-0.5">Closest: {PERILUNE_KM.toLocaleString()} km</div>
        </div>
      </Html>
    </group>
  );
}

// ─── Waypoint Markers ──────────────────────────────────────

function WaypointMarker({ position, label, sublabel, color }: { position: [number, number, number]; label: string; sublabel?: string; color: string }) {
  return (
    <group position={position}>
      <mesh>
        <octahedronGeometry args={[0.06, 0]} />
        <meshBasicMaterial color={color} transparent opacity={0.7} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.1, 8, 8]} />
        <meshBasicMaterial color={color} transparent opacity={0.1} />
      </mesh>
      <Html position={[0, 0.18, 0]} center>
        <div className="text-center whitespace-nowrap font-mono">
          <div className="text-[9px] font-bold" style={{ color }}>{label}</div>
          {sublabel && <div className="text-[8px] text-muted-foreground">{sublabel}</div>}
        </div>
      </Html>
    </group>
  );
}

// ─── Main Component ────────────────────────────────────────

interface ArtemisSimulationProps {
  isSimulating: boolean;
  onElapsedUpdate: (hours: number) => void;
  onOrionClick?: () => void;
  isOrionSelected?: boolean;
  isPlayback: boolean; // true = fast-forward simulation, false = real-time
}

export function ArtemisSimulation({ isSimulating, onElapsedUpdate, onOrionClick, isOrionSelected, isPlayback }: ArtemisSimulationProps) {
  const [elapsedHours, setElapsedHours] = useState(0);
  const lastUpdateRef = useRef(Date.now());
  const playbackStartRef = useRef(0); // elapsed hours when playback started
  const [liveTrajectory, setLiveTrajectory] = useState<LiveTrajectoryPoint[] | null>(null);

  // Moon texture for ghost moon
  const moonTexture = useMemo(() => {
    const loader = new THREE.TextureLoader();
    const tex = loader.load('/moon-texture.jpg');
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);

  // Parametric fallback trajectory
  const parametricTrajectory = useMemo(() => generateTrajectory(600), []);

  // Fetch live trajectory from JPL Horizons on mount
  useEffect(() => {
    if (isSimulating) {
      fetchLiveTrajectory().then(data => {
        if (data) setLiveTrajectory(data);
      });
    }
  }, [isSimulating]);

  // Active trajectory: live data when available, parametric as fallback
  const trajectory: TrajectoryPoint[] = liveTrajectory || parametricTrajectory;

  // Compute real elapsed time from mission start
  const getRealElapsed = useCallback(() => {
    const now = new Date();
    const realHours = (now.getTime() - MISSION_START.getTime()) / 3600000;
    return Math.max(0, Math.min(realHours, MISSION_DURATION_HOURS));
  }, []);

  // Initialize elapsed time when enabled
  useEffect(() => {
    if (isSimulating) {
      const real = getRealElapsed();
      setElapsedHours(real);
      lastUpdateRef.current = Date.now();
    }
  }, [isSimulating, getRealElapsed]);

  // When playback mode changes, reset timing
  useEffect(() => {
    if (isPlayback) {
      // Starting playback — start from 0
      setElapsedHours(0);
      playbackStartRef.current = 0;
      lastUpdateRef.current = Date.now();
    } else if (isSimulating) {
      // Stopping playback — snap back to real time
      setElapsedHours(getRealElapsed());
      lastUpdateRef.current = Date.now();
    }
  }, [isPlayback, isSimulating, getRealElapsed]);

  // Advance time each frame
  useFrame(() => {
    if (!isSimulating) return;

    const now = Date.now();
    const realDeltaSec = (now - lastUpdateRef.current) / 1000;
    lastUpdateRef.current = now;

    if (isPlayback) {
      // Fast-forward: 1 real second = SIM_HOURS_PER_SECOND mission hours
      setElapsedHours(prev => Math.min(prev + realDeltaSec * SIM_HOURS_PER_SECOND, MISSION_DURATION_HOURS));
    } else {
      // Real-time: advance at same rate as other satellites (TIME_SCALE = 30)
      // 1 real second = 30 mission seconds = 30/3600 mission hours
      const TIME_SCALE = 30; // matches earth-scene.tsx
      setElapsedHours(prev => Math.min(prev + realDeltaSec * TIME_SCALE / 3600, MISSION_DURATION_HOURS));
    }
  });

  // Report elapsed hours to parent
  useEffect(() => {
    onElapsedUpdate(elapsedHours);
  }, [elapsedHours, onElapsedUpdate]);

  if (!isSimulating) return null;

  // Current position
  const currentPos = getPositionAtTime(trajectory, elapsedHours);
  const currentIdx = getTrajectoryIndex(trajectory, elapsedHours);

  // Split trajectory: solid (traveled) + dashed (remaining)
  const traveledPoints = trajectory.slice(0, currentIdx + 1).map(p => new THREE.Vector3(p.x, p.y, p.z));
  traveledPoints.push(new THREE.Vector3(currentPos.x, currentPos.y, currentPos.z));

  const remainingPoints = [new THREE.Vector3(currentPos.x, currentPos.y, currentPos.z)];
  for (let i = currentIdx + 1; i < trajectory.length; i++) {
    remainingPoints.push(new THREE.Vector3(trajectory[i].x, trajectory[i].y, trajectory[i].z));
  }

  // Waypoints — find closest approach to Moon at (MOON_ORBIT_RADIUS, 0, 0)
  const departPoint = trajectory[0];
  const flybyIdx = trajectory.reduce((best, p, i) => {
    const dx = p.x - MOON_ORBIT_RADIUS, dy = p.y, dz = p.z;
    const d = dx * dx + dy * dy + dz * dz;
    const bestP = trajectory[best];
    const bd = (bestP.x - MOON_ORBIT_RADIUS) ** 2 + bestP.y ** 2 + bestP.z ** 2;
    return d < bd ? i : best;
  }, 0);
  const flybyPoint = trajectory[flybyIdx];
  const returnPoint = trajectory[trajectory.length - 1];

  return (
    <group>
      {/* Traveled path — solid, bold */}
      {traveledPoints.length >= 2 && (
        <Line
          points={traveledPoints}
          color={ARTEMIS_COLOR}
          lineWidth={2.5}
          opacity={0.9}
          transparent
        />
      )}

      {/* Remaining path — dashed, bold with spacing */}
      {remainingPoints.length >= 2 && (
        <Line
          points={remainingPoints}
          color={ARTEMIS_COLOR}
          lineWidth={2}
          opacity={0.35}
          transparent
          dashed
          dashSize={0.4}
          gapSize={0.3}
        />
      )}

      {/* Orion spacecraft */}
      <OrionSpacecraft
        position={[currentPos.x, currentPos.y, currentPos.z]}
        elapsedHours={elapsedHours}
        isSelected={!!isOrionSelected}
        onClick={onOrionClick}
      />

      {/* Ghost Moon */}
      <GhostMoon moonTexture={moonTexture} />

      {/* Waypoints */}
      <WaypointMarker position={[departPoint.x, departPoint.y, departPoint.z]} label="DEPART" sublabel="KSC LC-39B" color="#00FF41" />
      <WaypointMarker position={[flybyPoint.x, flybyPoint.y, flybyPoint.z]} label="LUNAR FLYBY" sublabel={`${PERILUNE_KM.toLocaleString()} km`} color="#FFFFFF" />
      <WaypointMarker position={[returnPoint.x, returnPoint.y, returnPoint.z]} label="SPLASHDOWN" sublabel="Pacific Ocean" color="#00D4FF" />
    </group>
  );
}
