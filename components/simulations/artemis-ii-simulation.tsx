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
import { setSimTimeOverride } from '@/lib/sim-clock';

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

  // Artemis Orion's crew module backshell is dark mirror-silver thermal tile,
  // not white — with the brown AVCOAT ablative heat shield below it
  const tileSilver = { color: '#7f858c', roughness: 0.2, metalness: 0.95, emissive: '#33363b', emissiveIntensity: 0.12 };
  const avcoat = { color: '#5a4331', roughness: 0.75, metalness: 0.15, emissive: '#241a12', emissiveIntensity: 0.15 };
  const esmSilver = { color: '#c3c6cb', roughness: 0.3, metalness: 0.8, emissive: '#54565a', emissiveIntensity: 0.1 };
  const cells = { color: '#12213c', roughness: 0.25, metalness: 0.65, emissive: '#091223', emissiveIntensity: 0.3 };

  return (
    <group ref={groupRef} scale={1.8}>
      {/* Crew Module — truncated cone, dark silver tile */}
      <mesh position={[0, 0.06, 0]}>
        <cylinderGeometry args={[0.02, 0.055, 0.07, 20]} />
        <meshStandardMaterial {...tileSilver} />
      </mesh>
      {/* AVCOAT heat shield — brown ablative disc with a slight curve */}
      <mesh position={[0, 0.022, 0]}>
        <cylinderGeometry args={[0.055, 0.052, 0.006, 20]} />
        <meshStandardMaterial {...avcoat} />
      </mesh>
      {/* Forward bay cover + docking ring */}
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.012, 0.019, 0.015, 14]} />
        <meshStandardMaterial {...esmSilver} />
      </mesh>
      <mesh position={[0, 0.108, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.011, 0.0018, 8, 18]} />
        <meshStandardMaterial color="#9a9da2" roughness={0.3} metalness={0.8} />
      </mesh>
      {/* Crew windows — 4 dark panes near the apex */}
      {[0, Math.PI / 2, Math.PI, -Math.PI / 2].map((angle, i) => (
        <mesh key={`win-${i}`} position={[Math.sin(angle) * 0.03, 0.078, Math.cos(angle) * 0.03]} rotation={[0.42, angle, 0, 'YXZ']}>
          <boxGeometry args={[0.009, 0.006, 0.0015]} />
          <meshStandardMaterial color="#0a0f14" roughness={0.1} metalness={0.9} emissive="#05080c" emissiveIntensity={0.4} />
        </mesh>
      ))}
      {/* Side hatch */}
      <mesh position={[0.038, 0.052, 0]} rotation={[0, 0, -0.45]}>
        <cylinderGeometry args={[0.009, 0.009, 0.002, 12]} />
        <meshStandardMaterial color="#6a7077" roughness={0.3} metalness={0.9} />
      </mesh>
      {/* Crew Module Adapter */}
      <mesh position={[0, 0.01, 0]}>
        <cylinderGeometry args={[0.055, 0.048, 0.02, 20]} />
        <meshStandardMaterial {...esmSilver} roughness={0.45} />
      </mesh>
      {/* ESM — silver MLI cylinder */}
      <mesh position={[0, -0.035, 0]}>
        <cylinderGeometry args={[0.048, 0.048, 0.06, 20]} />
        <meshStandardMaterial {...esmSilver} />
      </mesh>
      {/* White radiator band around the ESM */}
      <mesh position={[0, -0.028, 0]}>
        <cylinderGeometry args={[0.0485, 0.0485, 0.03, 20, 1, true]} />
        <meshStandardMaterial color="#e8eaec" roughness={0.45} metalness={0.2} emissive="#6f7173" emissiveIntensity={0.08} side={THREE.DoubleSide} />
      </mesh>
      {/* 4 Solar Array Wings — X-config, each with 3 segmented panels */}
      {[Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4].map((angle, i) => (
        <group key={`wing-${i}`} rotation={[0, angle, 0]} position={[0, -0.035, 0]}>
          {/* boom, angled slightly up like the real flight config */}
          <group rotation={[0, 0, 0.18]}>
            <mesh position={[0.062, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.0018, 0.0018, 0.032, 6]} />
              <meshStandardMaterial color="#8f8f8d" roughness={0.5} metalness={0.6} />
            </mesh>
            {[0, 1, 2].map(j => (
              <mesh key={`seg-${j}`} position={[0.092 + j * 0.032, 0, 0]}>
                <boxGeometry args={[0.03, 0.002, 0.028]} />
                <meshStandardMaterial {...cells} />
              </mesh>
            ))}
            {/* rounded wing tip */}
            <mesh position={[0.16, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.014, 0.014, 0.002, 12, 1, false, -Math.PI / 2, Math.PI]} />
              <meshStandardMaterial {...cells} />
            </mesh>
          </group>
        </group>
      ))}
      {/* AJ10-190 engine — dark bell */}
      <mesh position={[0, -0.074, 0]}>
        <cylinderGeometry args={[0.007, 0.017, 0.022, 14]} />
        <meshStandardMaterial color="#3d3f42" roughness={0.35} metalness={0.85} emissive="#191a1c" emissiveIntensity={0.15} />
      </mesh>
      {/* Aux thruster pods — R-4D clusters around the aft */}
      {[0, Math.PI / 2, Math.PI, -Math.PI / 2].map((angle, i) => (
        <group key={`pod-${i}`} position={[Math.sin(angle) * 0.049, -0.058, Math.cos(angle) * 0.049]}>
          <mesh>
            <boxGeometry args={[0.007, 0.006, 0.007]} />
            <meshStandardMaterial color="#84878c" roughness={0.4} metalness={0.7} />
          </mesh>
          <mesh position={[0, -0.005, 0]}>
            <coneGeometry args={[0.0025, 0.004, 8]} />
            <meshStandardMaterial color="#2e3033" roughness={0.4} metalness={0.8} />
          </mesh>
        </group>
      ))}
      {/* Ka/S-band phased arrays on the CM shoulder */}
      {[0.6, -2.2].map((a, i) => (
        <mesh key={`ant-${i}`} position={[Math.sin(a) * 0.036, 0.068, Math.cos(a) * 0.036]} rotation={[0.4, a, 0, 'YXZ']}>
          <boxGeometry args={[0.011, 0.008, 0.0018]} />
          <meshStandardMaterial color="#26282c" roughness={0.3} metalness={0.7} emissive="#101114" emissiveIntensity={0.2} />
        </mesh>
      ))}
    </group>
  );
}

