'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html, Line } from '@react-three/drei';
import { 
  ARTEMIS_II_MISSION, 
  getCurrentPhase, 
  getVelocity,
  getRealMissionProgress,
  ARTEMIS_II_LAUNCH_TIME,
} from '@/lib/artemis-data';

// Visual scale constants (matching earth-scene.tsx)
const EARTH_RADIUS = 2;
const MOON_DISTANCE = 8; // Visual distance to Moon in scene
const MISSION_DURATION_HOURS = 226; // ~10 days

interface OrionSpacecraftProps {
  position: THREE.Vector3;
  scale?: number;
}

// Accurate Orion MPCV 3D Model based on NASA specifications
function OrionSpacecraft({ position, scale = 1 }: OrionSpacecraftProps) {
  const groupRef = useRef<THREE.Group>(null);
  const solarArrayRef = useRef<THREE.Group>(null);
  
  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.002;
    }
    if (solarArrayRef.current) {
      solarArrayRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.3) * 0.05;
    }
  });

  const CM_RADIUS = 0.0825;
  const CM_HEIGHT = 0.055;
  const ESM_RADIUS = 0.0825;
  const ESM_HEIGHT = 0.0785;

  return (
    <group ref={groupRef} position={position} scale={scale}>
      {/* Crew Module */}
      <mesh position={[0, 0.08, 0]}>
        <cylinderGeometry args={[0.025, CM_RADIUS, CM_HEIGHT, 32]} />
        <meshStandardMaterial color="#F0F0F0" metalness={0.4} roughness={0.5} emissive="#505050" emissiveIntensity={0.4} />
      </mesh>
      
      {/* Heat Shield */}
      <mesh position={[0, 0.045, 0]} rotation={[Math.PI, 0, 0]}>
        <cylinderGeometry args={[CM_RADIUS, CM_RADIUS * 0.98, 0.012, 32]} />
        <meshStandardMaterial color="#2a1f15" roughness={0.95} metalness={0.02} />
      </mesh>

      {/* Windows */}
      {[0, 1, 2, 3].map((i) => {
        const angle = (i * Math.PI) / 2 + Math.PI / 4;
        return (
          <mesh key={`window-${i}`} position={[Math.cos(angle) * 0.045, 0.09, Math.sin(angle) * 0.045]} rotation={[0.25, angle + Math.PI, 0]}>
            <circleGeometry args={[0.009, 16]} />
            <meshBasicMaterial color="#00D4FF" transparent opacity={0.7} />
          </mesh>
        );
      })}

      {/* Docking System */}
      <mesh position={[0, 0.13, 0]}>
        <cylinderGeometry args={[0.015, 0.018, 0.012, 16]} />
        <meshStandardMaterial color="#888888" metalness={0.7} roughness={0.3} />
      </mesh>

      {/* European Service Module */}
      <mesh position={[0, -0.02, 0]}>
        <cylinderGeometry args={[ESM_RADIUS, ESM_RADIUS, ESM_HEIGHT, 32]} />
        <meshStandardMaterial color="#D4AF37" metalness={0.6} roughness={0.3} emissive="#6B5B00" emissiveIntensity={0.5} />
      </mesh>

      {/* Main Engine */}
      <mesh position={[0, -0.075, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.025, 0.035, 16]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.9} roughness={0.15} />
      </mesh>

      {/* Solar Arrays */}
      <group ref={solarArrayRef} position={[0, -0.025, 0]}>
        {[0, 1, 2, 3].map((wingIndex) => {
          const baseAngle = (wingIndex * Math.PI) / 2;
          return (
            <group key={`solar-wing-${wingIndex}`} rotation={[0, baseAngle, 0]}>
              <mesh position={[0.08, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.003, 0.004, 0.06, 8]} />
                <meshStandardMaterial color="#555555" metalness={0.7} roughness={0.4} />
              </mesh>
              {[0, 1, 2].map((panelIndex) => {
                const panelOffset = 0.12 + panelIndex * 0.055;
                return (
                  <group key={`panel-${wingIndex}-${panelIndex}`} position={[panelOffset, 0, 0]}>
                    <mesh>
                      <boxGeometry args={[0.05, 0.002, 0.05]} />
                      <meshStandardMaterial color="#1a3a8a" metalness={0.4} roughness={0.3} emissive="#0055CC" emissiveIntensity={0.6} />
                    </mesh>
                    <mesh position={[0.0245, 0.001, 0]}>
                      <boxGeometry args={[0.002, 0.004, 0.052]} />
                      <meshStandardMaterial color="#B8860B" metalness={0.6} roughness={0.4} />
                    </mesh>
                    <mesh position={[-0.0245, 0.001, 0]}>
                      <boxGeometry args={[0.002, 0.004, 0.052]} />
                      <meshStandardMaterial color="#B8860B" metalness={0.6} roughness={0.4} />
                    </mesh>
                  </group>
                );
              })}
            </group>
          );
        })}
      </group>

      {/* Lighting */}
      <pointLight position={[0, 0.1, 0]} intensity={2} distance={4} color="#FFFFFF" />
      <pointLight position={[0, -0.05, 0]} intensity={1} distance={3} color="#FFD700" />
    </group>
  );
}

