'use client';

import { X, Satellite, Radio, Zap, Rocket } from 'lucide-react';
import {
  SelectedStarlinkSat,
  STARLINK_SPECS,
  NUM_PLANES,
  SATS_PER_PLANE,
} from '@/lib/starlink-data';

interface StarlinkDetailProps {
  satellite: SelectedStarlinkSat | null;
  onClose: () => void;
}

function InfoRow({ label, value, valueClass }: { label: string; value: string | number; valueClass?: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}:</span>
      <span className={valueClass || 'text-foreground font-vt323 text-base'}>{value}</span>
    </div>
  );
}

export function StarlinkDetail({ satellite, onClose }: StarlinkDetailProps) {
  if (!satellite) return null;

  const satNumber = satellite.planeIdx * SATS_PER_PLANE + satellite.satIdx + 1;
  const raanDeg = ((satellite.raan * 180) / Math.PI).toFixed(1);
  const S = STARLINK_SPECS;

  return (
    <aside className="fixed right-0 top-14 bottom-10 w-full md:w-[380px] glass-panel border-l border-[rgba(0,255,65,0.2)] z-50 scan-reveal overflow-hidden flex flex-col bg-[#0a0a0f]">
      {/* Title bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[rgba(0,255,65,0.2)] bg-[rgba(0,0,0,0.3)]">
        <div className="flex items-center gap-2">
          <span className="text-[#00FF41]">{'\u250C\u2500'}</span>
          <span className="text-[#4FC3F7] text-sm">STARLINK_DETAIL</span>
          <span className="text-[#00FF41]">{'\u2500'}</span>
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
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[#00FF41]">&gt;</span>
            <span className="text-foreground font-bold">STARLINK-{satNumber}</span>
          </div>
          <div className="pl-4 space-y-1 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">OPERATOR:</span>
              <span className="text-foreground">{S.operator}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">CONSTELLATION:</span>
              <span className="text-[#4FC3F7]">{S.constellation} {S.shell}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">VARIANT:</span>
              <span className="text-foreground">{S.variant}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">STATUS:</span>
              <span className="px-2 py-0.5 rounded text-xs bg-[rgba(0,255,65,0.2)] text-[#00FF41]">
                [ACTIVE]
              </span>
              <span className="flex items-center gap-1 text-[#4FC3F7] text-xs">
                <span className="status-dot active" style={{ background: '#4FC3F7', boxShadow: '0 0 6px #4FC3F7' }} />
                SIMULATED
              </span>
            </div>
          </div>
        </div>

        {/* Orbital Parameters */}
        <div className="border-t border-[rgba(0,255,65,0.2)] pt-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[#00FF41]">{'\u251C\u2500'}</span>
            <span className="text-muted-foreground text-sm">ORBITAL_PARAMETERS</span>
            <span className="text-[#00FF41] flex-1">{'\u2500'}</span>
          </div>
          <div className="space-y-2 text-sm pl-4">
            <InfoRow label="PLANE" value={`${satellite.planeIdx + 1} / ${NUM_PLANES}`} />
            <InfoRow label="SLOT" value={`${satellite.satIdx + 1} / ${SATS_PER_PLANE}`} />
            <InfoRow label="ALTITUDE" value={`${S.altitudeKm} km`} valueClass="text-[#00FF41] font-vt323 text-base glow-green" />
            <InfoRow label="INCLINATION" value={`${S.inclinationDeg}°`} />
            <InfoRow label="VELOCITY" value={`${S.velocityKmS} km/s`} valueClass="text-[#00D4FF] font-vt323 text-base glow-cyan" />
            <InfoRow label="PERIOD" value={`${S.orbitalPeriodMin} min`} />
            <InfoRow label="RAAN" value={`${raanDeg}°`} />
          </div>
        </div>

        {/* Satellite Specs */}
        <div className="border-t border-[rgba(0,255,65,0.2)] pt-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[#00FF41]">{'\u251C\u2500'}</span>
            <Satellite className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-muted-foreground text-sm">SATELLITE_SPECS</span>
            <span className="text-[#00FF41] flex-1">{'\u2500'}</span>
          </div>
          <div className="space-y-2 text-sm pl-4">
            <InfoRow label="LAUNCH_MASS" value={`${S.launchMassKg} kg`} />
            <InfoRow label="BODY" value={S.bodyDimensions} />
            <InfoRow label="SOLAR_ARRAY" value={`${S.solarArraySpan} span`} />
            <InfoRow label="POWER" value={`${S.powerKw} kW`} valueClass="text-[#FFB300] font-vt323 text-base" />
            <InfoRow label="PROPULSION" value={S.propulsion} />
            <InfoRow label="DESIGN_LIFE" value={`${S.designLifeYears} years`} />
            <InfoRow label="LAUNCH_VEHICLE" value={S.launchVehicle} />
            <InfoRow label="SATS_PER_LAUNCH" value={S.satsPerLaunch} />
          </div>
        </div>

        {/* Communication */}
        <div className="border-t border-[rgba(0,255,65,0.2)] pt-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[#00FF41]">{'\u251C\u2500'}</span>
            <Radio className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-muted-foreground text-sm">COMMUNICATION</span>
            <span className="text-[#00FF41] flex-1">{'\u2500'}</span>
          </div>
          <div className="space-y-2 text-sm pl-4">
            <InfoRow label="LASER_TERMINALS" value={`${S.laserTerminals} (optical ISL)`} valueClass="text-[#4FC3F7] font-vt323 text-base" />
            <InfoRow label="INTRA_PLANE" value={`${S.intraPlaneLinks} links (fore/aft)`} />
            <InfoRow label="CROSS_PLANE" value={`${S.crossPlaneLinks} links (adjacent)`} />
            <InfoRow label="THROUGHPUT" value={`${S.perSatThroughputGbps} Gbps`} valueClass="text-[#00D4FF] font-vt323 text-base glow-cyan" />
            <div className="mt-2 space-y-1">
              <div className="flex items-center gap-2">
                <Zap className="w-3 h-3 text-[#FFB300]" />
                <span className="text-muted-foreground text-xs">USER:</span>
                <span className="text-foreground text-xs">{S.userBand}</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="w-3 h-3 text-[#FFB300]" />
                <span className="text-muted-foreground text-xs">GATEWAY:</span>
                <span className="text-foreground text-xs">{S.gatewayBand}</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="w-3 h-3 text-[#FFB300]" />
                <span className="text-muted-foreground text-xs">BACKHAUL:</span>
                <span className="text-foreground text-xs">{S.eBand}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Constellation Overview */}
        <div className="border-t border-[rgba(0,255,65,0.2)] pt-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[#00FF41]">{'\u251C\u2500'}</span>
            <Rocket className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-muted-foreground text-sm">CONSTELLATION</span>
            <span className="text-[#00FF41] flex-1">{'\u2500'}</span>
          </div>
          <div className="space-y-2 text-sm pl-4">
            <InfoRow label="ON_ORBIT" value={`${S.totalOnOrbit} operational`} valueClass="text-[#00FF41] font-vt323 text-base glow-green" />
            <InfoRow label="TOTAL_LAUNCHED" value={S.totalLaunched} />
            <InfoRow label="SHELL_1" value={`${S.simulatedCount} satellites`} />
            <InfoRow label="COVERAGE" value={S.coverage} />
            <InfoRow label="SUBSCRIBERS" value={S.subscribers} />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-[rgba(0,255,65,0.2)] p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[#00FF41]">{'\u2514\u2500'}</span>
          <span className="text-[#00FF41] flex-1">{'\u2500'}</span>
        </div>
        <p className="text-[10px] text-muted-foreground/60 text-center">
          Data: FCC filings, SpaceX public records, ITU filings
        </p>
      </div>
    </aside>
  );
}
