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
        
        <div className="glass-panel p-8 rounded max-w-md w-full mx-4 z-10">
          <div className="space-y-4">
            {/* Logo */}
            <div className="text-center mb-8">
              <span className="text-3xl font-bold tracking-tight">
                <span className="text-[#00FF41] glow-green">ORBIT</span>
                <span className="text-[#00D4FF] glow-cyan">_WATCH</span>
              </span>
              <div className="text-muted-foreground text-sm mt-2">v2.1</div>
            </div>

            {/* Terminal box */}
            <div className="bg-[rgba(0,0,0,0.5)] p-4 rounded border border-[rgba(0,255,65,0.3)]">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[#00FF41]">&gt;</span>
                <span className="text-muted-foreground text-sm">SYSTEM_INIT</span>
              </div>
              <div className="text-[#00FF41] text-sm font-vt323 h-6">
                {loadingText}
                <span className="cursor-blink ml-1">▮</span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-1 bg-[rgba(0,255,65,0.2)] rounded overflow-hidden">
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
