'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Radio, Tv, Antenna, Wifi, ExternalLink, RefreshCw, Image as ImageIcon } from 'lucide-react';
import { Satellite, categoryColors } from '@/lib/satellite-data';
import { REGISTRY_MAP, type SatelliteRegistryEntry, type DataFeed } from '@/lib/satellite-registry';
import { cachedFetch } from '@/lib/api-cache';
import { trackAudioPlay, trackAudioStop, trackDataFeedConnect, trackVideoStream } from '@/lib/analytics';

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

// Audio stream component with visualizer and playable radio signal
function AudioStream({ satellite }: { satellite: Satellite }) {
  const [bars, setBars] = useState<number[]>(Array(20).fill(0));
  const [frequency, setFrequency] = useState('145.800');
  const [isPlaying, setIsPlaying] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscillatorsRef = useRef<OscillatorNode[]>([]);
  const gainRef = useRef<GainNode | null>(null);
  const noiseIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
      stopAudio();
    };
  }, []);

  const stopAudio = () => {
    oscillatorsRef.current.forEach(osc => { try { osc.stop(); } catch {} });
    oscillatorsRef.current = [];
    if (noiseIntervalRef.current) clearInterval(noiseIntervalRef.current);
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close().catch(() => {});
    }
    audioCtxRef.current = null;
    gainRef.current = null;
  };

  const toggleAudio = () => {
    if (isPlaying) {
      stopAudio();
      setIsPlaying(false);
      trackAudioStop(satellite.name);
      return;
    }
    trackAudioPlay(satellite.name, frequency);

    // Create Web Audio context for radio signal synthesis
    const ctx = new AudioContext();
    audioCtxRef.current = ctx;

    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.15;
    masterGain.connect(ctx.destination);
    gainRef.current = masterGain;

    // Carrier tone — base frequency from satellite data
    const baseFreq = parseFloat(frequency) || 145.8;
    const carrier = ctx.createOscillator();
    carrier.type = 'sine';
    carrier.frequency.value = 800 + (baseFreq % 10) * 50; // Map to audible range
    const carrierGain = ctx.createGain();
    carrierGain.gain.value = 0.3;
    carrier.connect(carrierGain).connect(masterGain);
    carrier.start();
    oscillatorsRef.current.push(carrier);

    // Subcarrier — slight detuning for FM texture
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.value = carrier.frequency.value + 15;
    const subGain = ctx.createGain();
    subGain.gain.value = 0.15;
    sub.connect(subGain).connect(masterGain);
    sub.start();
    oscillatorsRef.current.push(sub);

    // Telemetry beeps — periodic short bursts
    const beepOsc = ctx.createOscillator();
    beepOsc.type = 'square';
    beepOsc.frequency.value = 1200;
    const beepGain = ctx.createGain();
    beepGain.gain.value = 0;
    beepOsc.connect(beepGain).connect(masterGain);
    beepOsc.start();
    oscillatorsRef.current.push(beepOsc);

    // Schedule telemetry beep pattern
    let beepTime = ctx.currentTime + 0.5;
    const scheduleBeeps = () => {
      const now = ctx.currentTime;
      for (let i = 0; i < 4; i++) {
        const t = now + i * 0.3;
        beepGain.gain.setValueAtTime(0.2, t);
        beepGain.gain.setValueAtTime(0, t + 0.08);
      }
    };
    scheduleBeeps();
    noiseIntervalRef.current = setInterval(scheduleBeeps, 2000);

    // Static noise — white noise via buffer
    const bufferSize = ctx.sampleRate * 2;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.5;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.08;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 1000;
    noiseFilter.Q.value = 0.5;
    noise.connect(noiseFilter).connect(noiseGain).connect(masterGain);
    noise.start();

    setIsPlaying(true);
  };

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
            className="w-2 rounded-sm transition-all duration-100"
            style={{
              height: `${Math.max(height, 5)}%`,
              background: isPlaying
                ? `linear-gradient(to top, #00D4FF, #00FF41)`
                : `linear-gradient(to top, #00D4FF44, #00FF4144)`,
            }}
          />
        ))}
      </div>

      {/* Play/Stop button */}
      <button
        onClick={toggleAudio}
        className={`w-full mt-3 py-2 px-3 text-xs font-mono font-bold rounded transition-all flex items-center justify-center gap-2 ${
          isPlaying
            ? 'bg-[rgba(255,68,68,0.2)] border border-[rgba(255,68,68,0.5)] text-[#FF4444] hover:bg-[rgba(255,68,68,0.3)]'
            : 'bg-[rgba(0,255,65,0.15)] border border-[rgba(0,255,65,0.5)] text-[#00FF41] hover:bg-[rgba(0,255,65,0.25)]'
        }`}
      >
        {isPlaying ? (
          <><span className="inline-block w-2.5 h-2.5 bg-[#FF4444] rounded-sm" /> STOP RADIO</>
        ) : (
          <><span className="inline-block w-0 h-0 border-l-[8px] border-l-[#00FF41] border-y-[5px] border-y-transparent" /> PLAY RADIO SIGNAL</>
        )}
      </button>

      <div className="flex items-center justify-between mt-3 text-xs font-mono">
        <span className="text-muted-foreground">SIGNAL: {isPlaying ? 'RECEIVING' : 'STANDBY'}</span>
        <span className={isPlaying ? 'text-[#00FF41]' : 'text-muted-foreground'}>{isPlaying ? 'DECODING...' : 'IDLE'}</span>
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

