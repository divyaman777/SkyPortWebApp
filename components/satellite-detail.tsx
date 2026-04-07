'use client';

import { useState, useEffect } from 'react';
import { X, Radio, Tv, Antenna, Wifi } from 'lucide-react';
import { Satellite, categoryColors } from '@/lib/satellite-data';

interface SatelliteDetailProps {
  satellite: Satellite | null;
  onClose: () => void;
}

function AnimatedNumber({ value, decimals = 1 }: { value: number; decimals?: number }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const duration = 500;
    const startTime = Date.now();
    const startValue = displayValue;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      
      setDisplayValue(startValue + (value - startValue) * eased);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [value]);

  return <span className="count-up">{displayValue.toFixed(decimals)}</span>;
}

function ScrambleText({ text, className }: { text: string; className?: string }) {
  const [displayText, setDisplayText] = useState('');
  const chars = '!@#$%^&*()_+-=[]{}|;:,.<>?0123456789';

  useEffect(() => {
    let iteration = 0;
    const interval = setInterval(() => {
      setDisplayText(
        text
          .split('')
          .map((char, index) => {
            if (index < iteration) return text[index];
            return chars[Math.floor(Math.random() * chars.length)];
          })
          .join('')
      );

      if (iteration >= text.length) {
        clearInterval(interval);
      }

      iteration += 1;
    }, 30);

    return () => clearInterval(interval);
  }, [text]);

  return <span className={className}>{displayText}</span>;
}

