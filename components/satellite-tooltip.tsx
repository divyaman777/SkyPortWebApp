'use client';

import { Satellite, categoryColors } from '@/lib/satellite-data';

interface SatelliteTooltipProps {
  satellite: Satellite | null;
  x: number;
  y: number;
}

export function SatelliteTooltip({ satellite, x, y }: SatelliteTooltipProps) {
  if (!satellite) return null;

  const color = categoryColors[satellite.category];

  return (
    <div 
      className="fixed z-[100] glass-panel p-2 rounded text-xs pointer-events-none scan-reveal"
      style={{ 
        left: x + 15, 
        top: y + 15,
        borderColor: color,
      }}
    >
      <div className="space-y-1 min-w-[140px]">
        <div className="flex items-center gap-2 border-b border-[rgba(0,255,65,0.2)] pb-1 mb-1">
          <span className="text-[#00FF41]">┌─</span>
          <span className="flex-1" />
          <span className="text-[#00FF41]">─┐</span>
        </div>
        
        <div className="font-bold" style={{ color }}>
          {satellite.name}
        </div>
        
        <div className="flex gap-2">
          <span className="text-muted-foreground">CAT:</span>
          <span className="text-foreground">{satellite.category}</span>
        </div>
        
        <div className="flex gap-2">
          <span className="text-muted-foreground">ALT:</span>
          <span className="text-[#00FF41] font-vt323">{satellite.altitude.toFixed(0)} km</span>
        </div>
        
        <div className="flex gap-2">
          <span className="text-muted-foreground">SPD:</span>
          <span className="text-[#00D4FF] font-vt323">{satellite.velocity.toFixed(2)} km/s</span>
        </div>

        <div className="flex items-center gap-2 border-t border-[rgba(0,255,65,0.2)] pt-1 mt-1">
          <span className="text-[#00FF41]">└─</span>
          <span className="flex-1" />
          <span className="text-[#00FF41]">─┘</span>
        </div>
      </div>
    </div>
  );
}
