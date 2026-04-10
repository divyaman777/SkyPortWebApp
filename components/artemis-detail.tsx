'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Rocket, Users, MapPin, Gauge, Clock, ChevronRight, Radio, Tv, ExternalLink, Antenna, Play, Square } from 'lucide-react';
import {
  ARTEMIS_COLOR,
  MISSION_START,
  MISSION_DURATION_HOURS,
  PERILUNE_KM,
  ARTEMIS_CREW,
  MISSION_PHASES,
  getCurrentPhase,
  getDistanceFromEarth,
  getVelocity,
  formatMET,
  getLiveDataSource,
} from '@/lib/artemis-data';

interface ArtemisDetailProps {
  isOpen: boolean;
  onClose: () => void;
  elapsedHours: number;
  isPlayback: boolean;
  onPlaybackToggle: () => void;
}

// ─── Simulated Telemetry Stream ─────────────────────────────

function TelemetryStream({ elapsedHours }: { elapsedHours: number }) {
  const [lines, setLines] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const generateTelemetry = () => {
      const phase = getCurrentPhase(elapsedHours);
      const vel = getVelocity(elapsedHours);
      const dist = getDistanceFromEarth(elapsedHours);

      const entries = [
        `[CM_TELM] CABIN_PRESS: ${(14.5 + Math.random() * 0.4).toFixed(1)} psi | TEMP: ${(21 + Math.random() * 2).toFixed(1)}°C`,
        `[ESM_PWR] SOLAR_A: ${(2.7 + Math.random() * 0.3).toFixed(1)} kW | BUS: ${(28 + Math.random()).toFixed(1)} VDC`,
        `[NAV] VEL: ${vel.toFixed(2)} km/s | RANGE: ${dist > 10000 ? (dist / 1000).toFixed(0) + 'k' : dist.toFixed(0)} km`,
        `[COMMS] DSN: GOLDSTONE | RSSI: -${(120 + Math.random() * 30).toFixed(0)} dBm | LOCK: OK`,
        `[GNC] ATT: NOMINAL | PHASE: ${phase.shortName} | MODE: FREE_DRIFT`,
        `[ECLSS] O2: ${(20.5 + Math.random() * 0.5).toFixed(1)}% | CO2: ${(0.2 + Math.random() * 0.1).toFixed(2)}% | H2O: NOMINAL`,
        `[ESM_PROP] MMH: ${(85 - elapsedHours * 0.02).toFixed(0)}% | MON3: ${(87 - elapsedHours * 0.02).toFixed(0)}% | AJ10: STBY`,
        `[THERMAL] CM_SHIELD: ${(45 + Math.random() * 10).toFixed(0)}°C | ESM_RAD: ${(-5 + Math.random() * 15).toFixed(0)}°C`,
        `[CREW] HEARTRATE_AVG: ${(65 + Math.random() * 15).toFixed(0)} bpm | STATUS: ALL_NOMINAL`,
      ];
      return entries[Math.floor(Math.random() * entries.length)];
    };

    const interval = setInterval(() => {
      setLines(prev => [...prev, generateTelemetry()].slice(-10));
    }, 1200);

    return () => clearInterval(interval);
  }, [elapsedHours]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines]);

  return (
    <div ref={scrollRef} className="bg-[rgba(0,0,0,0.5)] border border-[rgba(68,138,255,0.25)] rounded p-3 font-mono text-[10px] max-h-40 overflow-y-auto">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-1.5 h-1.5 rounded-full bg-[#448AFF] animate-pulse" />
        <span className="text-[#448AFF] text-[10px]">ORION_TELEMETRY</span>
        <span className="text-muted-foreground text-[9px] ml-auto">Ka-band 26 GHz</span>
      </div>
      {lines.map((line, i) => (
        <div key={i} className="text-[#00D4FF] opacity-80 leading-relaxed">
          <span className="text-muted-foreground">&gt;</span> {line}
        </div>
      ))}
      {lines.length === 0 && (
        <div className="text-muted-foreground">Acquiring signal...</div>
      )}
    </div>
  );
}

// ─── Phase Timeline ─────────────────────────────────────────