// Generate trajectory points for the free-return path
function generateTrajectoryPoints(): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  const segments = 300;
  
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    
    if (t < 0.42) {
      // Outbound: Earth to Moon
      const outT = t / 0.42;
      const radius = EARTH_RADIUS + 0.3 + outT * (MOON_DISTANCE - EARTH_RADIUS - 1);
      const angle = outT * Math.PI * 0.65;
      const y = Math.sin(outT * Math.PI) * 1.0;
      points.push(new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius));
    } else if (t < 0.55) {
      // Lunar flyby - curve around Moon
      const flybyT = (t - 0.42) / 0.13;
      const moonPos = new THREE.Vector3(MOON_DISTANCE, 0, 0);
      const flybyRadius = 0.6;
      const flybyAngle = Math.PI * 0.8 + flybyT * Math.PI * 1.2;
      points.push(new THREE.Vector3(
        moonPos.x + Math.cos(flybyAngle) * flybyRadius,
        Math.sin(flybyT * Math.PI * 2) * 0.3,
        moonPos.z + Math.sin(flybyAngle) * flybyRadius
      ));
    } else {
      // Return: Moon to Earth
      const returnT = (t - 0.55) / 0.45;
      const radius = MOON_DISTANCE - 0.5 - returnT * (MOON_DISTANCE - EARTH_RADIUS - 0.8);
      const angle = Math.PI * 0.65 - returnT * Math.PI * 0.65;
      const y = Math.sin((1 - returnT) * Math.PI) * 0.8;
      points.push(new THREE.Vector3(Math.cos(angle) * radius, -y, Math.sin(angle) * radius));
    }
  }
  
  return points;
}

// Ghost Moon - shows Moon's position during flyby
function GhostMoon() {
  const moonFlybyPosition = new THREE.Vector3(MOON_DISTANCE, 0, 0);
  
  return (
    <group position={moonFlybyPosition}>
      {/* Ghost moon sphere - transparent/dashed appearance */}
      <mesh>
        <sphereGeometry args={[0.45, 32, 32]} />
        <meshStandardMaterial 
          color="#8899AA" 
          transparent 
          opacity={0.25} 
          wireframe={false}
        />
      </mesh>
      {/* Wireframe overlay for "planned position" effect */}
      <mesh>
        <sphereGeometry args={[0.46, 16, 16]} />
        <meshBasicMaterial color="#00D4FF" transparent opacity={0.15} wireframe />
      </mesh>
      {/* Label */}
      <Html position={[0, 0.7, 0]} center>
        <div className="text-[9px] text-[#00D4FF] whitespace-nowrap bg-[rgba(0,0,0,0.8)] px-2 py-1 rounded pointer-events-none border border-[rgba(0,212,255,0.3)]">
          <div className="text-[8px] text-muted-foreground">FLYBY POSITION</div>
          <div>MOON</div>
        </div>
      </Html>
    </group>
  );
}

