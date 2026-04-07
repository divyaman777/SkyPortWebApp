'use client';

import { useState, useEffect, useMemo } from 'react';
import { NavigationBar } from '@/components/navigation-bar';
import { FilterPanel } from '@/components/filter-panel';
import { SatelliteDetail } from '@/components/satellite-detail';


import { SatelliteTooltip } from '@/components/satellite-tooltip';
import { StatusBar } from '@/components/status-bar';
import { EarthGlobe } from '@/components/earth-globe';
import { 
  Satellite, 
  SatelliteCategory, 
  generateMockSatellites, 
  getCategoryCounts 
} from '@/lib/satellite-data';

export default function Skyport() {
  const [satellites, setSatellites] = useState<Satellite[]>([]);
  const [selectedSatellite, setSelectedSatellite] = useState<Satellite | null>(null);
  const [hoveredSatellite, setHoveredSatellite] = useState<Satellite | null>(null);
  const [hoverPosition, setHoverPosition] = useState({ x: 0, y: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingText, setLoadingText] = useState('');
  
  const [filters, setFilters] = useState<Record<SatelliteCategory, boolean>>({
    WEATHER_SAT: true,
    SPACE_STATION: true,
    AMATEUR_RADIO: true,
    EARTH_OBS: true,
    GPS_GNSS: true,
    COMMS: true,
  });

  // Initialize satellites
  useEffect(() => {
    // Simulate loading with typing animation
    const loadingMessages = [
      'Initializing orbital mechanics...',
      'Fetching TLE data from CELESTRAK...',
      'Calculating satellite positions...',
      'Rendering globe visualization...',
      'System ready.'
    ];

    let messageIndex = 0;
    let charIndex = 0;

    const typingInterval = setInterval(() => {
      if (messageIndex < loadingMessages.length) {
        const currentMessage = loadingMessages[messageIndex];
        if (charIndex < currentMessage.length) {
          setLoadingText(currentMessage.slice(0, charIndex + 1));
          charIndex++;
        } else {
          messageIndex++;
          charIndex = 0;
          if (messageIndex >= loadingMessages.length) {
            setTimeout(() => {
              setIsLoading(false);
              setSatellites(generateMockSatellites());
            }, 500);
            clearInterval(typingInterval);
          }
        }
      }
    }, 30);

    return () => clearInterval(typingInterval);
  }, []);

  // Update satellite positions periodically
  useEffect(() => {
    if (satellites.length === 0) return;

    const interval = setInterval(() => {
      setSatellites(prev => prev.map(sat => ({
        ...sat,
        longitude: ((sat.longitude + (sat.velocity * 0.01)) % 360 + 180) % 360 - 180,
        latitude: sat.latitude + Math.sin(Date.now() / 10000) * 0.01,
      })));
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
  };

  const handleSatelliteClick = (satellite: Satellite) => {
    // Toggle selection - if same satellite clicked, deselect
    if (selectedSatellite?.id === satellite.id) {
      setSelectedSatellite(null);
    } else {
      setSelectedSatellite(satellite);
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
            
            {/* Earth with realistic continents */}
            <div className="absolute inset-6 rounded-full overflow-hidden shadow-[0_0_80px_rgba(0,212,255,0.5)]">
              <svg viewBox="0 0 100 100" className="w-full h-full">
                <defs>
                  {/* Ocean gradient */}
                  <radialGradient id="ocean" cx="30%" cy="30%" r="70%">
                    <stop offset="0%" stopColor="#2980b9" />
                    <stop offset="50%" stopColor="#1a5276" />
                    <stop offset="100%" stopColor="#0c1821" />
                  </radialGradient>
                  {/* Land gradient */}
                  <linearGradient id="land" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#4a7c23" />
                    <stop offset="100%" stopColor="#2d5016" />
                  </linearGradient>
                  {/* Atmosphere glow */}
                  <radialGradient id="atmosphere" cx="50%" cy="50%" r="50%">
                    <stop offset="85%" stopColor="transparent" />
                    <stop offset="100%" stopColor="#00D4FF" stopOpacity="0.3" />
                  </radialGradient>
                </defs>
                
                {/* Ocean base */}
                <circle cx="50" cy="50" r="50" fill="url(#ocean)" />
                
                {/* North America */}
                <path d="M15,25 Q20,20 28,22 L32,18 Q38,15 42,18 L45,22 Q43,28 40,32 L38,38 Q35,42 30,45 L25,43 Q20,40 18,35 L15,30 Q13,28 15,25" fill="url(#land)" opacity="0.85" />
                
                {/* South America */}
                <path d="M28,52 Q32,50 35,52 L37,58 Q38,65 36,72 L33,78 Q30,82 27,80 L25,75 Q23,68 24,62 L26,56 Q27,53 28,52" fill="url(#land)" opacity="0.85" />
                
                {/* Europe */}
                <path d="M48,22 Q52,20 56,22 L58,25 Q60,28 58,32 L54,34 Q50,33 48,30 L47,26 Q47,23 48,22" fill="url(#land)" opacity="0.85" />
                
                {/* Africa */}
                <path d="M50,38 Q55,36 60,38 L63,45 Q65,52 63,60 L60,68 Q55,72 50,70 L48,62 Q46,52 48,45 L50,38" fill="url(#land)" opacity="0.85" />
                
                {/* Asia */}
                <path d="M62,18 Q70,15 78,18 L82,22 Q85,28 83,35 L80,42 Q75,48 68,50 L62,48 Q58,44 60,38 L63,30 Q64,24 62,18" fill="url(#land)" opacity="0.85" />
                
                {/* Australia */}
                <path d="M75,58 Q80,56 84,58 L86,62 Q87,67 85,70 L80,72 Q76,71 74,68 L73,63 Q74,59 75,58" fill="url(#land)" opacity="0.85" />
                
                {/* Antarctica hint */}
                <path d="M30,88 Q40,85 50,86 Q60,85 70,88 L72,92 Q60,95 50,95 Q40,95 28,92 L30,88" fill="#e8e8e8" opacity="0.6" />
                
                {/* Cloud wisps */}
                <ellipse cx="25" cy="30" rx="8" ry="3" fill="white" opacity="0.25" />
                <ellipse cx="65" cy="25" rx="10" ry="3" fill="white" opacity="0.2" />
                <ellipse cx="45" cy="55" rx="7" ry="2" fill="white" opacity="0.2" />
                <ellipse cx="70" cy="45" rx="6" ry="2" fill="white" opacity="0.15" />
                
                {/* Atmosphere overlay */}
                <circle cx="50" cy="50" r="50" fill="url(#atmosphere)" />
                
                {/* Specular highlight */}
                <ellipse cx="35" cy="30" rx="15" ry="12" fill="white" opacity="0.08" />
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
        onSearchChange={setSearchQuery}
        onFilterToggle={() => setFilterPanelOpen(prev => !prev)}
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
