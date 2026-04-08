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
// Based on NASA's Artemis II hybrid free-return trajectory
// Key: Orion loops AROUND the far side of the Moon, not through it
// Closest approach: 6,545 km (4,067 miles) from lunar surface
// The path forms a figure-8 shape when viewed from above
function generateTrajectoryPoints(): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  const segments = 500; // More segments for smoother path
  
  // Moon visual radius in scene
  const MOON_RADIUS = 0.45;
  // Flyby distance (6,545 km = ~3.7% of Earth-Moon distance)
  // In our scene: Moon radius + safe clearance
  const FLYBY_CLEARANCE = MOON_RADIUS + 0.25; // Clear around Moon's far side
  
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    
    if (t < 0.02) {
      // Launch phase - rising from Earth surface (Kennedy Space Center)
      const launchT = t / 0.02;
      const radius = EARTH_RADIUS + launchT * 0.4;
      const angle = -0.3 + launchT * 0.15; // Starting angle
      const y = launchT * 0.2;
      points.push(new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius));
    } else if (t < 0.08) {
      // Earth orbit and TLI burn phase
      const orbitT = (t - 0.02) / 0.06;
      const radius = EARTH_RADIUS + 0.4 + orbitT * 0.3;
      const angle = -0.15 + orbitT * 0.25;
      const y = 0.2 + orbitT * 0.1;
      points.push(new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius));
    } else if (t < 0.45) {
      // Outbound transit: Earth to Moon approach
      const outT = (t - 0.08) / 0.37;
      // Curved path toward Moon
      const radius = EARTH_RADIUS + 0.7 + outT * (MOON_DISTANCE - EARTH_RADIUS - 0.7 - FLYBY_CLEARANCE);
      const angle = 0.1 + outT * 0.15; // Gradually approach Moon's direction
      // Arc above the orbital plane going outbound
      const y = Math.sin(outT * Math.PI * 0.8) * 0.5;
      points.push(new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius));
    } else if (t < 0.58) {
      // Lunar flyby - curve AROUND the far side of Moon
      // This is the critical part: Orion goes BEHIND the Moon
      const flybyT = (t - 0.45) / 0.13;
      const moonPos = new THREE.Vector3(MOON_DISTANCE, 0, 0);
      
      // Arc around the far side (positive X direction, away from Earth)
      // Start from approach angle, sweep around to departure angle
      const startAngle = Math.PI * 0.85; // Approaching from Earth side
      const endAngle = Math.PI * 1.15; // Departing back toward Earth
      const flybyAngle = startAngle + flybyT * (endAngle - startAngle);
      
      // Closest approach at middle of flyby
      const approachFactor = 1 - Math.sin(flybyT * Math.PI) * 0.3;
      const currentRadius = FLYBY_CLEARANCE * approachFactor + MOON_RADIUS * 0.1;
      
      const y = Math.sin(flybyT * Math.PI) * 0.15; // Slight vertical motion
      
      points.push(new THREE.Vector3(
        moonPos.x + Math.cos(flybyAngle) * currentRadius,
        y,
        Math.sin(flybyAngle) * currentRadius
      ));
    } else {
      // Return transit: Moon back to Earth
      const returnT = (t - 0.58) / 0.42;
      
      // Start from behind Moon, curve back to Earth
      const startRadius = MOON_DISTANCE + FLYBY_CLEARANCE * 0.5;
      const endRadius = EARTH_RADIUS + 0.3;
      const radius = startRadius - returnT * (startRadius - endRadius);
      
      // Angle sweeps from Moon position back toward Earth
      const startAngle = 0.3;
      const endAngle = -0.2;
      const angle = startAngle + returnT * (endAngle - startAngle);
      
      // Arc below the orbital plane returning
      const y = -Math.sin(returnT * Math.PI * 0.85) * 0.4;
      
      points.push(new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius));
    }
  }
  
  return points;
}