// Trajectory visualization
interface TrajectoryProps {
  progress: number;
  showFullPath?: boolean;
  isSimulating?: boolean;
}

function ArtemisTrajectory({ progress, showFullPath = true, isSimulating = false }: TrajectoryProps) {
  const trajectoryPoints = useMemo(() => generateTrajectoryPoints(), []);
  
  const progressIndex = Math.floor(progress * trajectoryPoints.length);
  
  const completedPoints = useMemo(() => {
    return trajectoryPoints.slice(0, progressIndex + 1);
  }, [trajectoryPoints, progressIndex]);

  const remainingPoints = useMemo(() => {
    return trajectoryPoints.slice(progressIndex);
  }, [trajectoryPoints, progressIndex]);

  return (
    <group>
      {/* Completed path - solid green line */}
      {completedPoints.length > 1 && (
        <Line
          points={completedPoints}
          color="#00FF41"
          lineWidth={3}
          opacity={0.9}
          transparent
        />
      )}
      
      {/* Remaining path - dashed cyan line */}
      {showFullPath && remainingPoints.length > 1 && (
        <Line
          points={remainingPoints}
          color="#00D4FF"
          lineWidth={2}
          opacity={0.5}
          transparent
          dashed
          dashSize={0.15}
          dashScale={40}
          gapSize={0.08}
        />
      )}

      {/* Key waypoints - only show when not simulating or at start */}
      {!isSimulating && (
        <>
          {/* Launch point */}
          <group position={trajectoryPoints[0]}>
            <mesh>
              <sphereGeometry args={[0.08, 12, 12]} />
              <meshBasicMaterial color="#00FF41" transparent opacity={0.9} />
            </mesh>
            <Html position={[0, 0.2, 0]} center>
              <div className="text-[8px] text-[#00FF41] whitespace-nowrap bg-[rgba(0,0,0,0.8)] px-1.5 py-0.5 rounded pointer-events-none">
                EARTH
              </div>
            </Html>
          </group>
          
          {/* Lunar flyby point */}
          <group position={trajectoryPoints[Math.floor(trajectoryPoints.length * 0.48)]}>
            <mesh>
              <sphereGeometry args={[0.08, 12, 12]} />
              <meshBasicMaterial color="#00D4FF" transparent opacity={0.9} />
            </mesh>
            <Html position={[0, 0.2, 0]} center>
              <div className="text-[8px] text-[#00D4FF] whitespace-nowrap bg-[rgba(0,0,0,0.8)] px-1.5 py-0.5 rounded pointer-events-none">
                LUNAR FLYBY
              </div>
            </Html>
          </group>
          
          {/* Return/Splashdown point */}
          <group position={trajectoryPoints[trajectoryPoints.length - 1]}>
            <mesh>
              <sphereGeometry args={[0.08, 12, 12]} />
              <meshBasicMaterial color="#FF6B35" transparent opacity={0.9} />
            </mesh>
            <Html position={[0, 0.2, 0]} center>
              <div className="text-[8px] text-[#FF6B35] whitespace-nowrap bg-[rgba(0,0,0,0.8)] px-1.5 py-0.5 rounded pointer-events-none">
                SPLASHDOWN
              </div>
            </Html>
          </group>
        </>
      )}
    </group>
  );
}

interface ArtemisIISimulationProps {
  isActive: boolean;
  isSimulating?: boolean;
  onSimulationToggle?: () => void;
  onOrionClick?: () => void;
}

