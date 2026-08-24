'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { NavigationBar } from '@/components/navigation-bar';
import { FilterPanel } from '@/components/filter-panel';
import { SatelliteDetail } from '@/components/satellite-detail';
import { ArtemisDetail } from '@/components/artemis-detail';
import { StarlinkDetail } from '@/components/starlink-detail';
import { type SelectedStarlinkSat } from '@/lib/starlink-data';

import { SatelliteTooltip } from '@/components/satellite-tooltip';
import { StatusBar } from '@/components/status-bar';
import { SpaceEventsPanel } from '@/components/space-events-panel';
import { EarthGlobe } from '@/components/earth-globe';
import { Coffee, Heart, X } from 'lucide-react';
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
} from '@/lib/satellite-engine';
import { SATELLITE_REGISTRY } from '@/lib/satellite-registry';
import { getSimDate } from '@/lib/sim-clock';
import { getObserverLocation, isSatelliteInView, type ObserverLocation } from '@/lib/observer-location';

export default function Skyport() {
  const [satellites, setSatellites] = useState<Satellite[]>([]);
  const [selectedSatellite, setSelectedSatellite] = useState<Satellite | null>(null);
  const [hoveredSatellite, setHoveredSatellite] = useState<Satellite | null>(null);
  const [hoverPosition, setHoverPosition] = useState({ x: 0, y: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [eventsPanelOpen, setEventsPanelOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingText, setLoadingText] = useState('');
  const [bootLog, setBootLog] = useState<string[]>([]);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [utcNow, setUtcNow] = useState('');

  // Live UTC clock for the boot screen's telemetry readout
  useEffect(() => {
    if (!isLoading) return;
    const tick = () => setUtcNow(new Date().toISOString().slice(0, 19).replace('T', ' '));
    tick();
    const interval = setInterval(tick, 500);
    return () => clearInterval(interval);
  }, [isLoading]);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [activeSimulations, setActiveSimulations] = useState<string[]>([]);
  const [simElapsedHours, setSimElapsedHours] = useState(0);
  const [showArtemisDetail, setShowArtemisDetail] = useState(false);
  const [isArtemisPlayback, setIsArtemisPlayback] = useState(false);
  const [selectedStarlink, setSelectedStarlink] = useState<SelectedStarlinkSat | null>(null);
  const engineReady = useRef(false);
  const observerRef = useRef<ObserverLocation | null>(null);

  // Observer location (IP-based, shared with the 3D scene) for the overhead count
  useEffect(() => {
    let cancelled = false;
    getObserverLocation().then(loc => {
      if (!cancelled) observerRef.current = loc;
    });
    return () => { cancelled = true; };
  }, []);

  const isArtemisActive = activeSimulations.includes('artemis-ii');
  const isStarlinkActive = activeSimulations.includes('starlink');

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
      'Establishing uplink to CELESTRAK...',
      'Acquiring TLE ephemeris sets...',
      'Propagating SGP4 orbital states...',
      'Syncing lunar ephemeris...',
      'Rendering globe visualization...',
      'All systems nominal.'
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
          // Line complete — move it into the boot log, start the next one
          setBootLog(prev => [...prev, currentMessage]);
          setLoadingText('');
          messageIndex++;
          charIndex = 0;
          if (messageIndex >= loadingMessages.length) {
            clearInterval(typingInterval);
          }
        }
        setLoadingProgress(
          Math.min(100, ((messageIndex + charIndex / currentMessage.length) / loadingMessages.length) * 100)
        );
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
          // Fallback: still show the app, but don't claim live TLE data —
          // positions are nominal values, not propagated
          setTimeout(() => {
            if (!cancelled) {
              buildSatelliteList().then(sats => {
                setSatellites(sats.map(s => ({ ...s, isReal: false })));
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

  // Update satellite positions every second using real TLE propagation.
  // IMPORTANT: propagate at the shared sim time (getSimDate) — the same clock
  // the 3D scene uses — so the panel data matches the rendered position.
  useEffect(() => {
    if (satellites.length === 0 || !engineReady.current) return;

    const interval = setInterval(() => {
      const simDate = getSimDate();
      const observer = observerRef.current;

      setSatellites(prev => prev.map(sat => {
        if (!sat.isReal || sat.special === 'L2_POINT') return sat;

        const pos = computeSatellitePosition(sat.noradId, simDate);
        if (!pos) return sat;

        return {
          ...sat,
          latitude: pos.latitude,
          longitude: pos.longitude,
          altitude: pos.altitude,
          velocity: pos.velocity,
          inView: observer
            ? isSatelliteInView(observer.lat, observer.lon, pos.latitude, pos.longitude, pos.altitude)
            : false,
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
    setSelectedStarlink(null); // close starlink panel
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

  const handleSimulationToggle = (id: string) => {
    setActiveSimulations(prev => {
      const isActive = prev.includes(id);
      if (isActive) {
        if (id === 'artemis-ii') {
          setShowArtemisDetail(false);
          setIsArtemisPlayback(false);
        }
        return prev.filter(s => s !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const handleOrionClick = () => {
    setSelectedStarlink(null); // close starlink panel
    setShowArtemisDetail(prev => {
      if (!prev) setSelectedSatellite(null); // close satellite panel
      return !prev;
    });
  };

  const handleStarlinkSelect = useCallback((sat: SelectedStarlinkSat | null) => {
    setSelectedStarlink(sat);
    if (sat) {
      setSelectedSatellite(null);
      setShowArtemisDetail(false);
    }
  }, []);

  const handleSimElapsedUpdate = useCallback((hours: number) => {
    setSimElapsedHours(hours);
  }, []);

  // Loading screen
  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-[#05070d] overflow-hidden">
        <div className="star-field" />
        <div className="scanlines" />

        {/* ── Earth's night limb rising across the bottom of the viewport ── */}
        <div className="absolute inset-x-0 bottom-0 h-[40vh] overflow-hidden pointer-events-none">
          <svg
            className="absolute inset-0 w-full h-full"
            viewBox="0 0 1600 500"
            preserveAspectRatio="xMidYMax slice"
          >
            <defs>
              <filter id="lp-blur-s" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="6" />
              </filter>
              <filter id="lp-blur-l" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="16" />
              </filter>
            </defs>

            {/* Outer atmosphere — soft cyan haze above the limb */}
            <circle cx="800" cy="2140" r="2018" fill="none" stroke="#0fa0c0" strokeOpacity="0.14" strokeWidth="30" filter="url(#lp-blur-l)" />
            {/* Tight glow hugging the limb */}
            <circle cx="800" cy="2140" r="2006" fill="none" stroke="#35d0e0" strokeOpacity="0.32" strokeWidth="10" filter="url(#lp-blur-s)" />

            {/* Planet face — flat near-black (no gradient, no banding) */}
            <circle cx="800" cy="2140" r="2000" fill="#04070c" />

            {/* Light scattering inside the limb — blurred strokes only, so the
                falloff is Gaussian-smooth with no hard boundary */}
            <circle cx="800" cy="2140" r="1990" fill="none" stroke="#1a7f8e" strokeOpacity="0.28" strokeWidth="14" filter="url(#lp-blur-s)" />
            <circle cx="800" cy="2140" r="1972" fill="none" stroke="#125864" strokeOpacity="0.12" strokeWidth="30" filter="url(#lp-blur-l)" />

            {/* The limb itself — one thin brilliant turquoise line */}
            <circle cx="800" cy="2140" r="2000" fill="none" stroke="#8FF0EA" strokeOpacity="0.95" strokeWidth="1.6" />

            {/* Graticules — whisper-fine, fading with depth */}
            {[[1988, 0.14], [1968, 0.1], [1938, 0.07], [1896, 0.05], [1840, 0.035]].map(([r, o], i) => (
              <circle key={`lp-par-${i}`} cx="800" cy="2140" r={r} fill="none" stroke="#40E0D0" strokeOpacity={o} strokeWidth="1" />
            ))}
            {[-24, -18, -12, -6, 0, 6, 12, 18, 24].map(deg => {
              const a = (deg * Math.PI) / 180;
              return (
                <line
                  key={`lp-mer-${deg}`}
                  x1={800 + 2000 * Math.sin(a)}
                  y1={2140 - 2000 * Math.cos(a)}
                  x2={800 + 1500 * Math.sin(a)}
                  y2={2140 - 1500 * Math.cos(a)}
                  stroke="#40E0D0"
                  strokeOpacity="0.05"
                  strokeWidth="1"
                />
              );
            })}

            {/* Ground stations — tiny beacons on the dark surface */}
            {[[-17, 1975, '#00FF41'], [-6, 1952, '#40E0D0'], [4, 1980, '#00D4FF'], [14, 1960, '#00FF41'], [21, 1982, '#40E0D0']].map(([deg, r, c], i) => {
              const a = ((deg as number) * Math.PI) / 180;
              const x = 800 + (r as number) * Math.sin(a);
              const y = 2140 - (r as number) * Math.cos(a);
              return (
                <g key={`lp-gs-${i}`}>
                  <circle cx={x} cy={y} r="2" fill={c as string} opacity="0.8" />
                  <circle cx={x} cy={y} r="6" fill="none" stroke={c as string} strokeOpacity="0.25" strokeWidth="1" />
                </g>
              );
            })}
          </svg>

          {/* Satellites skimming the limb with signal trails */}
          <div
            className="absolute w-1.5 h-1.5 rounded-full bg-[#00FF41]"
            style={{
              top: '20%',
              boxShadow: '0 0 8px #00FF41, 0 0 20px rgba(0,255,65,0.6), -14px 2px 12px rgba(0,255,65,0.25)',
              animation: 'sat-arc 13s linear infinite',
            }}
          />
          <div
            className="absolute w-1 h-1 rounded-full bg-[#00D4FF]"
            style={{
              top: '26%',
              boxShadow: '0 0 6px #00D4FF, 0 0 16px rgba(0,212,255,0.5)',
              animation: 'sat-arc 21s linear infinite',
              animationDelay: '6s',
            }}
          />
        </div>

        {/* ── HUD corner brackets ── */}
        <div className="absolute top-4 left-4 w-10 h-10 border-t border-l border-[rgba(64,224,208,0.45)]" />
        <div className="absolute top-4 right-4 w-10 h-10 border-t border-r border-[rgba(64,224,208,0.45)]" />
        <div className="absolute bottom-4 left-4 w-10 h-10 border-b border-l border-[rgba(64,224,208,0.45)]" />
        <div className="absolute bottom-4 right-4 w-10 h-10 border-b border-r border-[rgba(64,224,208,0.45)]" />

        {/* ── Top-left: station ident ── */}
        <div className="absolute top-7 left-8 font-mono text-[10px] tracking-widest z-10">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00FF41] animate-pulse" />
            <span className="text-[#00FF41]">SKYPORT</span>
            <span className="text-muted-foreground">// MISSION_CONTROL</span>
          </div>
          <div className="text-muted-foreground mt-1 opacity-60">GROUND STATION — BOOT SEQUENCE</div>
        </div>

        {/* ── Top-right: live telemetry readout ── */}
        <div className="absolute top-7 right-8 font-mono text-[10px] text-right space-y-1 z-10 hidden sm:block">
          <div>
            <span className="text-muted-foreground">EPOCH </span>
            <span className="text-[#00D4FF]">{utcNow} UTC</span>
          </div>
          <div>
            <span className="text-muted-foreground">TLE_SRC </span>
            <span className="text-[#00FF41]">CELESTRAK</span>
          </div>
          <div>
            <span className="text-muted-foreground">PROPAGATOR </span>
            <span className="text-foreground">SGP4</span>
          </div>
          <div>
            <span className="text-muted-foreground">DOWNLINK </span>
            <span className="text-[#FFB300]">ACQUIRING…</span>
          </div>
        </div>

        {/* ── Center: wordmark ── */}
        <div className="absolute inset-x-0 top-[24vh] flex flex-col items-center z-10 px-4">
          {/* Logo Text */}
          <div className="text-center mb-5">
            <h1 className="text-6xl md:text-7xl font-bold tracking-[0.08em] mb-4">
              <span className="text-[#00FF41] glow-green">SKY</span>
              <span className="text-[#00D4FF] glow-cyan">PORT</span>
            </h1>
            <p className="text-base md:text-lg text-foreground/90 mb-1">Every satellite above you.</p>
            <p className="text-base md:text-lg text-foreground/90 mb-1.5">Everything they&apos;re sending down.</p>
            <p className="text-[#00FF41] text-lg font-bold glow-green tracking-widest">LIVE.</p>
          </div>

          {/* Subtext */}
          <p className="text-muted-foreground text-xs md:text-sm text-center max-w-md font-mono">
            <span className="text-[#00D4FF]">Weather imagery</span>
            <span className="mx-2 opacity-50">·</span>
            <span className="text-[#FFB300]">NASA feeds</span>
            <span className="mx-2 opacity-50">·</span>
            <span className="text-[#00FF41]">Radio transmissions</span>
          </p>

        </div>

        {/* ── Bottom-left: console boot log ── */}
        <div className="absolute left-8 bottom-12 font-mono text-[11px] z-10 max-w-[70vw]">
          {bootLog.slice(-4).map((line, i) => (
            <div key={`boot-${i}-${line}`} className="text-[#00FF41] opacity-40 leading-relaxed">
              <span className="mr-1.5">✓</span>
              {line}
            </div>
          ))}
          <div className="text-[#00FF41] leading-relaxed" style={{ textShadow: '0 0 8px rgba(0,255,65,0.5)' }}>
            <span className="mr-1.5">›</span>
            {loadingText}
            <span className="cursor-blink ml-0.5">▮</span>
          </div>
        </div>

        {/* ── Bottom-right: progress readout ── */}
        <div className="absolute right-8 bottom-12 font-mono text-right z-10">
          <div className="text-2xl font-vt323 text-[#00FF41] glow-green leading-none">
            {Math.round(loadingProgress)}<span className="text-sm">%</span>
          </div>
          <div className="text-[9px] text-muted-foreground tracking-[0.2em] mt-1">
            {loadingProgress >= 100 ? 'LINK ESTABLISHED' : 'ACQUIRING SIGNAL'}
          </div>
        </div>

        {/* ── Bottom edge: full-width progress bar ── */}
        <div className="absolute inset-x-0 bottom-0 h-[3px] bg-[rgba(0,255,65,0.12)] z-10">
          <div
            className="h-full bg-[#00FF41] transition-all duration-200"
            style={{ width: `${loadingProgress}%`, boxShadow: '0 0 12px rgba(0,255,65,0.8)' }}
          />
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
        onSupportClick={() => setShowSupportModal(true)}
        activeSimulations={activeSimulations}
        onSimulationToggle={handleSimulationToggle}
      />

      {/* Main content area */}
      <main 
        className={`fixed inset-0 pt-14 pb-10 transition-all duration-300 ${
          filterPanelOpen ? 'md:pl-72' : ''
        } ${
          (selectedSatellite || showArtemisDetail || selectedStarlink) ? 'md:pr-[380px]' : ''
        }`}
      >
        {/* 3D Earth Globe */}
        <EarthGlobe
          satellites={filteredSatellites}
          selectedSatellite={selectedSatellite}
          onSatelliteClick={handleSatelliteClick}
          onSatelliteHover={handleSatelliteHover}
          filters={filters}
          isSimulating={isArtemisActive}
          onSimElapsedUpdate={handleSimElapsedUpdate}
          onOrionClick={handleOrionClick}
          isOrionSelected={showArtemisDetail}
          isPlayback={isArtemisPlayback}
          isStarlinkActive={isStarlinkActive}
          onStarlinkSelect={handleStarlinkSelect}
          selectedStarlink={selectedStarlink}
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

      {/* Artemis II Detail Panel */}
      <ArtemisDetail
        isOpen={showArtemisDetail}
        onClose={() => setShowArtemisDetail(false)}
        elapsedHours={simElapsedHours}
        isPlayback={isArtemisPlayback}
        onPlaybackToggle={() => setIsArtemisPlayback(prev => !prev)}
      />

      {/* Starlink Detail Panel */}
      <StarlinkDetail
        satellite={selectedStarlink}
        onClose={() => setSelectedStarlink(null)}
      />

      {/* Hover Tooltip */}
      <SatelliteTooltip
        satellite={hoveredSatellite}
        x={hoverPosition.x}
        y={hoverPosition.y}
        onClick={handleSatelliteClick}
      />

      {/* Status Bar */}
      <StatusBar
        overheadCount={overheadCount}
        onSupportClick={() => setShowSupportModal(true)}
        onViewListClick={() => setFilterPanelOpen(prev => !prev)}
        onEventsClick={() => setEventsPanelOpen(prev => !prev)}
      />

      {/* Space Events Panel — launches, EVAs, conjunctions, live DSN */}
      <SpaceEventsPanel isOpen={eventsPanelOpen} onClose={() => setEventsPanelOpen(false)} />

      {/* Support Modal */}
      {showSupportModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowSupportModal(false)}
          />
          <div className="relative glass-panel border border-[rgba(0,255,65,0.3)] rounded-lg p-6 max-w-md w-full animate-in">
            <button
              onClick={() => setShowSupportModal(false)}
              className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-[rgba(255,180,0,0.15)] flex items-center justify-center">
                <Coffee className="w-5 h-5 text-[#FFB300]" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">
                  <span className="text-[#00FF41]">$</span> fuel_station
                </h3>
                <p className="text-xs text-muted-foreground">keep the mission running</p>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              <p className="text-sm text-muted-foreground leading-relaxed">
                <span className="text-[#00FF41]">&gt;</span> Tracking satellites costs real fuel — server costs, API calls, and late-night debugging sessions add up.
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                <span className="text-[#00D4FF]">&gt;</span> If Skyport helps you explore the skies, consider fueling the mission with a coffee.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-4">
              {[
                { amount: 3, label: 'Espresso' },
                { amount: 5, label: 'Latte' },
                { amount: 10, label: 'Rocket Fuel' },
              ].map(({ amount, label }) => (
                <a
                  key={amount}
                  href="https://buymeachai.ezee.li/divyaman"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center gap-1 p-3 rounded border border-[rgba(0,255,65,0.2)] hover:border-[#FFB300] hover:bg-[rgba(255,180,0,0.1)] transition-all group"
                >
                  <span className="text-lg font-bold text-foreground group-hover:text-[#FFB300] transition-colors">${amount}</span>
                  <span className="text-[10px] text-muted-foreground">{label}</span>
                </a>
              ))}
            </div>

            <a
              href="https://buymeachai.ezee.li/divyaman"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 rounded bg-gradient-to-r from-[#FFB300] to-[#FF8C00] text-black font-bold text-sm hover:opacity-90 transition-opacity"
            >
              <Coffee className="w-4 h-4" />
              Buy Me A Chai
            </a>

            <p className="text-center text-[10px] text-muted-foreground mt-4 flex items-center justify-center gap-1">
              Made with <Heart className="w-3 h-3 text-red-500 fill-red-500" /> for space enthusiasts
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