function CountdownTimer({ initialTime }: { initialTime: string }) {
  const [time, setTime] = useState(initialTime);

  useEffect(() => {
    const interval = setInterval(() => {
      const parts = time.split(':').map(Number);
      let [hours, minutes, seconds] = parts;
      
      seconds--;
      if (seconds < 0) {
        seconds = 59;
        minutes--;
        if (minutes < 0) {
          minutes = 59;
          hours--;
          if (hours < 0) {
            hours = 23;
          }
        }
      }
      
      setTime(
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [time]);

  return <span className="text-[#00D4FF] font-vt323 text-lg glow-cyan">{time}</span>;
}

// Determine media type based on satellite category
function getMediaType(category: string): 'text' | 'audio' | 'video' {
  switch (category) {
    case 'WEATHER_SAT':
    case 'EARTH_OBS':
      return 'video'; // Weather/Earth observation satellites send imagery
    case 'AMATEUR_RADIO':
    case 'GPS_GNSS':
      return 'audio'; // Amateur radio and GPS send audio/signals
    default:
      return 'text'; // Most satellites send telemetry data
  }
}

// Text data stream component
function TextDataStream({ satellite }: { satellite: Satellite }) {
  const [dataLines, setDataLines] = useState<string[]>([]);
  
  useEffect(() => {
    const generateData = () => {
      const dataTypes = [
        `[TELEMETRY] TEMP: ${(Math.random() * 60 - 20).toFixed(1)}°C | PWR: ${(Math.random() * 100).toFixed(0)}%`,
        `[BEACON] ${satellite.noradId} | ALT: ${satellite.altitude.toFixed(0)}km | VEL: ${satellite.velocity.toFixed(2)}km/s`,
        `[SIGNAL] RSSI: -${(Math.random() * 40 + 60).toFixed(0)}dBm | SNR: ${(Math.random() * 20 + 5).toFixed(1)}dB`,
        `[STATUS] SYS_OK | BAT: ${(Math.random() * 30 + 70).toFixed(0)}% | SOLAR: NOMINAL`,
        `[DATA] PKT_${Math.floor(Math.random() * 9999).toString().padStart(4, '0')} | CRC: OK`,
        `[POS] LAT: ${satellite.latitude.toFixed(4)} | LON: ${satellite.longitude.toFixed(4)}`,
      ];
      return dataTypes[Math.floor(Math.random() * dataTypes.length)];
    };
    
    const interval = setInterval(() => {
      setDataLines(prev => {
        const newLines = [...prev, generateData()];
        return newLines.slice(-8);
      });
    }, 800);
    
    return () => clearInterval(interval);
  }, [satellite]);
  
  return (
    <div className="bg-[rgba(0,0,0,0.5)] border border-[rgba(0,255,65,0.3)] rounded p-3 font-mono text-xs max-h-48 overflow-y-auto">
      <div className="flex items-center gap-2 mb-2 text-[#00FF41]">
        <span className="status-dot active" />
        <span>TEXT_TELEMETRY</span>
      </div>
      {dataLines.map((line, i) => (
        <div key={i} className="text-[#00D4FF] opacity-90 leading-relaxed">
          <span className="text-muted-foreground">&gt;</span> {line}
        </div>
      ))}
      {dataLines.length === 0 && (
        <div className="text-muted-foreground">Receiving data...</div>
      )}
    </div>
  );
}

// Audio stream component with visualizer
function AudioStream({ satellite }: { satellite: Satellite }) {
  const [bars, setBars] = useState<number[]>(Array(20).fill(0));
  const [frequency, setFrequency] = useState('145.800');
  
  useEffect(() => {
    // Simulate audio visualization
    const interval = setInterval(() => {
      setBars(prev => prev.map(() => Math.random() * 100));
    }, 100);
    
    // Simulate frequency scanning
    const freqInterval = setInterval(() => {
      const freqs = ['145.800', '437.550', '435.900', '146.520', '432.100'];
      setFrequency(freqs[Math.floor(Math.random() * freqs.length)]);
    }, 3000);
    
    return () => {
      clearInterval(interval);
      clearInterval(freqInterval);
    };
  }, []);
  
  return (
    <div className="bg-[rgba(0,0,0,0.5)] border border-[rgba(0,212,255,0.3)] rounded p-3">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-[#00D4FF]">
          <span className="status-dot active" style={{ background: '#00D4FF', boxShadow: '0 0 6px #00D4FF' }} />
          <span className="text-xs font-mono">AUDIO_STREAM</span>
        </div>
        <div className="text-xs font-mono text-[#FFB300]">{frequency} MHz</div>
      </div>
      
      {/* Audio visualizer bars */}
      <div className="flex items-end justify-center gap-1 h-16 bg-[rgba(0,0,0,0.3)] rounded p-2">
        {bars.map((height, i) => (
          <div
            key={i}
            className="w-2 bg-gradient-to-t from-[#00D4FF] to-[#00FF41] rounded-sm transition-all duration-100"
            style={{ height: `${Math.max(height, 5)}%` }}
          />
        ))}
      </div>
      
      <div className="flex items-center justify-between mt-3 text-xs font-mono">
        <span className="text-muted-foreground">SIGNAL: STRONG</span>
        <span className="text-[#00FF41]">DECODING...</span>
      </div>
      
      {/* Simulated decoded messages */}
      <div className="mt-2 text-xs font-mono text-[#00D4FF] opacity-80">
        <div>&gt; CQ CQ CQ DE {satellite.name.substring(0, 6).toUpperCase()}</div>
        <div>&gt; QTH: ORBIT {satellite.altitude.toFixed(0)}KM</div>
      </div>
    </div>
  );
}

// Video stream component
function VideoStream({ satellite }: { satellite: Satellite }) {
  const [frame, setFrame] = useState(0);
  const [noiseLevel, setNoiseLevel] = useState(0.3);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setFrame(f => f + 1);
      setNoiseLevel(0.1 + Math.random() * 0.2);
    }, 100);
    
    return () => clearInterval(interval);
  }, []);
  
  // Generate noise pattern
  const noisePattern = Array(12).fill(0).map((_, i) => (
    <div 
      key={i} 
      className="absolute inset-0 opacity-20"
      style={{
        background: `repeating-linear-gradient(
          ${Math.random() * 360}deg,
          transparent,
          transparent ${Math.random() * 3}px,
          rgba(0,255,65,${noiseLevel}) ${Math.random() * 3}px,
          transparent ${Math.random() * 6}px
        )`,
        animation: `flicker ${0.1 + Math.random() * 0.2}s infinite`
      }}
    />
  ));
  
  return (
    <div className="bg-[rgba(0,0,0,0.5)] border border-[rgba(255,179,0,0.3)] rounded p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-[#FFB300]">
          <span className="status-dot active" style={{ background: '#FFB300', boxShadow: '0 0 6px #FFB300' }} />
          <span className="text-xs font-mono">VIDEO_FEED</span>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-muted-foreground">FRM:</span>
          <span className="text-[#00FF41]">{frame.toString().padStart(6, '0')}</span>
        </div>
      </div>
      
      {/* Simulated video display */}
      <div className="relative aspect-video bg-[#0a0a0f] rounded overflow-hidden">
        {/* Earth view simulation */}
        <div 
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse at ${50 + Math.sin(frame * 0.02) * 20}% ${50 + Math.cos(frame * 0.02) * 10}%, 
                #0a3d62 0%, 
                #1a5276 30%, 
                #0c1821 70%,
                #000 100%
              )
            `
          }}
        />
        
        {/* Cloud patterns */}
        <div 
          className="absolute inset-0 opacity-40"
          style={{
            background: `
              radial-gradient(circle at ${30 + frame % 100}% 40%, white 0%, transparent 20%),
              radial-gradient(circle at ${60 + (frame * 0.5) % 80}% 60%, white 0%, transparent 15%)
            `
          }}
        />
        
        {/* Noise overlay */}
        {noisePattern}
        
        {/* Scanlines */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.3) 2px, rgba(0,0,0,0.3) 4px)'
        }} />
        
        {/* HUD overlay */}
        <div className="absolute top-2 left-2 text-xs font-mono text-[#00FF41] opacity-80">
          <div>LAT: {satellite.latitude.toFixed(2)}</div>
          <div>LON: {satellite.longitude.toFixed(2)}</div>
        </div>
        <div className="absolute top-2 right-2 text-xs font-mono text-[#FFB300]">
          REC
          <span className="inline-block w-2 h-2 bg-[#FF4444] rounded-full ml-1 animate-pulse" />
        </div>
        <div className="absolute bottom-2 left-2 text-xs font-mono text-[#00D4FF]">
          ALT: {satellite.altitude.toFixed(0)}km
        </div>
        <div className="absolute bottom-2 right-2 text-xs font-mono text-muted-foreground">
          {satellite.name}
        </div>
      </div>
      
      <div className="flex items-center justify-between mt-2 text-xs font-mono">
        <span className="text-muted-foreground">SSTV MODE: PD120</span>
        <span className="text-[#00FF41]">LIVE</span>
      </div>
    </div>
  );
}

// Connect button with broadcast data display
function ConnectButton({ satellite }: { satellite: Satellite }) {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  
  const mediaType = getMediaType(satellite.category);
  
  const handleConnect = () => {
    setConnecting(true);
    setTimeout(() => {
      setConnecting(false);
      setConnected(true);
    }, 1500);
  };
  
  const handleDisconnect = () => {
    setConnected(false);
  };
  
  return (
    <div className="space-y-3">
      {!connected && !connecting && (
        <button 
          onClick={handleConnect}
          className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded text-sm font-bold transition-all bg-[rgba(0,212,255,0.15)] border border-[#00D4FF] text-[#00D4FF] hover:bg-[rgba(0,212,255,0.25)]"
        >
          <Wifi className="w-5 h-5" />
          <span>CONNECT TO SATELLITE</span>
        </button>
      )}
      
      {connecting && (
        <button 
          disabled
          className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded text-sm font-bold bg-[rgba(255,179,0,0.2)] border border-[#FFB300] text-[#FFB300] cursor-wait"
        >
          <Wifi className="w-5 h-5 animate-pulse" />
          <span>CONNECTING...</span>
        </button>
      )}
      
      {connected && (
        <>
          {/* Status bar */}
          <div className="flex items-center justify-between px-3 py-2 bg-[rgba(0,255,65,0.1)] border border-[#00FF41] rounded">
            <div className="flex items-center gap-2">
              <span className="status-dot active" />
              <span className="text-[#00FF41] text-sm font-mono">CONNECTED</span>
            </div>
            <span className="text-xs text-muted-foreground font-mono">
              {mediaType.toUpperCase()} STREAM
            </span>
          </div>
          
          {/* Media content based on type */}
          {mediaType === 'text' && <TextDataStream satellite={satellite} />}
          {mediaType === 'audio' && <AudioStream satellite={satellite} />}
          {mediaType === 'video' && <VideoStream satellite={satellite} />}
          
          {/* Disconnect button */}
          <button 
            onClick={handleDisconnect}
            className="w-full flex items-center justify-center gap-3 py-2 px-4 rounded text-sm font-bold transition-all bg-[rgba(255,68,68,0.15)] border border-[#FF4444] text-[#FF4444] hover:bg-[rgba(255,68,68,0.25)]"
          >
            <X className="w-4 h-4" />
            <span>DISCONNECT</span>
          </button>
        </>
      )}
    </div>
  );
}

export function SatelliteDetail({ satellite, onClose }: SatelliteDetailProps) {
  if (!satellite) return null;

  const color = categoryColors[satellite.category];

  return (
    <aside className="fixed right-0 top-14 bottom-10 w-full md:w-[380px] glass-panel border-l border-[rgba(0,255,65,0.2)] z-50 scan-reveal overflow-hidden flex flex-col bg-[#0a0a0f]">
      {/* Title bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[rgba(0,255,65,0.2)] bg-[rgba(0,0,0,0.3)]">
        <div className="flex items-center gap-2">
          <span className="text-[#00FF41]">┌─</span>
          <span className="text-[#00D4FF] text-sm">SATELLITE_DETAIL</span>
          <span className="text-[#00FF41]">─</span>
        </div>
        <button 
          onClick={onClose}
          className="text-muted-foreground hover:text-[#00FF41] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Name and basic info */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[#00FF41]">&gt;</span>
            <ScrambleText text={satellite.name} className="text-foreground font-bold" />
          </div>
          <div className="pl-4 space-y-1 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">NORAD_ID:</span>
              <span className="text-[#00D4FF] font-vt323">{satellite.noradId}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">CATEGORY:</span>
              <span style={{ color }}>{satellite.category}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">STATUS:</span>
              <span className={`px-2 py-0.5 rounded text-xs ${satellite.status === 'ACTIVE' ? 'bg-[rgba(0,255,65,0.2)] text-[#00FF41]' : 'bg-[rgba(102,102,102,0.2)] text-[#666]'}`}>
                [{satellite.status}]
              </span>
              {satellite.inView && (
                <span className="flex items-center gap-1 text-[#00FF41] text-xs">
                  <span className="status-dot active" />
                  IN_VIEW
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Orbital Parameters */}
        <div className="border-t border-[rgba(0,255,65,0.2)] pt-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[#00FF41]">├─</span>
            <span className="text-muted-foreground text-sm">ORBITAL_PARAMETERS</span>
            <span className="text-[#00FF41] flex-1">─</span>
          </div>
          
          <div className="space-y-2 text-sm pl-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">ALTITUDE:</span>
              <span className="text-[#00FF41] font-vt323 text-base glow-green">
                <AnimatedNumber value={satellite.altitude} decimals={1} /> km
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">VELOCITY:</span>
              <span className="text-[#00D4FF] font-vt323 text-base glow-cyan">
                <AnimatedNumber value={satellite.velocity} decimals={2} /> km/s
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">INCLINATION:</span>
              <span className="text-foreground font-vt323 text-base">
                <AnimatedNumber value={satellite.inclination} decimals={1} /> deg
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">PERIOD:</span>
              <span className="text-foreground font-vt323 text-base">
                <AnimatedNumber value={satellite.period} decimals={1} /> min
              </span>
            </div>
            {satellite.nextPass && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">NEXT_PASS:</span>
                <div className="flex items-center gap-2">
                  <CountdownTimer initialTime={satellite.nextPass} />
                  <span className="text-[#FFB300]">←</span>
                </div>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">POSITION:</span>
              <span className="text-foreground font-vt323 text-base">
                {satellite.latitude.toFixed(1)}°{satellite.latitude >= 0 ? 'N' : 'S'} {Math.abs(satellite.longitude).toFixed(1)}°{satellite.longitude >= 0 ? 'E' : 'W'}
              </span>
            </div>
          </div>
        </div>

        {/* Broadcast Signals */}
        {satellite.signals && satellite.signals.length > 0 && (
          <div className="border-t border-[rgba(0,255,65,0.2)] pt-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[#00FF41]">├─</span>
              <span className="text-muted-foreground text-sm">BROADCAST_SIGNALS</span>
              <span className="text-[#00FF41] flex-1">─</span>
            </div>
            
            <div className="space-y-3 pl-4">
              {satellite.signals.map((signal, index) => (
                <div key={index} className="space-y-1">
                  <div className="flex items-center gap-2">
                    {signal.type === 'AMATEUR_RADIO' && <Radio className="w-4 h-4 text-[#00D4FF]" />}
                    {signal.type === 'SSTV_IMAGES' && <Tv className="w-4 h-4 text-[#00D4FF]" />}
                    {signal.type === 'TELEMETRY' && <Antenna className="w-4 h-4 text-[#00D4FF]" />}
                    {signal.type === 'BROADCAST' && <Radio className="w-4 h-4 text-[#FFB300]" />}
                    <span className="text-[#00D4FF] text-sm">{signal.type}</span>
                  </div>
                  <div className="pl-6 text-xs space-y-0.5">
                    {signal.frequency && (
                      <div className="flex gap-2">
                        <span className="text-muted-foreground">FREQ:</span>
                        <span className="text-foreground">{signal.frequency}</span>
                      </div>
                    )}
                    {signal.mode && (
                      <div className="flex gap-2">
                        <span className="text-muted-foreground">MODE:</span>
                        <span className="text-foreground">{signal.mode}</span>
                      </div>
                    )}
                    {signal.status && (
                      <div className="flex gap-2">
                        <span className="text-muted-foreground">STATUS:</span>
                        <span className="text-foreground">{signal.status}</span>
                      </div>
                    )}
                    {signal.description && (
                      <div className="text-muted-foreground">{signal.description}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Connect button */}
      <div className="border-t border-[rgba(0,255,65,0.2)] p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[#00FF41]">└─</span>
          <span className="text-[#00FF41] flex-1">─</span>
        </div>
        <ConnectButton satellite={satellite} />
      </div>
    </aside>
  );
}