// ─── Real Data Feed Components ─────────────────────────────

// Known NASA ISS live stream video IDs — NASA rotates these periodically
const ISS_STREAM_IDS = ['zPH5KtjJFaQ', 'sWasdbDVNvc', 'P9C25Un7xaM', 'xRPjKQtRXR8'];

// ISS Live Stream + Crew
function ISSDataFeed({ satellite }: { satellite: Satellite }) {
  const [crew, setCrew] = useState<{ name: string; craft: string }[]>([]);
  const [crewError, setCrewError] = useState(false);
  const [streamIdx, setStreamIdx] = useState(0);
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    cachedFetch<{ people: { name: string; craft: string }[] }>(
      'http://api.open-notify.org/astros.json',
      'iss-crew',
      3600000,
      true
    ).then(data => {
      if (data?.people) {
        setCrew(data.people.filter(p => p.craft === 'ISS'));
      }
    }).catch(() => setCrewError(true));
  }, []);

  const tryNextStream = () => {
    if (streamIdx < ISS_STREAM_IDS.length - 1) {
      setStreamIdx(prev => prev + 1);
      trackVideoStream(satellite.name, 'next');
    } else {
      setShowFallback(true);
      trackVideoStream(satellite.name, 'fallback');
    }
  };

  return (
    <div className="space-y-3">
      {/* Live video embed */}
      <div className="bg-[rgba(0,0,0,0.5)] border border-[rgba(0,255,65,0.3)] rounded overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 text-xs text-[#00FF41]">
          <Tv className="w-3 h-3" />
          <span>NASA HD LIVE STREAM</span>
          <span className="ml-auto inline-block w-2 h-2 bg-[#FF4444] rounded-full animate-pulse" />
          <span className="text-[#FF4444] text-[10px]">LIVE</span>
        </div>
        {!showFallback ? (
          <div className="aspect-video">
            <iframe
              src={`https://www.youtube.com/embed/${ISS_STREAM_IDS[streamIdx]}?autoplay=0&mute=1`}
              className="w-full h-full"
              allow="accelerometer; autoplay; encrypted-media; gyroscope"
              allowFullScreen
              title="ISS Live Stream"
            />
          </div>
        ) : (
          <div className="aspect-video relative">
            <VideoStream satellite={satellite} />
          </div>
        )}
        {/* Controls below video */}
        <div className="flex items-center gap-2 px-3 py-2 border-t border-[rgba(0,255,65,0.15)]">
          {!showFallback && (
            <button
              onClick={tryNextStream}
              className="text-[10px] font-mono text-[#FFB300] hover:text-[#FFD54F] transition-colors"
            >
              VIDEO UNAVAILABLE? TRY NEXT →
            </button>
          )}
          {showFallback && (
            <span className="text-[10px] font-mono text-muted-foreground">SIMULATED FEED — OPEN LIVE ↗</span>
          )}
          <a
            href="https://www.nasa.gov/live/"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto text-[10px] font-mono text-[#00D4FF] hover:text-[#4DE8FF] flex items-center gap-1 transition-colors"
          >
            <ExternalLink className="w-2.5 h-2.5" />
            NASA LIVE
          </a>
        </div>
      </div>

      {/* Crew manifest */}
      <div className="bg-[rgba(0,0,0,0.5)] border border-[rgba(0,212,255,0.3)] rounded p-3">
        <div className="text-xs text-[#00D4FF] mb-2 flex items-center gap-2">
          <span className="status-dot active" style={{ background: '#00D4FF', boxShadow: '0 0 6px #00D4FF' }} />
          CREW MANIFEST ({crew.length})
        </div>
        {crewError ? (
          <div className="text-xs text-[#FFB300]">[SIGNAL_LOST] Crew data unavailable</div>
        ) : crew.length > 0 ? (
          <div className="space-y-1">
            {crew.map((person, i) => (
              <div key={i} className="text-xs font-mono text-foreground">
                <span className="text-muted-foreground">&gt;</span> {person.name}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-muted-foreground animate-pulse">Loading crew data...</div>
        )}
      </div>

      {/* Live telemetry */}
      <div className="bg-[rgba(0,0,0,0.5)] border border-[rgba(0,255,65,0.3)] rounded p-3 text-xs font-mono space-y-1">
        <div className="text-[#00FF41]">LIVE TELEMETRY</div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">ALTITUDE:</span>
          <span className="text-[#00FF41]">{satellite.altitude.toFixed(1)} km</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">VELOCITY:</span>
          <span className="text-[#00D4FF]">{satellite.velocity.toFixed(2)} km/s</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">POSITION:</span>
          <span className="text-foreground">
            {Math.abs(satellite.latitude).toFixed(2)}°{satellite.latitude >= 0 ? 'N' : 'S'},{' '}
            {Math.abs(satellite.longitude).toFixed(2)}°{satellite.longitude >= 0 ? 'E' : 'W'}
          </span>
        </div>
      </div>
    </div>
  );
}

// GOES Weather Imagery
function GOESDataFeed({ satellite }: { satellite: Satellite }) {
  const [band, setBand] = useState<'GEOCOLOR' | 'IR' | 'WV'>('GEOCOLOR');
  const [imageError, setImageError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const satNum = satellite.name.includes('16') ? 'GOES16' : 'GOES18';
  const bandUrls: Record<string, string> = {
    GEOCOLOR: `https://cdn.star.nesdis.noaa.gov/${satNum}/ABI/FD/GEOCOLOR/latest.jpg`,
    IR: `https://cdn.star.nesdis.noaa.gov/${satNum}/ABI/FD/13/latest.jpg`,
    WV: `https://cdn.star.nesdis.noaa.gov/${satNum}/ABI/FD/09/latest.jpg`,
  };

  // Auto-refresh every 10 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshKey(k => k + 1);
      setImageError(false);
    }, 600000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-3">
      {/* Band selector */}
      <div className="flex gap-1">
        {(['GEOCOLOR', 'IR', 'WV'] as const).map(b => (
          <button
            key={b}
            onClick={() => { setBand(b); setImageError(false); }}
            className={`flex-1 py-1.5 px-2 text-xs font-mono rounded transition-colors ${
              band === b
                ? 'bg-[rgba(255,179,0,0.2)] border border-[#FFB300] text-[#FFB300]'
                : 'bg-[rgba(0,0,0,0.3)] border border-[rgba(255,179,0,0.2)] text-muted-foreground hover:text-foreground'
            }`}
          >
            {b === 'GEOCOLOR' ? 'GeoColor' : b === 'IR' ? 'Infrared' : 'Water Vapor'}
          </button>
        ))}
      </div>

      {/* Weather image */}
      <div className="bg-[rgba(0,0,0,0.5)] border border-[rgba(255,179,0,0.3)] rounded overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 text-xs">
          <span className="text-[#FFB300]">
            <ImageIcon className="w-3 h-3 inline mr-1" />
            FULL DISK {band}
          </span>
          <button onClick={() => { setRefreshKey(k => k + 1); setImageError(false); }} className="text-muted-foreground hover:text-[#FFB300]">
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
        {imageError ? (
          <div className="aspect-video flex items-center justify-center text-xs text-[#FFB300]">
            [SIGNAL_LOST] Image unavailable — Retrying...
          </div>
        ) : (
          <img
            key={`${band}-${refreshKey}`}
            src={bandUrls[band]}
            alt={`${satNum} ${band}`}
            className="w-full"
            onError={() => setImageError(true)}
            loading="lazy"
          />
        )}
        <div className="px-3 py-1 text-[10px] text-muted-foreground">
          Updates every 10 minutes | Source: NOAA NESDIS
        </div>
      </div>
    </div>
  );
}

// NASA Images API feed (Hubble / JWST)
function NASAImagesFeed({ query, label }: { query: string; label: string }) {
  const [images, setImages] = useState<{ title: string; url: string; description: string; date: string }[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    cachedFetch<{ collection: { items: { data: { title: string; description: string; date_created: string }[]; links: { href: string }[] }[] } }>(
      `https://images-api.nasa.gov/search?q=${encodeURIComponent(query)}&media_type=image&page_size=5`,
      `nasa-images-${query}`,
      86400000 // 24 hour cache
    ).then(data => {
      if (data?.collection?.items) {
        const parsed = data.collection.items
          .filter(item => item.links?.[0]?.href && item.data?.[0])
          .map(item => ({
            title: item.data[0].title,
            url: item.links[0].href,
            description: (item.data[0].description || '').substring(0, 200),
            date: item.data[0].date_created?.substring(0, 10) || 'Unknown',
          }));
        setImages(parsed);
      }
      setLoading(false);
    }).catch(() => { setError(true); setLoading(false); });
  }, [query]);

  if (loading) return <div className="text-xs text-muted-foreground animate-pulse p-3">Loading {label} images...</div>;
  if (error || images.length === 0) return <div className="text-xs text-[#FFB300] p-3">[SIGNAL_LOST] {label} images unavailable</div>;

  const img = images[currentIndex];

  return (
    <div className="space-y-3">
      <div className="bg-[rgba(0,0,0,0.5)] border border-[rgba(0,212,255,0.3)] rounded overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 text-xs">
          <span className="text-[#00D4FF]">
            <ImageIcon className="w-3 h-3 inline mr-1" />
            {label}
          </span>
          <span className="text-muted-foreground">{currentIndex + 1}/{images.length}</span>
        </div>
        <img
          src={img.url}
          alt={img.title}
          className="w-full aspect-video object-cover"
          loading="lazy"
        />
        <div className="px-3 py-2 space-y-1">
          <div className="text-xs text-foreground font-bold">{img.title}</div>
          <div className="text-[10px] text-muted-foreground">{img.date}</div>
          {img.description && (
            <div className="text-[10px] text-muted-foreground leading-relaxed">{img.description}...</div>
          )}
        </div>
      </div>
      {images.length > 1 && (
        <button
          onClick={() => setCurrentIndex((currentIndex + 1) % images.length)}
          className="w-full py-2 text-xs font-mono text-[#00D4FF] bg-[rgba(0,212,255,0.1)] border border-[rgba(0,212,255,0.3)] rounded hover:bg-[rgba(0,212,255,0.2)]"
        >
          VIEW NEXT IMAGE →
        </button>
      )}
    </div>
  );
}

// SatNOGS / NOAA-19 / AO-91 data — shows audio visualizer + frequencies + SatNOGS link
function SatNOGSFeed({ satellite }: { satellite: Satellite }) {
  return (
    <div className="space-y-3">
      {/* Live audio visualizer for the radio signal */}
      <AudioStream satellite={satellite} />

      <div className="bg-[rgba(0,0,0,0.5)] border border-[rgba(0,212,255,0.3)] rounded p-3">
        <div className="text-xs text-[#00D4FF] mb-2">RADIO FREQUENCIES</div>
        {satellite.signals?.map((sig, i) => (
          <div key={i} className="text-xs font-mono text-foreground mb-1">
            <span className="text-muted-foreground">&gt;</span> {sig.frequency || 'N/A'} — {sig.mode || sig.type}
          </div>
        ))}
      </div>

      <a
        href={`https://network.satnogs.org/observations/?satellite__norad_cat_id=${satellite.noradId}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 w-full py-2 px-3 text-xs font-mono text-[#00D4FF] bg-[rgba(0,212,255,0.1)] border border-[rgba(0,212,255,0.3)] rounded hover:bg-[rgba(0,212,255,0.2)]"
      >
        <ExternalLink className="w-3 h-3" />
        VIEW ON SATNOGS NETWORK →
      </a>
    </div>
  );
}

// Landsat data feed — earth observation imagery + links
function LandsatFeed({ satellite }: { satellite: Satellite }) {
  return (
    <div className="space-y-3">
      {/* Live earth observation video simulation */}
      <VideoStream satellite={satellite} />
      <div className="bg-[rgba(0,0,0,0.5)] border border-[rgba(255,140,0,0.3)] rounded p-3 text-xs">
        <div className="text-[#FF8C00] mb-2">EARTH OBSERVATION DATA</div>
        <div className="text-muted-foreground mb-2">
          Landsat 9 captures multispectral imagery of Earth&apos;s surface in 11 spectral bands.
        </div>
        <div className="grid grid-cols-2 gap-1 text-muted-foreground">
          <span>SWATH:</span><span className="text-[#FF8C00]">185 km</span>
          <span>RESOLUTION:</span><span className="text-[#FF8C00]">15-100 m</span>
          <span>REVISIT:</span><span className="text-[#FF8C00]">16 days</span>
          <span>BANDS:</span><span className="text-[#FF8C00]">11 spectral</span>
        </div>
      </div>
      <a
        href="https://landsat.gsfc.nasa.gov/"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 w-full py-2 px-3 text-xs font-mono text-[#FF8C00] bg-[rgba(255,140,0,0.1)] border border-[rgba(255,140,0,0.3)] rounded hover:bg-[rgba(255,140,0,0.2)]"
      >
        <ExternalLink className="w-3 h-3" />
        NASA LANDSAT SCIENCE →
      </a>
      <a
        href="https://earthexplorer.usgs.gov/"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 w-full py-2 px-3 text-xs font-mono text-[#FF8C00] bg-[rgba(255,140,0,0.1)] border border-[rgba(255,140,0,0.3)] rounded hover:bg-[rgba(255,140,0,0.2)]"
      >
        <ExternalLink className="w-3 h-3" />
        USGS EARTHEXPLORER →
      </a>
    </div>
  );
}

// Moon data feed — phase visualization + stats
function MoonDataFeed({ satellite }: { satellite: Satellite }) {
  const [phase, setPhase] = useState({ name: 'Waxing Crescent', illumination: 0.35, angle: 45 });

  useEffect(() => {
    // Compute approximate moon phase from current date
    // Synodic month = 29.53059 days, known new moon: Jan 6, 2000
    const now = new Date();
    const knownNew = new Date(2000, 0, 6, 18, 14, 0); // Jan 6, 2000 18:14 UTC
    const daysSince = (now.getTime() - knownNew.getTime()) / 86400000;
    const synodicMonth = 29.53059;
    const cycleProgress = ((daysSince % synodicMonth) + synodicMonth) % synodicMonth;
    const illum = 0.5 * (1 - Math.cos((cycleProgress / synodicMonth) * 2 * Math.PI));
    const angleVal = (cycleProgress / synodicMonth) * 360;

    let phaseName = 'New Moon';
    if (cycleProgress < 1.85) phaseName = 'New Moon';
    else if (cycleProgress < 7.38) phaseName = 'Waxing Crescent';
    else if (cycleProgress < 9.23) phaseName = 'First Quarter';
    else if (cycleProgress < 14.77) phaseName = 'Waxing Gibbous';
    else if (cycleProgress < 16.61) phaseName = 'Full Moon';
    else if (cycleProgress < 22.15) phaseName = 'Waning Gibbous';
    else if (cycleProgress < 23.99) phaseName = 'Third Quarter';
    else phaseName = 'Waning Crescent';

    setPhase({ name: phaseName, illumination: illum, angle: angleVal });
  }, []);

  // CSS moon phase: circle with shadow overlay
  const isWaxing = phase.angle <= 180;
  const shadowPercent = Math.abs(Math.cos((phase.angle / 180) * Math.PI));

  return (
    <div className="space-y-3">
      {/* Moon phase visual */}
      <div className="bg-[rgba(0,0,0,0.5)] border border-[rgba(200,200,200,0.3)] rounded p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-[#cccccc]">
            <span className="status-dot active" style={{ background: '#ccc', boxShadow: '0 0 6px #aaa' }} />
            <span className="text-xs font-mono">LUNAR_PHASE</span>
          </div>
          <span className="text-xs font-mono text-[#FFB300]">{phase.name.toUpperCase()}</span>
        </div>

        {/* Moon disc */}
        <div className="flex justify-center mb-3">
          <div className="relative w-24 h-24 rounded-full overflow-hidden" style={{ background: '#e8e8d0' }}>
            {/* Shadow side */}
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background: isWaxing
                  ? `linear-gradient(to right, #111 0%, #111 ${shadowPercent * 50}%, transparent ${shadowPercent * 50}%)`
                  : `linear-gradient(to left, #111 0%, #111 ${shadowPercent * 50}%, transparent ${shadowPercent * 50}%)`,
              }}
            />
            {/* Crater textures */}
            <div className="absolute rounded-full bg-[rgba(0,0,0,0.12)]" style={{ width: 18, height: 18, top: 15, left: 40 }} />
            <div className="absolute rounded-full bg-[rgba(0,0,0,0.10)]" style={{ width: 12, height: 12, top: 50, left: 25 }} />
            <div className="absolute rounded-full bg-[rgba(0,0,0,0.08)]" style={{ width: 22, height: 22, top: 55, left: 55 }} />
            <div className="absolute rounded-full bg-[rgba(0,0,0,0.10)]" style={{ width: 8, height: 8, top: 30, left: 65 }} />
          </div>
        </div>

        {/* Moon stats */}
        <div className="grid grid-cols-2 gap-1 text-xs font-mono">
          <span className="text-muted-foreground">ILLUMINATION:</span>
          <span className="text-[#FFB300]">{(phase.illumination * 100).toFixed(1)}%</span>
          <span className="text-muted-foreground">DISTANCE:</span>
          <span className="text-[#cccccc]">{satellite.altitude.toFixed(0)} km</span>
          <span className="text-muted-foreground">PHASE ANGLE:</span>
          <span className="text-[#cccccc]">{phase.angle.toFixed(1)}°</span>
          <span className="text-muted-foreground">POSITION:</span>
          <span className="text-[#cccccc]">{satellite.latitude.toFixed(2)}°, {satellite.longitude.toFixed(2)}°</span>
        </div>
      </div>

      <div className="bg-[rgba(0,0,0,0.5)] border border-[rgba(200,200,200,0.3)] rounded p-3 text-xs">
        <div className="text-[#cccccc] mb-2">LUNAR DATA</div>
        <div className="text-muted-foreground">
          Earth&apos;s natural satellite. Orbital period: 27.3 days. Synodic period: 29.53 days.
        </div>
      </div>
      <a
        href="https://svs.gsfc.nasa.gov/4955"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 w-full py-2 px-3 text-xs font-mono text-[#cccccc] bg-[rgba(200,200,200,0.1)] border border-[rgba(200,200,200,0.3)] rounded hover:bg-[rgba(200,200,200,0.2)]"
      >
        <ExternalLink className="w-3 h-3" />
        NASA MOON PHASE VISUALIZATION →
      </a>
    </div>
  );
}

// Connect button with real data display
function ConnectButton({ satellite }: { satellite: Satellite }) {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const registryEntry = satellite.registryId ? REGISTRY_MAP.get(satellite.registryId) : undefined;

  const handleConnect = () => {
    setConnecting(true);
    const feedType = registryEntry ? 'live' : 'simulated';
    trackDataFeedConnect(satellite.name, feedType, satellite.registryId || satellite.category);
    setTimeout(() => {
      setConnecting(false);
      setConnected(true);
    }, 1500);
  };

  const handleDisconnect = () => {
    setConnected(false);
  };

  // Determine which data feed to show
  const renderDataFeed = () => {
    const id = satellite.registryId || satellite.id;

    switch (id) {
      case 'iss':
        return <ISSDataFeed satellite={satellite} />;
      case 'goes-16':
      case 'goes-18':
        return <GOESDataFeed satellite={satellite} />;
      case 'hubble':
        return <NASAImagesFeed query="hubble" label="HUBBLE IMAGES" />;
      case 'jwst':
        return <NASAImagesFeed query="james webb space telescope" label="JWST IMAGES" />;
      case 'noaa-19':
      case 'ao-91':
        return <SatNOGSFeed satellite={satellite} />;
      case 'landsat-9':
        return <LandsatFeed satellite={satellite} />;
      case 'moon':
        return <MoonDataFeed satellite={satellite} />;
      default:
        // Fallback: show original simulated data streams
        const mediaType = getMediaType(satellite.category);
        return (
          <>
            {mediaType === 'text' && <TextDataStream satellite={satellite} />}
            {mediaType === 'audio' && <AudioStream satellite={satellite} />}
            {mediaType === 'video' && <VideoStream satellite={satellite} />}
          </>
        );
    }
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
          <span>ESTABLISHING LINK...</span>
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
              {registryEntry ? 'LIVE DATA' : 'TELEMETRY'}
            </span>
          </div>

          {/* Real data feed */}
          {renderDataFeed()}

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
            {satellite.type && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">TYPE:</span>
                <span className="text-foreground">{satellite.type}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">CATEGORY:</span>
              <span style={{ color }}>{satellite.category}</span>
            </div>
            {satellite.launchDate && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">LAUNCH:</span>
                <span className="text-foreground">{satellite.launchDate}</span>
              </div>
            )}
            {satellite.country && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">ORIGIN:</span>
                <span className="text-foreground">{satellite.country}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">STATUS:</span>
              <span className={`px-2 py-0.5 rounded text-xs ${satellite.status === 'ACTIVE' ? 'bg-[rgba(0,255,65,0.2)] text-[#00FF41]' : 'bg-[rgba(102,102,102,0.2)] text-[#666]'}`}>
                [{satellite.status}]
              </span>
              {satellite.isReal && (
                <span className="flex items-center gap-1 text-[#00D4FF] text-xs">
                  <span className="status-dot active" style={{ background: '#00D4FF', boxShadow: '0 0 6px #00D4FF' }} />
                  LIVE_TLE
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