// Ghost Moon - shows Moon's position during flyby (uses same texture as real Moon but blurred/transparent)
function GhostMoon() {
  const moonFlybyPosition = new THREE.Vector3(MOON_DISTANCE, 0, 0);
  
  // Create the same procedural moon texture as the real Moon
  const moonTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512; // Lower res for ghost effect
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Base lunar grey
    ctx.fillStyle = '#a8a8a8';
    ctx.fillRect(0, 0, 512, 256);

    // Add maria (dark basaltic plains)
    const maria = [
      { x: 120, y: 100, rx: 45, ry: 35, color: '#686868' },
      { x: 180, y: 120, rx: 35, ry: 28, color: '#707070' },
      { x: 220, y: 130, rx: 40, ry: 30, color: '#656565' },
      { x: 280, y: 110, rx: 30, ry: 23, color: '#6a6a6a' },
      { x: 350, y: 130, rx: 35, ry: 28, color: '#626262' },
    ];

    maria.forEach(m => {
      const gradient = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, Math.max(m.rx, m.ry));
      gradient.addColorStop(0, m.color);
      gradient.addColorStop(0.6, m.color);
      gradient.addColorStop(1, '#909090');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.ellipse(m.x, m.y, m.rx, m.ry, 0, 0, Math.PI * 2);
      ctx.fill();
    });

    // Add some craters
    for (let i = 0; i < 15; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 256;
      const r = 5 + Math.random() * 15;
      ctx.strokeStyle = '#c0c0c0';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    return texture;
  }, []);
  
  return (
    <group position={moonFlybyPosition}>
      {/* Ghost moon sphere - same texture as real Moon but faded */}
      <mesh>
        <sphereGeometry args={[0.45, 32, 32]} />
        {moonTexture ? (
          <meshStandardMaterial 
            map={moonTexture}
            transparent 
            opacity={0.3}
            roughness={0.9}
            metalness={0.05}
          />
        ) : (
          <meshStandardMaterial 
            color="#888888" 
            transparent 
            opacity={0.3}
          />
        )}
      </mesh>
      {/* Subtle glow ring around ghost moon - amber to match Artemis path */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.48, 0.52, 64]} />
        <meshBasicMaterial color="#FFA500" transparent opacity={0.15} side={THREE.DoubleSide} />
      </mesh>
      {/* Label */}
      <Html position={[0, 0.75, 0]} center>
        <div className="text-[10px] text-[#FFA500]/80 whitespace-nowrap bg-[rgba(0,10,20,0.9)] px-2 py-1.5 rounded pointer-events-none border border-[rgba(255,165,0,0.2)]">
          <div className="text-[8px] text-muted-foreground/70 mb-0.5">Moon position at flyby</div>
          <div className="text-[#FFA500]/70">CLOSEST APPROACH</div>
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

  // Amber/orange color for Artemis trajectory - distinct from MEO cyan (#00D4FF)
  const ARTEMIS_PATH_COLOR = '#FF8C00'; // Dark orange - visible and distinct
  const ARTEMIS_PATH_GLOW = '#FFA500';  // Orange for glow effects

  return (
    <group>
      {/* Completed path - solid amber line (traveled portion) */}
      {completedPoints.length > 1 && (
        <Line
          points={completedPoints}
          color={ARTEMIS_PATH_COLOR}
          lineWidth={2.5}
          opacity={0.85}
          transparent
        />
      )}
      
      {/* Remaining path - dashed line (planned portion - yet to cover) */}
      {showFullPath && remainingPoints.length > 1 && (
        <Line
          points={remainingPoints}
          color={ARTEMIS_PATH_COLOR}
          lineWidth={1.5}
          opacity={0.4}
          transparent
          dashed
          dashSize={0.08}
          dashScale={60}
          gapSize={0.06}
        />
      )}

      {/* Key waypoints */}
      {!isSimulating && (
        <>
          {/* Launch point - Kennedy Space Center */}
          <group position={trajectoryPoints[0]}>
            <mesh>
              <sphereGeometry args={[0.05, 12, 12]} />
              <meshBasicMaterial color="#00FF41" transparent opacity={0.9} />
            </mesh>
            <pointLight intensity={0.5} distance={1} color="#00FF41" />
            <Html position={[0, 0.15, 0]} center>
              <div className="text-[8px] text-[#00FF41] whitespace-nowrap bg-[rgba(0,10,15,0.9)] px-1.5 py-0.5 rounded pointer-events-none border border-[rgba(0,255,65,0.3)]">
                LAUNCH
              </div>
            </Html>
          </group>
          
          {/* Lunar flyby point - closest approach */}
          <group position={trajectoryPoints[Math.floor(trajectoryPoints.length * 0.52)]}>
            <mesh>
              <sphereGeometry args={[0.05, 12, 12]} />
              <meshBasicMaterial color={ARTEMIS_PATH_GLOW} transparent opacity={0.9} />
            </mesh>
            <pointLight intensity={0.5} distance={1} color={ARTEMIS_PATH_GLOW} />
            <Html position={[0, 0.15, 0]} center>
              <div className="text-[8px] text-[#FFA500] whitespace-nowrap bg-[rgba(0,10,15,0.9)] px-1.5 py-0.5 rounded pointer-events-none border border-[rgba(255,165,0,0.3)]">
                FLYBY
              </div>
            </Html>
          </group>
          
          {/* Return/Splashdown point - Pacific Ocean */}
          <group position={trajectoryPoints[trajectoryPoints.length - 1]}>
            <mesh>
              <sphereGeometry args={[0.05, 12, 12]} />
              <meshBasicMaterial color="#FF4444" transparent opacity={0.9} />
            </mesh>
            <pointLight intensity={0.5} distance={1} color="#FF4444" />
            <Html position={[0, 0.15, 0]} center>
              <div className="text-[8px] text-[#FF4444] whitespace-nowrap bg-[rgba(0,10,15,0.9)] px-1.5 py-0.5 rounded pointer-events-none border border-[rgba(255,68,68,0.3)]">
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

  // Animate simulation time - realistic speed visualization
  // 1 real second = ~2 hours of mission time (so full mission plays in ~2 minutes)
  useFrame((_, delta) => {
    if (isActive && isSimulating) {
      setSimulationTime(prev => {
        // Speed: delta (in seconds) * 7200 seconds per mission-hour = hours per frame
        // This makes the 226-hour mission play in about 113 seconds (~2 minutes)
        const speedMultiplier = 2; // Adjustable: higher = faster playback
        const newTime = prev + (delta * speedMultiplier);
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
        
        {/* Position indicator ring - amber to match trajectory */}
        <group position={spacecraftPosition}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.12, 0.15, 32]} />
            <meshBasicMaterial color="#FFA500" transparent opacity={0.8} side={THREE.DoubleSide} />
          </mesh>
          <pointLight intensity={2.5} distance={4} color="#FFA500" />
          
          {/* Current status label */}
          <Html position={[0, 0.5, 0]} center>
            <div 
              className="text-[10px] whitespace-nowrap bg-[rgba(10,5,0,0.95)] border border-[rgba(255,165,0,0.6)] px-3 py-2 rounded pointer-events-auto cursor-pointer hover:border-[#FFA500] transition-colors"
              onClick={onOrionClick}
            >
              <div className="flex items-center gap-2 mb-1">
                <div className="w-1.5 h-1.5 rounded-full bg-[#00FF41] animate-pulse" />
                <span className="text-[#FFA500] font-bold">ORION</span>
                <span className="text-[8px] text-[#00FF41]">LIVE</span>
              </div>
              <div className="text-[9px] text-muted-foreground">{currentPhase.phase}</div>
              <div className="text-[9px] text-[#FFA500] font-mono">{velocity.toFixed(1)} km/s</div>
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
