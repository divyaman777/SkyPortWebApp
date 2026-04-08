'use client';

import { useState, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html, Line } from '@react-three/drei';
import { ARTEMIS_II_MISSION, getCurrentPhase, getVelocity } from '@/lib/artemis-data';

// Visual scale constants (matching earth-scene.tsx)
const EARTH_RADIUS = 2;
const MOON_DISTANCE = 8; // Visual distance to Moon in scene
const MISSION_DURATION_HOURS = 240; // 10 days

interface OrionSpacecraftProps {
  position: THREE.Vector3;
  scale?: number;
  showLabel?: boolean;
  missionPhase?: string;
  velocity?: number;
  missionTime?: number;
}

// Detailed Orion MPCV 3D Model
function OrionSpacecraft({ 
  position, 
  scale = 1, 
  showLabel = true,
  missionPhase,
  velocity,
  missionTime = 0,
}: OrionSpacecraftProps) {
  const groupRef = useRef<THREE.Group>(null);
  
  // Slow rotation for visual interest
  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.003;
    }
  });

  return (
    <group ref={groupRef} position={position} scale={scale}>
      {/* === CREW MODULE (Capsule) === */}
      {/* Main cone shape - silver/white */}
      <mesh position={[0, 0.15, 0]}>
        <coneGeometry args={[0.08, 0.12, 16]} />
        <meshStandardMaterial color="#D0D0D0" metalness={0.6} roughness={0.4} />
      </mesh>
      
      {/* Heat shield (bottom) - dark brown/black ablative */}
      <mesh position={[0, 0.05, 0]} rotation={[Math.PI, 0, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 0.02, 16]} />
        <meshStandardMaterial color="#3a2a1a" roughness={0.95} metalness={0.05} />
      </mesh>
      
      {/* Windows (3 small windows around capsule) */}
      {[0, 1, 2].map((i) => (
        <mesh 
          key={`window-${i}`}
          position={[
            Math.cos((i * 2 * Math.PI) / 3) * 0.065,
            0.18,
            Math.sin((i * 2 * Math.PI) / 3) * 0.065
          ]}
        >
          <sphereGeometry args={[0.012, 8, 8]} />
          <meshBasicMaterial color="#00D4FF" transparent opacity={0.8} />
        </mesh>
      ))}

      {/* === EUROPEAN SERVICE MODULE (ESM) === */}
      {/* Main cylinder - silver/gold */}
      <mesh position={[0, -0.08, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 0.15, 16]} />
        <meshStandardMaterial color="#C0B090" metalness={0.5} roughness={0.5} />
      </mesh>
      
      {/* Engine nozzle */}
      <mesh position={[0, -0.18, 0]}>
        <coneGeometry args={[0.025, 0.04, 12]} />
        <meshStandardMaterial color="#2a2a2a" metalness={0.8} roughness={0.3} />
      </mesh>

      {/* === SOLAR ARRAYS (4 panels in X configuration) === */}
      {[0, 1, 2, 3].map((i) => {
        const angle = (i * Math.PI) / 2 + Math.PI / 4;
        return (
          <group key={`solar-${i}`} position={[0, -0.05, 0]} rotation={[0, angle, 0]}>
            {/* Panel arm */}
            <mesh position={[0.12, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.004, 0.004, 0.1, 8]} />
              <meshStandardMaterial color="#555555" />
            </mesh>
            {/* Solar panel - dark blue */}
            <mesh position={[0.2, 0, 0]}>
              <boxGeometry args={[0.12, 0.003, 0.04]} />
              <meshStandardMaterial 
                color="#1a237e" 
                metalness={0.3} 
                roughness={0.4}
              />
            </mesh>
            {/* Panel details - gold trim */}
            <mesh position={[0.2, 0.003, 0]}>
              <boxGeometry args={[0.11, 0.001, 0.035]} />
              <meshStandardMaterial color="#B8860B" metalness={0.7} roughness={0.3} />
            </mesh>
          </group>
        );
      })}

      {/* === DOCKING ADAPTER (top) === */}
      <mesh position={[0, 0.24, 0]}>
        <cylinderGeometry args={[0.02, 0.025, 0.03, 12]} />
        <meshStandardMaterial color="#888888" metalness={0.7} roughness={0.3} />
      </mesh>

      {/* === SPACECRAFT GLOW === */}
      <pointLight position={[0, 0, 0]} intensity={0.3} distance={1.5} color="#00D4FF" />

      {/* === LABEL === */}
      {showLabel && (
        <>
          {/* Leader line */}
          <Line
            points={[
              new THREE.Vector3(0, 0.3, 0),
              new THREE.Vector3(0, 0.55, 0)
            ]}
            color="#00D4FF"
            lineWidth={1}
            opacity={0.8}
            transparent
          />
          <Html position={[0, 0.7, 0]} center>
            <div className="bg-[rgba(0,15,25,0.95)] border border-[rgba(0,212,255,0.5)] px-3 py-2 rounded text-xs whitespace-nowrap pointer-events-none">
              <div className="text-[#00D4FF] font-mono font-bold text-sm">ORION MPCV</div>
              <div className="text-[10px] text-muted-foreground">ARTEMIS II</div>
              {missionPhase && (
                <div className="text-[10px] text-[#00FF41] mt-1 border-t border-[rgba(0,255,65,0.2)] pt-1">
                  {missionPhase}
                </div>
              )}
              {velocity !== undefined && (
                <div className="text-[10px] text-muted-foreground">
                  {velocity.toFixed(2)} km/s
                </div>
              )}
              {missionTime !== undefined && (
                <div className="text-[10px] text-[#FFB400] mt-1">
                  T+{Math.floor(missionTime / 24)}d {Math.floor(missionTime % 24)}h
                </div>
              )}
            </div>
          </Html>
        </>
      )}
    </group>
  );
}

