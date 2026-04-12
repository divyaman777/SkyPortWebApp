'use client';

import dynamic from 'next/dynamic';
import { Satellite, SatelliteCategory } from '@/lib/satellite-data';
import { type SelectedStarlinkSat } from '@/lib/starlink-data';

interface EarthGlobeProps {
  satellites: Satellite[];
  selectedSatellite: Satellite | null;
  onSatelliteClick: (satellite: Satellite) => void;
  onSatelliteHover: (satellite: Satellite | null, x: number, y: number) => void;
  filters: Record<SatelliteCategory, boolean>;
  isSimulating?: boolean;
  onSimElapsedUpdate?: (hours: number) => void;
  onOrionClick?: () => void;
  isOrionSelected?: boolean;
  isPlayback?: boolean;
  isStarlinkActive?: boolean;
  onStarlinkSelect?: (sat: SelectedStarlinkSat | null) => void;
  selectedStarlink?: SelectedStarlinkSat | null;
}

// Dynamic import with SSR disabled for React Three Fiber
const EarthScene = dynamic(
  () => import('./earth-scene').then(mod => ({ default: mod.EarthScene })),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-[#00FF41] font-mono text-sm">
          <span className="animate-pulse">Initializing 3D renderer...</span>
          <span className="cursor-blink ml-1">|</span>
        </div>
      </div>
    )
  }
);

export function EarthGlobe({
  satellites,
  selectedSatellite,
  onSatelliteClick,
  onSatelliteHover,
  filters,
  isSimulating,
  onSimElapsedUpdate,
  onOrionClick,
  isOrionSelected,
  isPlayback,
  isStarlinkActive,
  onStarlinkSelect,
  selectedStarlink,
}: EarthGlobeProps) {
  return (
    <div className="w-full h-full">
      <EarthScene
        satellites={satellites}
        selectedSatellite={selectedSatellite}
        onSatelliteClick={onSatelliteClick}
        onSatelliteHover={onSatelliteHover}
        filters={filters}
        isSimulating={isSimulating}
        onSimElapsedUpdate={onSimElapsedUpdate}
        onOrionClick={onOrionClick}
        isOrionSelected={isOrionSelected}
        isPlayback={isPlayback}
        isStarlinkActive={isStarlinkActive}
        onStarlinkSelect={onStarlinkSelect}
        selectedStarlink={selectedStarlink}
      />
    </div>
  );
}
