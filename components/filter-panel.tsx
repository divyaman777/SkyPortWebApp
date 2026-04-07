'use client';

import { SatelliteCategory, categoryColors, categoryLabels } from '@/lib/satellite-data';

interface FilterPanelProps {
  isOpen: boolean;
  filters: Record<SatelliteCategory, boolean>;
  categoryCounts: Record<SatelliteCategory, number>;
  onFilterChange: (category: SatelliteCategory, enabled: boolean) => void;
}

const categories: SatelliteCategory[] = [
  'WEATHER_SAT',
  'SPACE_STATION',
  'AMATEUR_RADIO',
  'EARTH_OBS',
  'GPS_GNSS',
  'COMMS',
];

export function FilterPanel({ isOpen, filters, categoryCounts, onFilterChange }: FilterPanelProps) {
  const totalActive = Object.entries(filters)
    .filter(([_, enabled]) => enabled)
    .reduce((sum, [cat]) => sum + (categoryCounts[cat as SatelliteCategory] || 0), 0);

  if (!isOpen) return null;

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:block fixed left-0 top-14 bottom-10 w-72 glass-panel border-r border-[rgba(0,255,65,0.2)] z-40 scan-reveal overflow-hidden">
      <div className="p-4 h-full flex flex-col">
        {/* Title */}
        <div className="text-muted-foreground text-sm mb-4">
          <span className="text-[#00FF41]">/*</span> SATELLITE CATEGORIES <span className="text-[#00FF41]">*/</span>
        </div>

        {/* Filter toggles */}
        <div className="flex-1 space-y-2">
          {categories.map(category => {
            const enabled = filters[category];
            const count = categoryCounts[category] || 0;
            const color = categoryColors[category];
            
            return (
              <button
                key={category}
                onClick={() => onFilterChange(category, !enabled)}
                className="w-full flex items-center gap-3 hover:bg-[rgba(0,255,65,0.05)] py-2 px-2 rounded transition-colors text-left"
              >
                {/* Terminal-style checkbox - fixed width with inline-block for consistent sizing */}
                <span className="text-[#00FF41] font-mono flex-shrink-0 inline-flex items-center">
                  <span>[</span>
                  <span className="w-3 text-center">{enabled ? 'x' : '\u00A0'}</span>
                  <span>]</span>
                </span>
                
                {/* Category indicator dot - fixed width */}
                <span 
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ 
                    backgroundColor: color,
                    boxShadow: enabled ? `0 0 6px ${color}` : 'none',
                    opacity: enabled ? 1 : 0.4
                  }}
                />
                
                {/* Category name - takes remaining space */}
                <span 
                  className={`text-sm flex-1 ${enabled ? 'text-foreground' : 'text-muted-foreground'}`}
                >
                  {categoryLabels[category]}
                </span>

                {/* Count - fixed width */}
                <span 
                  className="text-sm font-mono w-8 text-right flex-shrink-0"
                  style={{ color: enabled ? color : '#666' }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Divider */}
        <div className="border-t border-[rgba(0,255,65,0.2)] my-4" />

        {/* Total */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-[#00D4FF]">TOTAL_OBJECTS:</span>
          <span className="text-[#00FF41] font-vt323 text-lg glow-green">{totalActive}</span>
        </div>

        {/* Legend */}
        <div className="mt-4 pt-4 border-t border-[rgba(0,255,65,0.2)]">
          <div className="text-muted-foreground text-xs mb-2">
            <span className="text-[#00FF41]">//</span> COLOR LEGEND
          </div>
          <div className="grid grid-cols-2 gap-1 text-xs">
            {categories.map(category => (
              <div key={category} className="flex items-center gap-1">
                <span 
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: categoryColors[category] }}
                />
                <span className="text-muted-foreground truncate">
                  {categoryLabels[category].split(' ')[0]}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
    
    {/* Mobile bottom sheet */}
    <aside className="md:hidden fixed left-0 right-0 bottom-10 max-h-[50vh] glass-panel border-t border-[rgba(0,255,65,0.2)] z-40 scan-reveal overflow-auto">
      <div className="p-4">
        {/* Title */}
        <div className="text-muted-foreground text-sm mb-3">
          <span className="text-[#00FF41]">/*</span> FILTERS <span className="text-[#00FF41]">*/</span>
        </div>

        {/* Filter toggles - compact grid */}
        <div className="grid grid-cols-2 gap-2">
          {categories.map(category => {
            const enabled = filters[category];
            const count = categoryCounts[category] || 0;
            const color = categoryColors[category];
            
            return (
              <button
                key={`mobile-${category}`}
                onClick={() => onFilterChange(category, !enabled)}
                className="flex items-center gap-2 p-2 glass-panel rounded text-xs"
              >
                <span className="text-[#00FF41] font-mono flex-shrink-0 inline-flex items-center">
                  <span>[</span>
                  <span className="w-2 text-center">{enabled ? 'x' : '\u00A0'}</span>
                  <span>]</span>
                </span>
                <span 
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ 
                    backgroundColor: color,
                    boxShadow: enabled ? `0 0 6px ${color}` : 'none',
                    opacity: enabled ? 1 : 0.4
                  }}
                />
                <span className={`truncate flex-1 ${enabled ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {categoryLabels[category].split(' ')[0]}
                </span>
                <span className="text-muted-foreground w-6 text-right flex-shrink-0">{count}</span>
              </button>
            );
          })}
        </div>

        {/* Total */}
        <div className="flex items-center justify-between text-sm mt-3 pt-3 border-t border-[rgba(0,255,65,0.2)]">
          <span className="text-[#00D4FF]">TOTAL:</span>
          <span className="text-[#00FF41] font-vt323 text-lg glow-green">{totalActive}</span>
        </div>
      </div>
    </aside>
    </>
  );
}