export function ArtemisIISimulation({
  isActive,
  isSimulating = false,
  onOrionClick,
}: ArtemisIISimulationProps) {
  const [simulationTime, setSimulationTime] = useState(0);
  const [realProgress, setRealProgress] = useState(() => getRealMissionProgress());
  
  // Update real progress every second when not simulating
  useEffect(() => {
    if (!isSimulating) {
      const interval = setInterval(() => {
        setRealProgress(getRealMissionProgress());
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isSimulating]);

  // Calculate progress - use real progress or simulation progress
  const progress = useMemo(() => {
    if (isSimulating) {
      return Math.min(simulationTime / MISSION_DURATION_HOURS, 1);
    }
    return realProgress.progress;
  }, [isSimulating, simulationTime, realProgress.progress]);

  const currentPhase = useMemo(() => {
    const hours = isSimulating ? simulationTime : realProgress.elapsedHours;
    return getCurrentPhase(hours);
  }, [isSimulating, simulationTime, realProgress.elapsedHours]);

  const velocity = useMemo(() => getVelocity(progress), [progress]);

  // Calculate spacecraft position
  const trajectoryPoints = useMemo(() => generateTrajectoryPoints(), []);
  const spacecraftPosition = useMemo(() => {
    const index = Math.floor(progress * (trajectoryPoints.length - 1));
    return trajectoryPoints[Math.min(index, trajectoryPoints.length - 1)];
  }, [progress, trajectoryPoints]);

  // Animate simulation time
  useFrame((_, delta) => {
    if (isActive && isSimulating) {
      setSimulationTime(prev => {
        const newTime = prev + (delta * 8000) / 3600; // ~1 min = 1 day
        return newTime > MISSION_DURATION_HOURS ? 0 : newTime;
      });
    }
  });

  if (!isActive) return null;

  const missionHours = isSimulating ? simulationTime : realProgress.elapsedHours;

  return (
    <group>
      {/* Ghost Moon at flyby position */}
      <GhostMoon />
      
      {/* Trajectory path */}
      <ArtemisTrajectory 
        progress={progress} 
        showFullPath={true} 
        isSimulating={isSimulating}
      />

      {/* Orion spacecraft */}
      <group onClick={onOrionClick} style={{ cursor: 'pointer' }}>
        <OrionSpacecraft position={spacecraftPosition} scale={0.7} />
        
        {/* Position indicator ring */}
        <group position={spacecraftPosition}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.15, 0.18, 32]} />
            <meshBasicMaterial color="#00D4FF" transparent opacity={0.7} side={THREE.DoubleSide} />
          </mesh>
          <pointLight intensity={3} distance={5} color="#00D4FF" />
          
          {/* Current status label */}
          <Html position={[0, 0.6, 0]} center>
            <div 
              className="text-[10px] whitespace-nowrap bg-[rgba(0,10,20,0.95)] border border-[rgba(0,212,255,0.6)] px-3 py-2 rounded pointer-events-auto cursor-pointer hover:border-[#00D4FF] transition-colors"
              onClick={onOrionClick}
            >
              <div className="flex items-center gap-2 mb-1">
                <div className="w-1.5 h-1.5 rounded-full bg-[#00FF41] animate-pulse" />
                <span className="text-[#00D4FF] font-bold">ORION</span>
                <span className="text-[8px] text-[#00FF41]">LIVE</span>
              </div>
              <div className="text-[9px] text-muted-foreground">{currentPhase.phase}</div>
              <div className="text-[9px] text-[#FFB400] font-mono">{velocity.toFixed(1)} km/s</div>
              <div className="text-[8px] text-muted-foreground mt-1">
                T+{Math.floor(missionHours / 24)}d {Math.floor(missionHours % 24)}h
              </div>
            </div>
          </Html>
        </group>
      </group>
    </group>
  );
}

// Export the simulation reset function for external control
export function useArtemisSimulation() {
  const [isSimulating, setIsSimulating] = useState(false);
  
  const startSimulation = () => setIsSimulating(true);
  const stopSimulation = () => setIsSimulating(false);
  const toggleSimulation = () => setIsSimulating(prev => !prev);
  
  return { isSimulating, startSimulation, stopSimulation, toggleSimulation };
}