function PhaseTimeline({ elapsedHours }: { elapsedHours: number }) {
  const currentPhase = getCurrentPhase(elapsedHours);

  return (
    <div className="space-y-1">
      {MISSION_PHASES.map((phase) => {
        const isCurrent = phase.id === currentPhase.id;
        const isComplete = elapsedHours >= phase.endHour;
        const progress = isCurrent
          ? ((elapsedHours - phase.startHour) / (phase.endHour - phase.startHour)) * 100
          : isComplete ? 100 : 0;

        return (
          <div key={phase.id} className={`flex items-center gap-2 text-[10px] py-1 px-2 rounded transition-all ${isCurrent ? 'bg-[rgba(68,138,255,0.08)] border border-[rgba(68,138,255,0.25)]' : ''}`}>
            <div
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{
                backgroundColor: isComplete ? '#00FF41' : isCurrent ? ARTEMIS_COLOR : '#333',
                boxShadow: isCurrent ? `0 0 6px ${ARTEMIS_COLOR}` : 'none',
              }}
            />
            <span className={`flex-1 ${isCurrent ? 'text-[#448AFF]' : isComplete ? 'text-muted-foreground' : 'text-muted-foreground/50'}`}>
              {phase.shortName}
            </span>
            <div className="w-16 h-1 bg-[rgba(255,255,255,0.08)] rounded overflow-hidden">
              <div
                className="h-full rounded transition-all duration-300"
                style={{
                  width: `${progress}%`,
                  backgroundColor: isComplete ? '#00FF41' : ARTEMIS_COLOR,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────

export function ArtemisDetail({ isOpen, onClose, elapsedHours, isPlayback, onPlaybackToggle }: ArtemisDetailProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'telemetry' | 'crew' | 'vehicle'>('overview');

  if (!isOpen) return null;

  const phase = getCurrentPhase(elapsedHours);
  const distance = getDistanceFromEarth(elapsedHours);
  const velocity = getVelocity(elapsedHours);
  const met = formatMET(elapsedHours);
  const progress = (elapsedHours / MISSION_DURATION_HOURS) * 100;

  const launchDate = MISSION_START.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const liveSource = getLiveDataSource();

  return (
    <aside className="fixed top-14 right-0 bottom-10 w-full md:w-[380px] z-40 glass-panel border-l border-[rgba(68,138,255,0.25)] overflow-y-auto scan-reveal">
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Rocket className="w-5 h-5 text-[#448AFF]" />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-foreground">ARTEMIS II</h2>
                <span className="flex items-center gap-1 text-[8px] bg-[rgba(68,138,255,0.12)] text-[#448AFF] px-1.5 py-0.5 rounded">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#448AFF] animate-pulse" />
                  LIVE
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground">First crewed lunar flyby since Apollo 17 (1972)</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* MET Timer */}
        <div className="glass-panel p-3 rounded mb-3 border-[rgba(68,138,255,0.15)]">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" /> MISSION ELAPSED TIME
            </span>
            <span className="text-[9px] text-muted-foreground">Launch: {launchDate}</span>
          </div>
          <div className="text-2xl font-bold font-vt323 text-[#448AFF]" style={{ textShadow: '0 0 10px rgba(68,138,255,0.4)' }}>
            {met}
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="text-[9px] text-muted-foreground">PHASE:</span>
            <span className="text-[10px] text-[#448AFF] font-bold">{phase.name}</span>
          </div>
          {liveSource && (
            <div className="mt-2 flex items-center gap-1.5 text-[9px]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00FF41] animate-pulse" />
              <span className="text-[#00FF41]">LIVE TRACKING</span>
              <span className="text-muted-foreground">via {liveSource}</span>
              <span className="text-muted-foreground ml-auto">NORAD 68538</span>
            </div>
          )}
        </div>

        {/* Progress Bar */}
        <div className="mb-3">
          <div className="flex items-center justify-between text-[9px] mb-1">
            <span className="text-muted-foreground">MISSION PROGRESS</span>
            <span className="text-[#448AFF]">{progress.toFixed(1)}%</span>
          </div>
          <div className="h-1.5 bg-[rgba(255,255,255,0.06)] rounded overflow-hidden">
            <div
              className="h-full rounded transition-all duration-300"
              style={{
                width: `${progress}%`,
                background: 'linear-gradient(90deg, #448AFF, #2962FF)',
                boxShadow: '0 0 6px rgba(68,138,255,0.3)',
              }}
            />
          </div>
        </div>

        {/* Simulation Playback Button */}
        <button
          onClick={onPlaybackToggle}
          className={`w-full flex items-center justify-center gap-2 py-2.5 rounded text-xs font-bold transition-all mb-3 ${
            isPlayback
              ? 'bg-[rgba(68,138,255,0.15)] border border-[rgba(68,138,255,0.5)] text-[#448AFF] hover:bg-[rgba(68,138,255,0.25)]'
              : 'bg-[rgba(0,255,65,0.08)] border border-[rgba(0,255,65,0.3)] text-[#00FF41] hover:bg-[rgba(0,255,65,0.15)]'
          }`}
        >
          {isPlayback ? (
            <>
              <Square className="w-3.5 h-3.5" />
              STOP SIMULATION
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5" />
              START SIMULATION
            </>
          )}
        </button>
        {isPlayback && (
          <p className="text-[9px] text-muted-foreground text-center -mt-2 mb-3">
            Fast-forwarding through complete mission trajectory
          </p>
        )}

        {/* Key Stats Grid */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="glass-panel p-2 rounded text-center">
            <div className="text-[8px] text-muted-foreground flex items-center justify-center gap-1">
              <MapPin className="w-2.5 h-2.5" /> RANGE
            </div>
            <div className="text-xs font-vt323 text-foreground mt-0.5">
              {distance > 10000 ? `${(distance / 1000).toFixed(0)}k` : distance.toFixed(0)} km
            </div>
          </div>
          <div className="glass-panel p-2 rounded text-center">
            <div className="text-[8px] text-muted-foreground flex items-center justify-center gap-1">
              <Gauge className="w-2.5 h-2.5" /> VELOCITY
            </div>
            <div className="text-xs font-vt323 text-foreground mt-0.5">{velocity.toFixed(1)} km/s</div>
          </div>
          <div className="glass-panel p-2 rounded text-center">
            <div className="text-[8px] text-muted-foreground flex items-center justify-center gap-1">
              <Antenna className="w-2.5 h-2.5" /> COMMS
            </div>
            <div className="text-xs font-vt323 text-[#00FF41] mt-0.5">LOCK</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-3 border-b border-[rgba(68,138,255,0.12)] pb-2">
          {(['overview', 'telemetry', 'crew', 'vehicle'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`text-[9px] px-2.5 py-1 rounded transition-all ${
                activeTab === tab
                  ? 'bg-[rgba(68,138,255,0.12)] text-[#448AFF] border border-[rgba(68,138,255,0.25)]'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.toUpperCase()}
            </button>
          ))}
        </div>

        {/* ─── Tab: Overview ─── */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-[9px] text-muted-foreground mb-1">CURRENT PHASE</h3>
              <p className="text-[11px] text-foreground leading-relaxed">{phase.description}</p>
            </div>

            <div>
              <h3 className="text-[9px] text-muted-foreground mb-2">MISSION TIMELINE</h3>
              <PhaseTimeline elapsedHours={elapsedHours} />
            </div>

            <div>
              <h3 className="text-[9px] text-muted-foreground mb-1.5">MISSION FACTS</h3>
              <div className="space-y-1 text-[10px]">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Duration:</span>
                  <span className="text-foreground">~10 days (226 hours)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Trajectory:</span>
                  <span className="text-foreground">Hybrid free-return</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Lunar closest:</span>
                  <span className="text-foreground">{PERILUNE_KM.toLocaleString()} km</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Max distance:</span>
                  <span className="text-foreground">~450,000 km</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Re-entry speed:</span>
                  <span className="text-foreground">~40,000 km/h (Mach 32)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Launch site:</span>
                  <span className="text-foreground">KSC LC-39B, Florida</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Splashdown:</span>
                  <span className="text-foreground">Pacific Ocean</span>
                </div>
              </div>
            </div>

            {/* Live data links */}
            <div>
              <h3 className="text-[9px] text-muted-foreground mb-1.5">LIVE DATA SOURCES</h3>
              <div className="space-y-1.5">
                {[
                  { label: 'NASA Artemis Blog', url: 'https://blogs.nasa.gov/artemis/', icon: Tv },
                  { label: 'Deep Space Network Now', url: 'https://eyes.nasa.gov/dsn/dsn.html', icon: Antenna },
                  { label: 'NASA Eyes — Artemis', url: 'https://eyes.nasa.gov/', icon: Radio },
                ].map(link => (
                  <a
                    key={link.label}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-[10px] text-[#00D4FF] hover:text-[#6EA8FF] transition-colors group"
                  >
                    <link.icon className="w-3 h-3" />
                    <span>{link.label}</span>
                    <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ─── Tab: Telemetry ─── */}
        {activeTab === 'telemetry' && (
          <div className="space-y-4">
            <TelemetryStream elapsedHours={elapsedHours} />

            <div>
              <h3 className="text-[9px] text-muted-foreground mb-1.5">COMMUNICATION LINKS</h3>
              <div className="space-y-2 text-[10px]">
                <div className="glass-panel p-2 rounded">
                  <div className="flex items-center justify-between">
                    <span className="text-foreground font-bold">S-band (uplink/downlink)</span>
                    <span className="text-[#00FF41] text-[9px]">ACTIVE</span>
                  </div>
                  <p className="text-muted-foreground mt-0.5">Voice, commands, low-rate telemetry — 2.2 GHz</p>
                </div>
                <div className="glass-panel p-2 rounded">
                  <div className="flex items-center justify-between">
                    <span className="text-foreground font-bold">Ka-band (downlink)</span>
                    <span className="text-[#00FF41] text-[9px]">ACTIVE</span>
                  </div>
                  <p className="text-muted-foreground mt-0.5">High-rate data, HD video — 26 GHz</p>
                </div>
                <div className="glass-panel p-2 rounded">
                  <div className="flex items-center justify-between">
                    <span className="text-foreground font-bold">Deep Space Network</span>
                    <span className="text-[#00D4FF] text-[9px]">TRACKING</span>
                  </div>
                  <p className="text-muted-foreground mt-0.5">Goldstone (CA), Madrid (Spain), Canberra (AUS)</p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-[9px] text-muted-foreground mb-1.5">ORION SUBSYSTEMS</h3>
              <div className="grid grid-cols-2 gap-1.5 text-[9px]">
                {[
                  { name: 'GN&C', status: 'NOMINAL' },
                  { name: 'ECLSS', status: 'NOMINAL' },
                  { name: 'EPS (Power)', status: 'NOMINAL' },
                  { name: 'Propulsion', status: 'STANDBY' },
                  { name: 'Thermal', status: 'NOMINAL' },
                  { name: 'Crew Health', status: 'NOMINAL' },
                ].map(sys => (
                  <div key={sys.name} className="flex items-center justify-between glass-panel px-2 py-1 rounded">
                    <span className="text-muted-foreground">{sys.name}</span>
                    <span className="text-[#00FF41]">{sys.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ─── Tab: Crew ─── */}
        {activeTab === 'crew' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-[#448AFF]" />
              <span className="text-[9px] text-muted-foreground">4 CREW — FIRST HUMANS BEYOND LEO SINCE 1972</span>
            </div>
            {ARTEMIS_CREW.map((member) => (
              <div key={member.name} className="glass-panel p-3 rounded">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-foreground font-bold">{member.name}</div>
                    <div className="text-[10px] text-[#448AFF]">{member.role}</div>
                  </div>
                  <span className="text-[9px] text-muted-foreground bg-[rgba(255,255,255,0.05)] px-2 py-0.5 rounded">
                    {member.agency}
                  </span>
                </div>
              </div>
            ))}
            <div className="glass-panel p-3 rounded mt-2">
              <h4 className="text-[10px] text-muted-foreground mb-1">HISTORIC SIGNIFICANCE</h4>
              <p className="text-[10px] text-foreground leading-relaxed">
                This crew will travel farther from Earth than any humans in history, surpassing Apollo 13&apos;s record of 400,171 km. Jeremy Hansen will be the first non-American astronaut on a lunar trajectory.
              </p>
            </div>
          </div>
        )}

        {/* ─── Tab: Vehicle ─── */}
        {activeTab === 'vehicle' && (
          <div className="space-y-3">
            <div className="glass-panel p-3 rounded">
              <div className="flex items-center gap-2 mb-1.5">
                <ChevronRight className="w-3 h-3 text-[#448AFF]" />
                <span className="text-sm text-foreground font-bold">SLS Block 1</span>
                <span className="text-[8px] text-muted-foreground">Launch Vehicle</span>
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed mb-2">
                Most powerful rocket ever flown. Two 5-segment SRBs + four RS-25 engines on the core stage.
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[9px]">
                <div><span className="text-muted-foreground">Height:</span> <span className="text-foreground">98.1 m</span></div>
                <div><span className="text-muted-foreground">Thrust:</span> <span className="text-foreground">39.1 MN</span></div>
                <div><span className="text-muted-foreground">Payload LEO:</span> <span className="text-foreground">95,000 kg</span></div>
                <div><span className="text-muted-foreground">Payload TLI:</span> <span className="text-foreground">27,000 kg</span></div>
              </div>
            </div>

            <div className="glass-panel p-3 rounded">
              <div className="flex items-center gap-2 mb-1.5">
                <ChevronRight className="w-3 h-3 text-[#448AFF]" />
                <span className="text-sm text-foreground font-bold">Orion MPCV</span>
                <span className="text-[8px] text-muted-foreground">Crew Module</span>
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed mb-2">
                Deep-space crew capsule by Lockheed Martin. Designed for up to 21-day missions beyond LEO.
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[9px]">
                <div><span className="text-muted-foreground">Diameter:</span> <span className="text-foreground">5.02 m</span></div>
                <div><span className="text-muted-foreground">Height:</span> <span className="text-foreground">3.3 m</span></div>
                <div><span className="text-muted-foreground">Crew:</span> <span className="text-foreground">4</span></div>
                <div><span className="text-muted-foreground">Mass:</span> <span className="text-foreground">9,300 kg (dry)</span></div>
                <div><span className="text-muted-foreground">Heat shield:</span> <span className="text-foreground">5 m AVCOAT</span></div>
                <div><span className="text-muted-foreground">Volume:</span> <span className="text-foreground">19.56 m³</span></div>
              </div>
            </div>

            <div className="glass-panel p-3 rounded">
              <div className="flex items-center gap-2 mb-1.5">
                <ChevronRight className="w-3 h-3 text-[#448AFF]" />
                <span className="text-sm text-foreground font-bold">European Service Module</span>
                <span className="text-[8px] text-muted-foreground">ESM — Airbus/ESA</span>
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed mb-2">
                Provides propulsion, power, thermal control, and consumables. Four X-config solar arrays.
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[9px]">
                <div><span className="text-muted-foreground">Diameter:</span> <span className="text-foreground">4.5 m</span></div>
                <div><span className="text-muted-foreground">Solar span:</span> <span className="text-foreground">19 m</span></div>
                <div><span className="text-muted-foreground">Power:</span> <span className="text-foreground">11.1 kW</span></div>
                <div><span className="text-muted-foreground">Engine:</span> <span className="text-foreground">AJ10-190</span></div>
                <div><span className="text-muted-foreground">Thrust:</span> <span className="text-foreground">26.7 kN</span></div>
                <div><span className="text-muted-foreground">Propellant:</span> <span className="text-foreground">8,600 kg</span></div>
                <div><span className="text-muted-foreground">Engines:</span> <span className="text-foreground">33 total</span></div>
                <div><span className="text-muted-foreground">Isp:</span> <span className="text-foreground">316 s (vac)</span></div>
              </div>
            </div>

            <div className="glass-panel p-3 rounded">
              <div className="flex items-center gap-2 mb-1.5">
                <ChevronRight className="w-3 h-3 text-[#448AFF]" />
                <span className="text-sm text-foreground font-bold">ICPS</span>
                <span className="text-[8px] text-muted-foreground">Upper Stage</span>
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Interim Cryogenic Propulsion Stage (Delta IV-derived). Single RL-10B-2 engine performs TLI burn, then jettisoned.
              </p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