// ─── Orion Spacecraft wrapper with click/select ────────────

interface OrionProps {
  position: [number, number, number];
  elapsedHours: number;
  isSelected: boolean;
  onClick?: () => void;
  status: 'LIVE' | 'REPLAY' | 'COMPLETE';
}

function OrionSpacecraft({ position, elapsedHours, isSelected, onClick, status }: OrionProps) {
  const [hovered, setHovered] = useState(false);
  const phase = getCurrentPhase(elapsedHours);
  const velocity = getVelocity(elapsedHours);
  const met = formatMET(elapsedHours);

  // Reset the cursor if we unmount mid-hover (e.g. simulation toggled off)
  useEffect(() => () => { document.body.style.cursor = 'auto'; }, []);

  return (
    <group position={position}>
      <group
        onClick={(e) => { e.stopPropagation(); onClick?.(); }}
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
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
              <span className={`w-1.5 h-1.5 rounded-full bg-[#448AFF] ${status === 'LIVE' ? 'animate-pulse' : ''}`} />
              <span className="text-[#448AFF] text-[8px]">{status}</span>
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
  const elapsedRef = useRef(0); // mirror for frame-loop math without stale closures
  const lastUpdateRef = useRef(Date.now());
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
      elapsedRef.current = real;
      setElapsedHours(real);
      lastUpdateRef.current = Date.now();
    }
  }, [isSimulating, getRealElapsed]);

  // When playback mode changes, reset timing. Playback drives the WHOLE scene
  // through the shared sim-clock override (Earth rotation, Moon, satellites,
  // UI panels all replay the mission window together); stopping releases it.
  useEffect(() => {
    if (isPlayback) {
      // Starting playback — start from launch
      elapsedRef.current = 0;
      setElapsedHours(0);
      lastUpdateRef.current = Date.now();
      setSimTimeOverride(new Date(MISSION_START.getTime()));
    } else if (isSimulating) {
      // Stopping playback — snap back to real time, release the scene clock
      const real = getRealElapsed();
      elapsedRef.current = real;
      setElapsedHours(real);
      lastUpdateRef.current = Date.now();
      setSimTimeOverride(null);
    }
    return () => setSimTimeOverride(null);
  }, [isPlayback, isSimulating, getRealElapsed]);

  // Advance time each frame
  useFrame(() => {
    if (!isSimulating) return;

    const now = Date.now();

    if (isPlayback) {
      // Fast-forward: 1 real second = SIM_HOURS_PER_SECOND mission hours
      const realDeltaSec = Math.min((now - lastUpdateRef.current) / 1000, 1);
      lastUpdateRef.current = now;
      const next = Math.min(elapsedRef.current + realDeltaSec * SIM_HOURS_PER_SECOND, MISSION_DURATION_HOURS);
      elapsedRef.current = next;
      setElapsedHours(next);
      // Everything else in the scene follows this same mission date
      setSimTimeOverride(new Date(MISSION_START.getTime() + next * 3600000));
    } else {
      // Live mode: track the ACTUAL mission clock (1x real time). Computing
      // from MISSION_START each frame avoids drift and backgrounded-tab jumps.
      // Only touch state when it moved meaningfully (~2 s) to avoid 60 fps re-renders.
      lastUpdateRef.current = now;
      const real = getRealElapsed();
      elapsedRef.current = real;
      setElapsedHours(prev => (Math.abs(real - prev) > 0.0005 ? real : prev));
    }
  });

  // Report elapsed hours to parent — throttled, because the parent stores it
  // in page-level state and re-renders the whole app tree on every update
  const lastNotifyRef = useRef(0);
  useEffect(() => {
    const now = Date.now();
    if (now - lastNotifyRef.current >= 250 || elapsedHours >= MISSION_DURATION_HOURS || elapsedHours === 0) {
      lastNotifyRef.current = now;
      onElapsedUpdate(elapsedHours);
    }
  }, [elapsedHours, onElapsedUpdate]);

  // Current position
  const currentPos = getPositionAtTime(trajectory, elapsedHours);
  const currentIdx = getTrajectoryIndex(trajectory, elapsedHours);

  // Trajectory as Vector3s — converted once per trajectory, not per frame
  const trajectoryVecs = useMemo(
    () => trajectory.map(p => new THREE.Vector3(p.x, p.y, p.z)),
    [trajectory]
  );

  // Split trajectory: solid (traveled) + dashed (remaining). Memoized on the
  // point index — rebuilding a 1,500+ point Line geometry 60x/s is wasteful;
  // the Orion model itself marks the exact current position between points.
  const { traveledPoints, remainingPoints } = useMemo(() => ({
    traveledPoints: trajectoryVecs.slice(0, currentIdx + 1),
    remainingPoints: trajectoryVecs.slice(currentIdx),
  }), [trajectoryVecs, currentIdx]);

  // Waypoints — flyby is the point of max distance from Earth (free-return
  // apogee, right at the lunar pass). Works for both the ECI live data and
  // the parametric fallback.
  const { departPoint, flybyPoint, returnPoint } = useMemo(() => {
    const flybyIdx = trajectory.reduce((best, p, i) => {
      const d = p.x ** 2 + p.y ** 2 + p.z ** 2;
      const bestP = trajectory[best];
      const bd = bestP.x ** 2 + bestP.y ** 2 + bestP.z ** 2;
      return d > bd ? i : best;
    }, 0);
    return {
      departPoint: trajectory[0],
      flybyPoint: trajectory[flybyIdx],
      returnPoint: trajectory[trajectory.length - 1],
    };
  }, [trajectory]);

  if (!isSimulating) return null;

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
        status={isPlayback ? 'REPLAY' : getRealElapsed() >= MISSION_DURATION_HOURS ? 'COMPLETE' : 'LIVE'}
      />

      {/* Ghost Moon — only for the parametric fallback. With real ECI data
          the actual scene Moon (astronomy-engine) meets Orion at flyby. */}
      {!liveTrajectory && <GhostMoon moonTexture={moonTexture} />}

      {/* Waypoints */}
      <WaypointMarker position={[departPoint.x, departPoint.y, departPoint.z]} label="DEPART" sublabel="KSC LC-39B" color="#00FF41" />
      <WaypointMarker position={[flybyPoint.x, flybyPoint.y, flybyPoint.z]} label="LUNAR FLYBY" sublabel={`${PERILUNE_KM.toLocaleString()} km`} color="#FFFFFF" />
      <WaypointMarker position={[returnPoint.x, returnPoint.y, returnPoint.z]} label="SPLASHDOWN" sublabel="Pacific Ocean" color="#00D4FF" />
    </group>
  );
}
