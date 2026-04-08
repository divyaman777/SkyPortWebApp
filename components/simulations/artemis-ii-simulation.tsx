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

// Accurate Orion MPCV 3D Model based on NASA specifications
// Crew Module: 11ft height, 16.5ft diameter, 57.5° frustum cone
// European Service Module: 15.7ft height, 16.5ft diameter
// Solar Arrays: 4 wings, 62ft wingspan (19m), each with 3 panels
function OrionSpacecraft({ 
  position, 
  scale = 1, 
  showLabel = true,
  missionPhase,
  velocity,
  missionTime = 0,
}: OrionSpacecraftProps) {
  const groupRef = useRef<THREE.Group>(null);
  const solarArrayRef = useRef<THREE.Group>(null);
  
  // Slow rotation for visual interest + solar array tracking
  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.002;
    }
    // Subtle solar array oscillation (tracking the sun)
    if (solarArrayRef.current) {
      solarArrayRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.3) * 0.05;
    }
  });

  // Scale factor: real Orion CM diameter is 5.02m, we use 0.165 units
  // This gives us proper proportions
  const CM_RADIUS = 0.0825; // 16.5ft / 2 scaled
  const CM_HEIGHT = 0.055; // 11ft scaled (frustum height)
  const ESM_RADIUS = 0.0825; // Same diameter as CM
  const ESM_HEIGHT = 0.0785; // 15.7ft scaled

  return (
    <group ref={groupRef} position={position} scale={scale}>
      
      {/* ============================================= */}
      {/* === CREW MODULE (CM) - Apollo-derived capsule === */}
      {/* ============================================= */}
      
      {/* CM Pressure Vessel - 57.5° frustum cone shape */}
      {/* Aluminum-lithium alloy with white thermal coating */}
      <mesh position={[0, 0.08, 0]}>
        <cylinderGeometry args={[0.025, CM_RADIUS, CM_HEIGHT, 32]} />
        <meshStandardMaterial 
          color="#E8E8E8" 
          metalness={0.4} 
          roughness={0.6}
        />
      </mesh>
      
      {/* CM Upper section (docking interface area) */}
      <mesh position={[0, 0.115, 0]}>
        <cylinderGeometry args={[0.018, 0.025, 0.015, 24]} />
        <meshStandardMaterial color="#D0D0D0" metalness={0.5} roughness={0.5} />
      </mesh>
      
      {/* Backshell thermal protection tiles (1,300 tiles in real craft) */}
      {/* Represented as darker panels on the cone */}
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const angle = (i * Math.PI) / 3;
        return (
          <mesh 
            key={`tile-${i}`}
            position={[
              Math.cos(angle) * 0.055,
              0.075,
              Math.sin(angle) * 0.055
            ]}
            rotation={[0.3, angle, 0]}
          >
            <planeGeometry args={[0.025, 0.04]} />
            <meshStandardMaterial 
              color="#C5C5C5" 
              metalness={0.3} 
              roughness={0.7}
              side={THREE.DoubleSide}
            />
          </mesh>
        );
      })}

      {/* === HEAT SHIELD (AVCOAT ablative) === */}
      {/* 16.5ft diameter, dark brown/charred ablative material */}
      <mesh position={[0, 0.045, 0]} rotation={[Math.PI, 0, 0]}>
        <cylinderGeometry args={[CM_RADIUS, CM_RADIUS * 0.98, 0.012, 32]} />
        <meshStandardMaterial 
          color="#2a1f15" 
          roughness={0.95} 
          metalness={0.02}
        />
      </mesh>
      {/* Heat shield rim detail */}
      <mesh position={[0, 0.05, 0]}>
        <torusGeometry args={[CM_RADIUS - 0.003, 0.004, 8, 32]} />
        <meshStandardMaterial color="#1a1510" roughness={0.9} metalness={0.1} />
      </mesh>

      {/* === CREW WINDOWS (4 windows on real Orion) === */}
      {[0, 1, 2, 3].map((i) => {
        const angle = (i * Math.PI) / 2 + Math.PI / 4;
        const windowY = 0.09;
        const windowRadius = 0.045;
        return (
          <group key={`window-${i}`}>
            {/* Window frame */}
            <mesh 
              position={[
                Math.cos(angle) * windowRadius,
                windowY,
                Math.sin(angle) * windowRadius
              ]}
              rotation={[0.25, angle + Math.PI, 0]}
            >
              <circleGeometry args={[0.012, 16]} />
              <meshStandardMaterial 
                color="#1a1a1a" 
                metalness={0.8} 
                roughness={0.2}
              />
            </mesh>
            {/* Window glass - cyan tinted */}
            <mesh 
              position={[
                Math.cos(angle) * (windowRadius - 0.001),
                windowY,
                Math.sin(angle) * (windowRadius - 0.001)
              ]}
              rotation={[0.25, angle + Math.PI, 0]}
            >
              <circleGeometry args={[0.009, 16]} />
              <meshBasicMaterial 
                color="#00D4FF" 
                transparent 
                opacity={0.6}
              />
            </mesh>
          </group>
        );
      })}

      {/* === NASA DOCKING SYSTEM (top) === */}
      <mesh position={[0, 0.13, 0]}>
        <cylinderGeometry args={[0.015, 0.018, 0.012, 16]} />
        <meshStandardMaterial color="#888888" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* Docking ring */}
      <mesh position={[0, 0.138, 0]}>
        <torusGeometry args={[0.014, 0.003, 8, 16]} />
        <meshStandardMaterial color="#666666" metalness={0.6} roughness={0.4} />
      </mesh>

      {/* === RCS THRUSTERS ON CM (12 thrusters) === */}
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const angle = (i * Math.PI) / 3;
        return (
          <mesh 
            key={`rcs-cm-${i}`}
            position={[
              Math.cos(angle) * 0.075,
              0.06,
              Math.sin(angle) * 0.075
            ]}
            rotation={[0, angle, Math.PI / 2]}
          >
            <cylinderGeometry args={[0.004, 0.003, 0.008, 8]} />
            <meshStandardMaterial color="#444444" metalness={0.7} roughness={0.4} />
          </mesh>
        );
      })}

      {/* ============================================= */}
      {/* === CREW MODULE ADAPTER (CMA) === */}
      {/* ============================================= */}
      <mesh position={[0, 0.035, 0]}>
        <cylinderGeometry args={[ESM_RADIUS, CM_RADIUS, 0.015, 32]} />
        <meshStandardMaterial color="#B0A080" metalness={0.4} roughness={0.5} />
      </mesh>

      {/* ============================================= */}
      {/* === EUROPEAN SERVICE MODULE (ESM) === */}
      {/* Built by Airbus for ESA */}
      {/* ============================================= */}
      
      {/* ESM Main cylinder - gold/bronze multi-layer insulation */}
      <mesh position={[0, -0.02, 0]}>
        <cylinderGeometry args={[ESM_RADIUS, ESM_RADIUS, ESM_HEIGHT, 32]} />
        <meshStandardMaterial 
          color="#C9A227" 
          metalness={0.6} 
          roughness={0.4}
        />
      </mesh>
      
      {/* ESM structural panels (8 panels around) */}
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
        const angle = (i * Math.PI) / 4;
        return (
          <mesh 
            key={`esm-panel-${i}`}
            position={[
              Math.cos(angle) * (ESM_RADIUS + 0.001),
              -0.02,
              Math.sin(angle) * (ESM_RADIUS + 0.001)
            ]}
            rotation={[0, angle + Math.PI / 2, 0]}
          >
            <planeGeometry args={[0.05, ESM_HEIGHT * 0.9]} />
            <meshStandardMaterial 
              color={i % 2 === 0 ? "#B8960F" : "#D4AF37"} 
              metalness={0.5} 
              roughness={0.5}
              side={THREE.DoubleSide}
            />
          </mesh>
        );
      })}

      {/* ESM Radiator panels (white panels for thermal control) */}
      {[0, 2, 4, 6].map((i) => {
        const angle = (i * Math.PI) / 4 + Math.PI / 8;
        return (
          <mesh 
            key={`radiator-${i}`}
            position={[
              Math.cos(angle) * (ESM_RADIUS + 0.002),
              -0.03,
              Math.sin(angle) * (ESM_RADIUS + 0.002)
            ]}
            rotation={[0, angle + Math.PI / 2, 0]}
          >
            <planeGeometry args={[0.035, 0.05]} />
            <meshStandardMaterial 
              color="#FFFFFF" 
              metalness={0.2} 
              roughness={0.8}
              side={THREE.DoubleSide}
            />
          </mesh>
        );
      })}

      {/* === 24 RCS THRUSTERS ON ESM === */}
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
        const angle = (i * Math.PI) / 4;
        return (
          <group key={`rcs-esm-group-${i}`}>
            {/* 3 thrusters per quadrant area */}
            {[0, 1, 2].map((j) => (
              <mesh 
                key={`rcs-esm-${i}-${j}`}
                position={[
                  Math.cos(angle) * (ESM_RADIUS + 0.008),
                  -0.01 - j * 0.018,
                  Math.sin(angle) * (ESM_RADIUS + 0.008)
                ]}
                rotation={[0, angle, Math.PI / 2]}
              >
                <coneGeometry args={[0.003, 0.006, 6]} />
                <meshStandardMaterial color="#333333" metalness={0.8} roughness={0.3} />
              </mesh>
            ))}
          </group>
        );
      })}

      {/* === 8 AUXILIARY ENGINES (110 lbs thrust each) === */}
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
        const angle = (i * Math.PI) / 4 + Math.PI / 8;
        return (
          <mesh 
            key={`aux-engine-${i}`}
            position={[
              Math.cos(angle) * 0.055,
              -0.065,
              Math.sin(angle) * 0.055
            ]}
            rotation={[Math.PI, 0, 0]}
          >
            <coneGeometry args={[0.006, 0.015, 8]} />
            <meshStandardMaterial color="#2a2a2a" metalness={0.85} roughness={0.2} />
          </mesh>
        );
      })}

      {/* === OMS-E MAIN ENGINE (6,000 lbs thrust) === */}
      {/* Orbital Maneuvering System Engine - flown 19 times on Space Shuttle */}
      <mesh position={[0, -0.075, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.025, 0.035, 16]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.9} roughness={0.15} />
      </mesh>
      {/* Engine bell interior */}
      <mesh position={[0, -0.07, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.02, 0.025, 16]} />
        <meshStandardMaterial color="#8B4513" metalness={0.3} roughness={0.7} />
      </mesh>
      {/* Engine mount ring */}
      <mesh position={[0, -0.055, 0]}>
        <torusGeometry args={[0.028, 0.004, 8, 16]} />
        <meshStandardMaterial color="#444444" metalness={0.7} roughness={0.4} />
      </mesh>

      {/* ============================================= */}
      {/* === SOLAR ARRAYS (4 wings, 62ft span) === */}
      {/* Each wing: 3 panels, 15,000 gallium arsenide cells total */}
      {/* ============================================= */}
      <group ref={solarArrayRef} position={[0, -0.025, 0]}>
        {[0, 1, 2, 3].map((wingIndex) => {
          const baseAngle = (wingIndex * Math.PI) / 2; // 90° apart
          return (
            <group key={`solar-wing-${wingIndex}`} rotation={[0, baseAngle, 0]}>
              {/* Wing deployment arm (telescoping structure) */}
              <mesh position={[0.08, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.003, 0.004, 0.06, 8]} />
                <meshStandardMaterial color="#555555" metalness={0.7} roughness={0.4} />
              </mesh>
              
              {/* 3 Solar panels per wing (each ~6.5ft x 6.5ft real size) */}
              {[0, 1, 2].map((panelIndex) => {
                const panelOffset = 0.12 + panelIndex * 0.055;
                return (
                  <group key={`panel-${wingIndex}-${panelIndex}`} position={[panelOffset, 0, 0]}>
                    {/* Panel substrate (carbon fiber backing) */}
                    <mesh>
                      <boxGeometry args={[0.05, 0.002, 0.05]} />
                      <meshStandardMaterial 
                        color="#1a1a2e" 
                        metalness={0.2} 
                        roughness={0.8}
                      />
                    </mesh>
                    
                    {/* Solar cells (dark blue/purple gallium arsenide) */}
                    <mesh position={[0, 0.002, 0]}>
                      <boxGeometry args={[0.048, 0.001, 0.048]} />
                      <meshStandardMaterial 
                        color="#0d1b4a" 
                        metalness={0.4} 
                        roughness={0.3}
                      />
                    </mesh>
                    
                    {/* Cell grid lines (silver interconnects) */}
                    {[-0.015, 0, 0.015].map((z, gi) => (
                      <mesh key={`grid-h-${gi}`} position={[0, 0.003, z]}>
                        <boxGeometry args={[0.046, 0.0005, 0.001]} />
                        <meshStandardMaterial color="#C0C0C0" metalness={0.8} roughness={0.2} />
                      </mesh>
                    ))}
                    {[-0.015, 0, 0.015].map((x, gi) => (
                      <mesh key={`grid-v-${gi}`} position={[x, 0.003, 0]}>
                        <boxGeometry args={[0.001, 0.0005, 0.046]} />
                        <meshStandardMaterial color="#C0C0C0" metalness={0.8} roughness={0.2} />
                      </mesh>
                    ))}
                    
                    {/* Panel frame (gold anodized aluminum) */}
                    <mesh position={[0.0245, 0.001, 0]}>
                      <boxGeometry args={[0.002, 0.004, 0.052]} />
                      <meshStandardMaterial color="#B8860B" metalness={0.6} roughness={0.4} />
                    </mesh>
                    <mesh position={[-0.0245, 0.001, 0]}>
                      <boxGeometry args={[0.002, 0.004, 0.052]} />
                      <meshStandardMaterial color="#B8860B" metalness={0.6} roughness={0.4} />
                    </mesh>
                    <mesh position={[0, 0.001, 0.0245]}>
                      <boxGeometry args={[0.052, 0.004, 0.002]} />
                      <meshStandardMaterial color="#B8860B" metalness={0.6} roughness={0.4} />
                    </mesh>
                    <mesh position={[0, 0.001, -0.0245]}>
                      <boxGeometry args={[0.052, 0.004, 0.002]} />
                      <meshStandardMaterial color="#B8860B" metalness={0.6} roughness={0.4} />
                    </mesh>
                  </group>
                );
              })}
              
              {/* Wing hinge mechanism at base */}
              <mesh position={[0.055, 0, 0]}>
                <boxGeometry args={[0.015, 0.008, 0.015]} />
                <meshStandardMaterial color="#666666" metalness={0.6} roughness={0.4} />
              </mesh>
            </group>
          );
        })}
      </group>

      {/* ============================================= */}
      {/* === SPACECRAFT LIGHTING === */}
      {/* ============================================= */}
      <pointLight position={[0, 0.05, 0]} intensity={0.2} distance={1.2} color="#00D4FF" />
      {/* Subtle gold reflection from ESM */}
      <pointLight position={[0, -0.02, 0]} intensity={0.1} distance={0.8} color="#FFD700" />

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