// Trajectory path visualization
function ArtemisTrajectory({ 
  progress,
  showFullPath = true,
}: { 
  progress: number;
  showFullPath?: boolean;
}) {
  // Generate the free-return trajectory curve
  const trajectoryPoints = useMemo(() => {
    const points: THREE.Vector3[] = [];
    const segments = 200;
    
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      
      if (t < 0.4) {
        // Outbound leg - spiraling out to Moon
        const outT = t / 0.4;
        const radius = EARTH_RADIUS + 0.3 + outT * (MOON_DISTANCE - EARTH_RADIUS - 0.3);
        const angle = outT * Math.PI * 0.7;
        const y = Math.sin(outT * Math.PI) * 1.2;
        
        points.push(new THREE.Vector3(
          Math.cos(angle) * radius,
          y,
          Math.sin(angle) * radius
        ));
      } else if (t < 0.5) {
        // Lunar flyby - curve around Moon
        const flybyT = (t - 0.4) / 0.1;
        const moonPos = new THREE.Vector3(MOON_DISTANCE, 0, 0);
        const flybyRadius = 0.7;
        const flybyAngle = Math.PI + flybyT * Math.PI;
        
        points.push(new THREE.Vector3(
          moonPos.x + Math.cos(flybyAngle) * flybyRadius,
          Math.sin(flybyT * Math.PI) * 0.4,
          moonPos.z + Math.sin(flybyAngle) * flybyRadius
        ));
      } else {
        // Return leg - free return to Earth
        const returnT = (t - 0.5) / 0.5;
        const radius = MOON_DISTANCE - returnT * (MOON_DISTANCE - EARTH_RADIUS - 0.3);
        const angle = Math.PI * 0.7 - returnT * Math.PI * 0.7;
        const y = Math.sin((1 - returnT) * Math.PI) * 1.0;
        
        points.push(new THREE.Vector3(
          Math.cos(angle) * radius,
          -y,
          Math.sin(angle) * radius
        ));
      }
    }
    
    return points;
  }, []);

  // Split trajectory for completed vs remaining
  const splitIndex = Math.floor(progress * trajectoryPoints.length);
  const completedPoints = trajectoryPoints.slice(0, Math.max(splitIndex + 1, 2));
  const remainingPoints = trajectoryPoints.slice(Math.max(splitIndex, 0));

  return (
    <group>
      {/* Completed trajectory (brighter cyan) */}
      {completedPoints.length > 1 && (
        <Line
          points={completedPoints}
          color="#00D4FF"
          lineWidth={2}
          opacity={0.9}
          transparent
        />
      )}
      
      {/* Remaining trajectory (dimmer, dashed) */}
      {showFullPath && remainingPoints.length > 1 && (
        <Line
          points={remainingPoints}
          color="#00D4FF"
          lineWidth={1}
          opacity={0.25}
          transparent
        />
      )}

      {/* Phase markers */}
      {/* Launch point */}
      <mesh position={trajectoryPoints[0]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshBasicMaterial color="#00FF41" />
      </mesh>
      
      {/* TLI marker */}
      <mesh position={trajectoryPoints[Math.floor(trajectoryPoints.length * 0.05)]}>
        <sphereGeometry args={[0.03, 8, 8]} />
        <meshBasicMaterial color="#FFB400" />
      </mesh>
      
      {/* Lunar flyby point */}
      <mesh position={trajectoryPoints[Math.floor(trajectoryPoints.length * 0.45)]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshBasicMaterial color="#00D4FF" />
      </mesh>
      
      {/* Re-entry point */}
      <mesh position={trajectoryPoints[trajectoryPoints.length - 1]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshBasicMaterial color="#FF4444" />
      </mesh>
    </group>
  );
}

interface ArtemisIISimulationProps {
  isActive: boolean;
  simulationSpeed?: number;
}

export function ArtemisIISimulation({
  isActive,
  simulationSpeed = 8000, // ~1 minute real time = 1 day mission time
}: ArtemisIISimulationProps) {
  const [missionTime, setMissionTime] = useState(0); // Hours since launch
  const [isPaused, setIsPaused] = useState(false);
  
  // Calculate progress (0-1)
  const progress = useMemo(() => {
    return Math.min(missionTime / MISSION_DURATION_HOURS, 1);
  }, [missionTime]);
  
  // Get current phase
  const currentPhase = useMemo(() => getCurrentPhase(missionTime), [missionTime]);
  
  // Calculate velocity
  const velocity = useMemo(() => getVelocity(progress), [progress]);

  // Calculate spacecraft position along trajectory
  const spacecraftPosition = useMemo(() => {
    const t = progress;
    
    if (t < 0.4) {
      const outT = t / 0.4;
      const radius = EARTH_RADIUS + 0.3 + outT * (MOON_DISTANCE - EARTH_RADIUS - 0.3);
      const angle = outT * Math.PI * 0.7;
      const y = Math.sin(outT * Math.PI) * 1.2;
      return new THREE.Vector3(
        Math.cos(angle) * radius,
        y,
        Math.sin(angle) * radius
      );
    } else if (t < 0.5) {
      const flybyT = (t - 0.4) / 0.1;
      const moonPos = new THREE.Vector3(MOON_DISTANCE, 0, 0);
      const flybyRadius = 0.7;
      const flybyAngle = Math.PI + flybyT * Math.PI;
      return new THREE.Vector3(
        moonPos.x + Math.cos(flybyAngle) * flybyRadius,
        Math.sin(flybyT * Math.PI) * 0.4,
        moonPos.z + Math.sin(flybyAngle) * flybyRadius
      );
    } else {
      const returnT = (t - 0.5) / 0.5;
      const radius = MOON_DISTANCE - returnT * (MOON_DISTANCE - EARTH_RADIUS - 0.3);
      const angle = Math.PI * 0.7 - returnT * Math.PI * 0.7;
      const y = Math.sin((1 - returnT) * Math.PI) * 1.0;
      return new THREE.Vector3(
        Math.cos(angle) * radius,
        -y,
        Math.sin(angle) * radius
      );
    }
  }, [progress]);

  // Animate mission time
  useFrame((_, delta) => {
    if (isActive && !isPaused) {
      setMissionTime(prev => {
        const newTime = prev + (delta * simulationSpeed) / 3600;
        return newTime > MISSION_DURATION_HOURS ? 0 : newTime;
      });
    }
  });

  if (!isActive) return null;

  return (
    <group>
      {/* Trajectory path */}
      <ArtemisTrajectory progress={progress} showFullPath={true} />

      {/* Orion spacecraft */}
      <OrionSpacecraft
        position={spacecraftPosition}
        scale={0.35}
        showLabel={true}
        missionPhase={currentPhase.phase}
        velocity={velocity}
        missionTime={missionTime}
      />

      {/* Mission info panel */}
      <Html position={[-5, 3.5, 0]} center={false}>
        <div className="glass-panel border border-[rgba(0,212,255,0.4)] rounded-lg p-4 w-72 pointer-events-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#00D4FF] animate-pulse" />
              <span className="text-[#00D4FF] font-mono font-bold">ARTEMIS II</span>
            </div>
            <span className="text-[9px] px-2 py-0.5 rounded bg-[rgba(0,212,255,0.2)] text-[#00D4FF]">
              SIMULATION
            </span>
          </div>

          {/* Mission info */}
          <div className="space-y-1.5 text-xs mb-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Mission:</span>
              <span className="text-foreground">{ARTEMIS_II_MISSION.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Spacecraft:</span>
              <span className="text-foreground">{ARTEMIS_II_MISSION.spacecraft.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Mission Time:</span>
              <span className="text-[#FFB400] font-mono">
                T+{Math.floor(missionTime / 24)}d {Math.floor(missionTime % 24)}h {Math.floor((missionTime % 1) * 60)}m
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Phase:</span>
              <span className="text-[#00FF41]">{currentPhase.phase}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Velocity:</span>
              <span className="text-foreground font-mono">{velocity.toFixed(2)} km/s</span>
            </div>
          </div>

          {/* Phase description */}
          <div className="text-[10px] text-muted-foreground mb-3 p-2 bg-[rgba(0,0,0,0.3)] rounded">
            <span className="text-[#00D4FF]">&gt;</span> {currentPhase.description}
          </div>

          {/* Progress bar */}
          <div className="mb-3">
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-muted-foreground">Progress</span>
              <span className="text-foreground">{(progress * 100).toFixed(1)}%</span>
            </div>
            <div className="h-1.5 bg-[rgba(0,212,255,0.15)] rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-[#00FF41] via-[#00D4FF] to-[#00D4FF] transition-all duration-100"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          </div>

          {/* Crew */}
          <div className="text-[10px] mb-3">
            <div className="text-muted-foreground mb-1">Crew:</div>
            <div className="grid grid-cols-2 gap-1">
              {ARTEMIS_II_MISSION.crew.map((member, i) => (
                <div key={i} className="text-foreground truncate">
                  {member.name}
                </div>
              ))}
            </div>
          </div>

          {/* Playback controls */}
          <div className="flex justify-center gap-2 pt-2 border-t border-[rgba(0,255,65,0.1)]">
            <button
              onClick={() => setIsPaused(!isPaused)}
              className="px-4 py-1.5 text-xs glass-panel rounded hover:border-[#00D4FF] transition-colors"
            >
              {isPaused ? '▶ PLAY' : '⏸ PAUSE'}
            </button>
            <button
              onClick={() => setMissionTime(0)}
              className="px-4 py-1.5 text-xs glass-panel rounded hover:border-[#FFB400] transition-colors"
            >
              ↺ RESET
            </button>
          </div>
        </div>
      </Html>
    </group>
  );
}
