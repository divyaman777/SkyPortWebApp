'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { NavigationBar } from '@/components/navigation-bar';
import { FilterPanel } from '@/components/filter-panel';
import { SatelliteDetail } from '@/components/satellite-detail';


import { SatelliteTooltip } from '@/components/satellite-tooltip';
import { StatusBar } from '@/components/status-bar';
import { EarthGlobe } from '@/components/earth-globe';
import {
  Satellite,
  SatelliteCategory,
  getCategoryCounts
} from '@/lib/satellite-data';
import { trackSatelliteClick, trackFilterToggle, trackFilterPanelToggle, trackSearch } from '@/lib/analytics';
import {
  initializeTLEs,
  computeSatellitePosition,
  computeAllPositions,
  computeMoonPosition,
} from '@/lib/satellite-engine';
import { SATELLITE_REGISTRY } from '@/lib/satellite-registry';

export default function Skyport() {
  const [satellites, setSatellites] = useState<Satellite[]>([]);
  const [selectedSatellite, setSelectedSatellite] = useState<Satellite | null>(null);
  const [hoveredSatellite, setHoveredSatellite] = useState<Satellite | null>(null);
  const [hoverPosition, setHoverPosition] = useState({ x: 0, y: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingText, setLoadingText] = useState('');
  const engineReady = useRef(false);

  const [filters, setFilters] = useState<Record<SatelliteCategory, boolean>>({
    WEATHER_SAT: true,
    SPACE_STATION: true,
    AMATEUR_RADIO: true,
    EARTH_OBS: true,
    GPS_GNSS: true,
    COMMS: true,
  });

  // Build initial Satellite objects from registry with real positions
  const buildSatelliteList = useCallback(async (): Promise<Satellite[]> => {
    const allPos = await computeAllPositions();
    const sats: Satellite[] = [];

    for (const entry of SATELLITE_REGISTRY) {
      if (entry.special === 'MOON') continue; // Moon handled separately in 3D scene

      const pos = allPos.satellites.find(p => p.id === entry.id);

      sats.push({
        id: entry.id,
        noradId: entry.noradId,
        name: entry.name,
        category: entry.category,
        status: 'ACTIVE',
        inView: false, // Will be computed if geolocation available
        altitude: pos?.altitude ?? entry.nominalAltitude,
        velocity: pos?.velocity ?? 7.5,
        inclination: pos?.inclination ?? 0,
        period: pos?.period ?? 90,
        latitude: pos?.latitude ?? 0,
        longitude: pos?.longitude ?? 0,
        signals: entry.signals,
        isReal: true,
        registryId: entry.id,
        type: entry.type,
        launchDate: entry.launchDate,
        country: entry.country,
        special: entry.special,
      });
    }

    return sats;
  }, []);

  // Initialize satellites with real TLE data
  useEffect(() => {
    const loadingMessages = [
      'Initializing orbital mechanics...',
      'Fetching TLE data from CELESTRAK...',
      'Parsing Two-Line Element sets...',
      'Propagating satellite positions...',
      'Rendering globe visualization...',
      'System ready.'
    ];

    let messageIndex = 0;
    let charIndex = 0;
    let cancelled = false;

    const typingInterval = setInterval(() => {
      if (cancelled) return;
      if (messageIndex < loadingMessages.length) {
        const currentMessage = loadingMessages[messageIndex];
        if (charIndex < currentMessage.length) {
          setLoadingText(currentMessage.slice(0, charIndex + 1));
          charIndex++;
        } else {
          messageIndex++;
          charIndex = 0;
          if (messageIndex >= loadingMessages.length) {
            clearInterval(typingInterval);
          }
        }
      }
    }, 30);

    // Actually fetch TLE data while loading animation plays
    (async () => {
      try {
        await initializeTLEs();
        engineReady.current = true;
        const sats = await buildSatelliteList();
        if (!cancelled) {
          // Wait for typing animation to finish or cut it short
          const waitForAnimation = () => {
            if (messageIndex >= loadingMessages.length || cancelled) {
              setTimeout(() => {
                if (!cancelled) {
                  setSatellites(sats);
                  setIsLoading(false);
                }
              }, 500);
            } else {
              setTimeout(waitForAnimation, 100);
            }
          };
          waitForAnimation();
        }
      } catch (err) {
        console.error('[SKYPORT] Initialization failed:', err);
        if (!cancelled) {
          setLoadingText('[ERROR] Failed to initialize. Retrying...');
          // Fallback: still show the app with whatever data we have
          setTimeout(() => {
            if (!cancelled) {
              buildSatelliteList().then(sats => {
                setSatellites(sats);
                setIsLoading(false);
              });
            }
          }, 2000);
        }
      }
    })();

    return () => {
      cancelled = true;
      clearInterval(typingInterval);
    };
  }, [buildSatelliteList]);

  // Update satellite positions every second using real TLE propagation
  useEffect(() => {
    if (satellites.length === 0 || !engineReady.current) return;

    const interval = setInterval(() => {
      setSatellites(prev => prev.map(sat => {
        if (!sat.isReal || sat.special === 'L2_POINT') return sat;

        const pos = computeSatellitePosition(sat.noradId);
        if (!pos) return sat;

        return {
          ...sat,
          latitude: pos.latitude,
          longitude: pos.longitude,
          altitude: pos.altitude,
          velocity: pos.velocity,
        };
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, [satellites.length]);

  // Filter satellites by search query
  const filteredSatellites = useMemo(() => {
    if (!searchQuery) return satellites;
    const query = searchQuery.toLowerCase();
    return satellites.filter(sat => 
      sat.name.toLowerCase().includes(query) ||
      sat.noradId.toString().includes(query) ||
      sat.category.toLowerCase().includes(query)
    );
  }, [satellites, searchQuery]);

  const categoryCounts = useMemo(() => getCategoryCounts(satellites), [satellites]);
  
  const overheadCount = useMemo(() => 
    filteredSatellites.filter(sat => sat.inView && filters[sat.category]).length,
    [filteredSatellites, filters]
  );


  const handleFilterChange = (category: SatelliteCategory, enabled: boolean) => {
    setFilters(prev => ({ ...prev, [category]: enabled }));
    trackFilterToggle(category, enabled);
  };

  const handleSatelliteClick = (satellite: Satellite) => {
    if (selectedSatellite?.id === satellite.id) {
      setSelectedSatellite(null);
    } else {
      setSelectedSatellite(satellite);
      const orbit = satellite.altitude > 35000 ? 'GEO' : satellite.altitude > 2000 ? 'MEO' : 'LEO';
      trackSatelliteClick(satellite.name, satellite.category, orbit, satellite.registryId);
    }
  };

  const handleSatelliteHover = (satellite: Satellite | null, x: number, y: number) => {
    setHoveredSatellite(satellite);
    setHoverPosition({ x, y });
  };

  // Loading screen
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="star-field" />
        <div className="scanlines" />
        
        <div className="flex flex-col items-center z-10 px-4">
          {/* Animated Earth and Satellite Logo */}
          <div className="relative w-52 h-52 mb-8">
            {/* Outer glow pulse */}
            <div className="absolute inset-0 rounded-full bg-[#00D4FF] opacity-15 blur-xl animate-pulse" />
            
            {/* Earth with Americas view */}
            <div className="absolute inset-6 rounded-full overflow-hidden shadow-[0_0_80px_rgba(0,212,255,0.6)]">
              <svg viewBox="0 0 100 100" className="w-full h-full">
                <defs>
                  {/* Ocean gradient - brighter */}
                  <radialGradient id="ocean" cx="35%" cy="35%" r="65%">
                    <stop offset="0%" stopColor="#3498db" />
                    <stop offset="40%" stopColor="#2980b9" />
                    <stop offset="100%" stopColor="#1a5276" />
                  </radialGradient>
                  {/* Land gradient - brighter green */}
                  <linearGradient id="land" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#5dbb3f" />
                    <stop offset="50%" stopColor="#4a9c2d" />
                    <stop offset="100%" stopColor="#3d7a24" />
                  </linearGradient>
                  {/* Atmosphere glow */}
                  <radialGradient id="atmosphere" cx="50%" cy="50%" r="50%">
                    <stop offset="80%" stopColor="transparent" />
                    <stop offset="100%" stopColor="#00D4FF" stopOpacity="0.4" />
                  </radialGradient>
                </defs>
                
                {/* Ocean base */}
                <circle cx="50" cy="50" r="50" fill="url(#ocean)" />
                
                {/* North America - larger and more visible */}
                <path 
                  d="M20,15 L30,12 L40,10 L50,12 L55,18 L52,25 L55,30 L50,35 L45,32 L42,38 L38,42 L32,48 L28,45 L25,48 L22,45 L18,40 L15,35 L12,28 L15,20 Z" 
                  fill="url(#land)" 
                  stroke="#2d5016" 
                  strokeWidth="0.5"
                />
                {/* Greenland */}
                <path 
                  d="M42,8 L48,6 L52,8 L50,12 L45,11 Z" 
                  fill="url(#land)" 
                  stroke="#2d5016" 
                  strokeWidth="0.3"
                />
                
                {/* Central America */}
                <path 
                  d="M28,48 L32,50 L35,52 L33,55 L30,54 L27,52 Z" 
                  fill="url(#land)" 
                  stroke="#2d5016" 
                  strokeWidth="0.3"
                />
                
                {/* South America - larger and more visible */}
                <path 
                  d="M33,56 L40,54 L48,56 L52,62 L50,70 L45,78 L40,85 L35,88 L30,85 L28,78 L30,70 L28,62 Z" 
                  fill="url(#land)" 
                  stroke="#2d5016" 
                  strokeWidth="0.5"
                />
                
                {/* Cloud formations */}
                <ellipse cx="30" cy="25" rx="12" ry="4" fill="white" opacity="0.3" />
                <ellipse cx="55" cy="40" rx="8" ry="3" fill="white" opacity="0.25" />
                <ellipse cx="38" cy="65" rx="10" ry="3" fill="white" opacity="0.2" />
                
                {/* Atmosphere overlay */}
                <circle cx="50" cy="50" r="50" fill="url(#atmosphere)" />
                
                {/* Specular highlight - brighter */}
                <ellipse cx="32" cy="28" rx="18" ry="14" fill="white" opacity="0.12" />
              </svg>
            </div>
            
            {/* Atmosphere rim light */}
            <div className="absolute inset-5 rounded-full border-2 border-[#00D4FF] opacity-40 blur-[1px]" />
            <div className="absolute inset-4 rounded-full border border-[#00D4FF] opacity-20" />
            
            {/* Primary orbit ring - glowing */}
            <div className="absolute inset-1 rounded-full border-2 border-[#00FF41] opacity-50" 
                 style={{ transform: 'rotateX(70deg)', boxShadow: '0 0 15px rgba(0,255,65,0.4)' }} />
            
            {/* Satellite 1 - Main orbiter (slow) */}
            <div className="absolute inset-1 animate-spin" style={{ animationDuration: '8s', animationTimingFunction: 'linear' }}>
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2">
                <div className="relative">
                  {/* Satellite body */}
                  <div className="w-4 h-3 bg-gradient-to-b from-[#e0e0e0] to-[#a0a0a0] rounded-sm shadow-[0_0_15px_rgba(0,255,65,1)]" />
                  {/* Solar panels */}
                  <div className="absolute top-1/2 -translate-y-1/2 -left-4 w-4 h-1.5 bg-gradient-to-r from-[#00D4FF] to-[#0088aa] shadow-[0_0_8px_rgba(0,212,255,0.8)]" />
                  <div className="absolute top-1/2 -translate-y-1/2 -right-4 w-4 h-1.5 bg-gradient-to-l from-[#00D4FF] to-[#0088aa] shadow-[0_0_8px_rgba(0,212,255,0.8)]" />
                  {/* Signal beam */}
                  <div className="absolute -bottom-3 left-1/2 -translate-x-1/2">
                    <div className="w-1.5 h-1.5 bg-[#00FF41] rounded-full animate-ping shadow-[0_0_10px_#00FF41]" />
                  </div>
                </div>
              </div>
            </div>
            
            {/* Secondary orbit ring */}
            <div className="absolute inset-3 rounded-full border border-dashed border-[#00D4FF] opacity-30" 
                 style={{ transform: 'rotateX(70deg) rotateZ(60deg)' }} />
            
            {/* Satellite 2 - Secondary orbiter (different speed/direction) */}
            <div className="absolute inset-3 animate-spin" style={{ animationDuration: '12s', animationTimingFunction: 'linear', animationDirection: 'reverse' }}>
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1">
                <div className="w-2 h-1.5 bg-gradient-to-b from-[#d0d0d0] to-[#909090] rounded-sm shadow-[0_0_10px_rgba(255,179,0,0.8)]" />
              </div>
            </div>
            
            {/* Tertiary orbit ring - outer */}
            <div className="absolute -inset-2 rounded-full border border-[#FFB300] opacity-20" 
                 style={{ transform: 'rotateX(70deg) rotateZ(-30deg)' }} />
            
            {/* Data stream particles */}
            <div className="absolute inset-0">
              <div className="absolute top-[20%] left-[10%] w-1 h-1 bg-[#00FF41] rounded-full animate-ping opacity-60" style={{ animationDelay: '0s', animationDuration: '2s' }} />
              <div className="absolute top-[70%] right-[15%] w-1 h-1 bg-[#00D4FF] rounded-full animate-ping opacity-60" style={{ animationDelay: '0.5s', animationDuration: '2.5s' }} />
              <div className="absolute bottom-[30%] left-[20%] w-1 h-1 bg-[#FFB300] rounded-full animate-ping opacity-60" style={{ animationDelay: '1s', animationDuration: '2s' }} />
            </div>
          </div>
          
          {/* Logo Text */}
          <div className="text-center mb-6">
            <h1 className="text-5xl font-bold tracking-tight mb-3">
              <span className="text-[#00FF41] glow-green">SKY</span>
              <span className="text-[#00D4FF] glow-cyan">PORT</span>
            </h1>
            <p className="text-lg text-foreground mb-1">Every satellite above you.</p>
            <p className="text-lg text-foreground mb-1">Everything they&apos;re sending down.</p>
            <p className="text-[#00FF41] text-lg font-bold glow-green">Live.</p>
          </div>
          
          {/* Subtext */}
          <p className="text-muted-foreground text-sm text-center max-w-md mb-8">
            Real-time 3D tracking of every broadcasting satellite in orbit.
            <br />
            <span className="text-[#00D4FF]">Weather imagery</span> · <span className="text-[#FFB300]">NASA feeds</span> · <span className="text-[#00FF41]">Radio transmissions</span>
          </p>

          {/* Terminal box */}
          <div className="glass-panel p-4 rounded max-w-sm w-full">
            <div className="bg-[rgba(0,0,0,0.5)] p-3 rounded border border-[rgba(0,255,65,0.3)]">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[#00FF41]">&gt;</span>
                <span className="text-muted-foreground text-xs">SYSTEM_INIT</span>
              </div>
              <div className="text-[#00FF41] text-sm font-mono h-5">
                {loadingText}
                <span className="cursor-blink ml-1">▮</span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-1 bg-[rgba(0,255,65,0.2)] rounded overflow-hidden mt-3">
              <div 
                className="h-full bg-[#00FF41] transition-all duration-300"
                style={{ 
                  width: `${Math.min((loadingText.length / 30) * 100, 100)}%`,
                  boxShadow: '0 0 10px #00FF41'
                }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] overflow-hidden relative">
      {/* Star field background */}
      <div className="star-field" />
      
      {/* Scanlines overlay */}
      <div className="scanlines" />

      {/* Navigation */}
      <NavigationBar 
        searchQuery={searchQuery}
        onSearchChange={(q: string) => {
          setSearchQuery(q);
          if (q.length >= 3) trackSearch(q);
        }}
        onFilterToggle={() => {
          setFilterPanelOpen(prev => {
            trackFilterPanelToggle(!prev);
            return !prev;
          });
        }}
      />

      {/* Main content area */}
      <main 
        className={`fixed inset-0 pt-14 pb-10 transition-all duration-300 ${
          filterPanelOpen ? 'md:pl-72' : ''
        } ${
          selectedSatellite ? 'md:pr-[380px]' : ''
        }`}
      >
        {/* 3D Earth Globe */}
        <EarthGlobe 
          satellites={filteredSatellites}
          selectedSatellite={selectedSatellite}
          onSatelliteClick={handleSatelliteClick}
          onSatelliteHover={handleSatelliteHover}
          filters={filters}
        />
      </main>



      {/* Filter Panel */}
      <FilterPanel 
        isOpen={filterPanelOpen}
        filters={filters}
        categoryCounts={categoryCounts}
        onFilterChange={handleFilterChange}
      />

      {/* Satellite Detail Panel */}
      <SatelliteDetail 
        satellite={selectedSatellite}
        onClose={() => setSelectedSatellite(null)}
      />

      {/* Hover Tooltip */}
      <SatelliteTooltip 
        satellite={hoveredSatellite}
        x={hoverPosition.x}
        y={hoverPosition.y}
      />

      {/* Status Bar */}
      <StatusBar overheadCount={overheadCount} />
    </div>
  );
}
