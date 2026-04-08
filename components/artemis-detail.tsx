'use client';

import { useState, useEffect } from 'react';
import { X, Rocket, Users, Globe, Timer, Zap, Play, Pause, RotateCcw, ExternalLink } from 'lucide-react';
import { 
  ARTEMIS_II_MISSION, 
  getRealMissionProgress,
  ARTEMIS_II_LAUNCH_TIME,
} from '@/lib/artemis-data';

interface ArtemisDetailProps {
  isOpen: boolean;
  onClose: () => void;
  isSimulating: boolean;
  onToggleSimulation: () => void;
}

function MissionTimer() {
  const [elapsed, setElapsed] = useState(() => {
    const now = new Date();
    return Math.max(0, now.getTime() - ARTEMIS_II_LAUNCH_TIME.getTime());
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setElapsed(Math.max(0, now.getTime() - ARTEMIS_II_LAUNCH_TIME.getTime()));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const days = Math.floor(elapsed / (1000 * 60 * 60 * 24));
  const hours = Math.floor((elapsed % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((elapsed % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((elapsed % (1000 * 60)) / 1000);

  return (
    <div className="font-mono text-lg text-[#FFB400] glow-amber">
      T+{days}d {hours.toString().padStart(2, '0')}:{minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}
    </div>
  );
}

export function ArtemisDetail({ isOpen, onClose, isSimulating, onToggleSimulation }: ArtemisDetailProps) {
  const [progress, setProgress] = useState(() => getRealMissionProgress());

  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setProgress(getRealMissionProgress());
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) return null;

  const mission = ARTEMIS_II_MISSION;

  return (
    <aside className="fixed right-0 top-14 bottom-10 w-full md:w-[420px] glass-panel border-l border-[rgba(0,212,255,0.3)] z-50 scan-reveal overflow-hidden flex flex-col bg-[#0a0a0f]">
      {/* Title bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[rgba(0,212,255,0.3)] bg-[rgba(0,20,40,0.5)]">
        <div className="flex items-center gap-2">
          <Rocket className="w-4 h-4 text-[#00D4FF]" />
          <span className="text-[#00D4FF] text-sm font-bold">ARTEMIS II</span>
          <span className="text-[8px] px-1.5 py-0.5 rounded bg-[rgba(0,255,65,0.2)] text-[#00FF41] animate-pulse">
            LIVE
          </span>
        </div>
        <button 
          onClick={onClose}
          className="text-muted-foreground hover:text-[#00D4FF] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Mission Header */}
        <div className="space-y-2">
          <h2 className="text-foreground font-bold text-lg">{mission.fullName}</h2>
          <p className="text-sm text-muted-foreground">
            NASA&apos;s first crewed mission to the Moon since Apollo 17 (1972). A 10-day lunar flyby demonstrating Orion spacecraft capabilities.
          </p>
        </div>

        {/* Live Status */}
        <div className="bg-[rgba(0,212,255,0.1)] border border-[rgba(0,212,255,0.3)] rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Mission Elapsed Time</span>
            <MissionTimer />
          </div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Current Phase</span>
            <span className="text-sm text-[#00FF41] font-medium">{progress.phase.phase}</span>
          </div>
          <div className="text-xs text-muted-foreground mt-2 p-2 bg-[rgba(0,0,0,0.3)] rounded">
            {progress.phase.description}
          </div>
          <div className="mt-3">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">Mission Progress</span>
              <span className="text-[#00D4FF]">{(progress.progress * 100).toFixed(1)}%</span>
            </div>
            <div className="h-2 bg-[rgba(0,212,255,0.15)] rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-[#00FF41] via-[#00D4FF] to-[#00D4FF] transition-all duration-1000"
                style={{ width: `${progress.progress * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Simulation Control */}
        <div className="border border-[rgba(0,255,65,0.3)] rounded-lg p-3 bg-[rgba(0,255,65,0.05)]">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-[#00FF41]" />
            <span className="text-sm font-medium text-foreground">Mission Simulation</span>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Watch the complete Artemis II trajectory from launch to splashdown in accelerated time.
          </p>
          <button
            onClick={onToggleSimulation}
            className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded text-sm font-bold transition-all ${
              isSimulating 
                ? 'bg-[rgba(255,179,0,0.2)] border border-[#FFB400] text-[#FFB400] hover:bg-[rgba(255,179,0,0.3)]'
                : 'bg-[rgba(0,255,65,0.15)] border border-[#00FF41] text-[#00FF41] hover:bg-[rgba(0,255,65,0.25)]'
            }`}
          >
            {isSimulating ? (
              <>
                <Pause className="w-4 h-4" />
                STOP SIMULATION
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                START SIMULATION
              </>
            )}
          </button>
        </div>

        {/* Crew Section */}
        <div className="border-t border-[rgba(0,212,255,0.2)] pt-4">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-[#00D4FF]" />
            <span className="text-sm font-medium text-foreground">Crew</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {mission.crew.map((member, i) => (
              <div key={i} className="bg-[rgba(0,0,0,0.3)] rounded p-2">
                <div className="text-sm text-foreground font-medium">{member.name}</div>
                <div className="text-xs text-[#00D4FF]">{member.role}</div>
                <div className="text-xs text-muted-foreground">{member.agency}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Mission Details */}
        <div className="border-t border-[rgba(0,212,255,0.2)] pt-4">
          <div className="flex items-center gap-2 mb-3">
            <Globe className="w-4 h-4 text-[#00D4FF]" />
            <span className="text-sm font-medium text-foreground">Mission Details</span>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Launch Date:</span>
              <span className="text-foreground">{mission.launchDate}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Launch Site:</span>
              <span className="text-foreground">{mission.launchSite}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Spacecraft:</span>
              <span className="text-[#00D4FF]">{mission.spacecraft.name} &quot;{mission.spacecraft.callsign}&quot;</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Rocket:</span>
              <span className="text-foreground">{mission.rocket.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Duration:</span>
              <span className="text-foreground">{mission.duration}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Splashdown:</span>
              <span className="text-[#FF6B35]">{mission.expectedSplashdown}</span>
            </div>
          </div>
        </div>

        {/* Trajectory Info */}
        <div className="border-t border-[rgba(0,212,255,0.2)] pt-4">
          <div className="flex items-center gap-2 mb-3">
            <Timer className="w-4 h-4 text-[#00D4FF]" />
            <span className="text-sm font-medium text-foreground">Trajectory</span>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Type:</span>
              <span className="text-foreground">{mission.trajectory.type}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Max Distance from Earth:</span>
              <span className="text-[#FFB400] font-mono">{mission.trajectory.maxDistanceFromEarth.toLocaleString()} km</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Closest to Moon:</span>
              <span className="text-[#00D4FF] font-mono">{mission.trajectory.closestApproachToMoon.toLocaleString()} km</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Re-entry Speed:</span>
              <span className="text-[#FF6B35] font-mono">{mission.trajectory.reentrySpeedKms} km/s</span>
            </div>
          </div>
        </div>

        {/* Records */}
        <div className="border-t border-[rgba(0,212,255,0.2)] pt-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm font-medium text-[#FFB400]">Historic Records</span>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex items-start gap-2">
              <span className="text-[#FFB400]">*</span>
              <span className="text-muted-foreground">Farthest humans from Earth: <span className="text-[#FFB400]">406,841 km</span> (beats Apollo 13)</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-[#FFB400]">*</span>
              <span className="text-muted-foreground">First woman beyond LEO: <span className="text-[#00D4FF]">Christina Koch</span></span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-[#FFB400]">*</span>
              <span className="text-muted-foreground">First person of color beyond LEO: <span className="text-[#00D4FF]">Victor Glover</span></span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-[#FFB400]">*</span>
              <span className="text-muted-foreground">First non-American to Moon: <span className="text-[#00D4FF]">Jeremy Hansen</span> (Canada)</span>
            </div>
          </div>
        </div>

        {/* Links */}
        <div className="border-t border-[rgba(0,212,255,0.2)] pt-4">
          <a 
            href="https://www.nasa.gov/mission/artemis-ii" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-2 px-4 rounded text-sm bg-[rgba(0,212,255,0.1)] border border-[rgba(0,212,255,0.3)] text-[#00D4FF] hover:bg-[rgba(0,212,255,0.2)] transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            NASA Official Mission Page
          </a>
        </div>
      </div>
    </aside>
  );
}
