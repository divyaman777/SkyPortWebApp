'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, SlidersHorizontal, Coffee, Settings2, ChevronUp, ChevronDown, Check } from 'lucide-react';

interface SimulationOption {
  id: string;
  name: string;
  description: string;
  agency: string;
  status: 'ACTIVE' | 'UPCOMING' | 'COMPLETED';
}

const SIMULATIONS: SimulationOption[] = [
  {
    id: 'artemis-ii',
    name: 'Artemis II',
    description: 'NASA crewed lunar flyby mission — LIVE',
    agency: 'NASA',
    status: 'ACTIVE',
  },
];

interface NavigationBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onFilterToggle: () => void;
  onSupportClick: () => void;
  activeSimulations?: string[];
  onSimulationToggle?: (id: string) => void;
}

export function NavigationBar({ searchQuery, onSearchChange, onFilterToggle, onSupportClick, activeSimulations = [], onSimulationToggle }: NavigationBarProps) {
  const [cursorVisible, setCursorVisible] = useState(true);
  const [simDropdownOpen, setSimDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setCursorVisible(prev => !prev);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setSimDropdownOpen(false);
      }
    }
    if (simDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [simDropdownOpen]);

  const activeCount = activeSimulations.length;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 glass-panel border-b border-[rgba(0,255,65,0.2)]">
      <div className="flex items-center justify-between h-full px-4">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <span className="text-xl font-bold tracking-tight">
              <span className="text-[#00FF41] glow-green">SKY</span>
              <span className="text-[#00D4FF] glow-cyan">PORT</span>
            </span>
            <span className="text-[10px] text-muted-foreground tracking-widest hidden sm:block">EVERY SATELLITE ABOVE YOU</span>
          </div>
          <span className={`text-[#00FF41] ${cursorVisible ? 'opacity-100' : 'opacity-0'}`}>▮</span>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="flex items-center gap-2 glass-panel px-3 py-1.5 rounded">
            <span className="text-[#00FF41] text-sm">&gt;</span>
            <span className="text-muted-foreground text-sm hidden sm:inline">search_satellite:</span>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="[____________________]"
                className="bg-transparent border-none outline-none text-[#00D4FF] placeholder:text-muted-foreground w-32 sm:w-48 text-sm"
              />
              {searchQuery === '' && (
                <span className={`absolute right-0 top-0 text-[#00FF41] ${cursorVisible ? 'opacity-100' : 'opacity-0'}`}>|</span>
              )}
            </div>
            <Search className="w-4 h-4 text-muted-foreground" />
          </div>

          {/* Simulate dropdown */}
          <div className="relative group/sim" ref={dropdownRef}>
            <button
              onClick={() => setSimDropdownOpen(prev => !prev)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded transition-all text-sm ${
                activeCount > 0
                  ? 'bg-[rgba(0,212,255,0.1)] border border-[rgba(0,212,255,0.4)]'
                  : 'glass-panel hover:border-[#00D4FF]'
              }`}
            >
              <Settings2 className={`w-4 h-4 ${activeCount > 0 ? 'text-[#00D4FF]' : 'text-muted-foreground'}`} />
              <span className={`hidden sm:inline ${activeCount > 0 ? 'text-[#00D4FF]' : 'text-muted-foreground'}`}>
                [--simulate]
              </span>
              {activeCount > 0 ? (
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#00D4FF] text-[#0a0a0f] text-[10px] font-bold">
                  {activeCount}
                </span>
              ) : (
                <span className="text-[8px] bg-[rgba(0,255,65,0.15)] text-[#00FF41] px-1.5 py-0.5 rounded font-bold animate-pulse">
                  NEW
                </span>
              )}
              {simDropdownOpen
                ? <ChevronUp className="w-3 h-3 text-[#00D4FF]" />
                : <ChevronDown className="w-3 h-3 text-muted-foreground" />
              }
            </button>

            {/* Dropdown panel */}
            {simDropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 glass-panel rounded-lg border border-[rgba(0,255,65,0.25)] overflow-hidden animate-in z-50">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(0,255,65,0.15)]">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-[#00FF41]">$</span>
                    <span className="text-muted-foreground">select_simulation</span>
                  </div>
                  <span className="text-[#00D4FF] text-xs">{activeCount} active</span>
                </div>

                {/* Simulation options */}
                <div className="p-2">
                  {SIMULATIONS.map(sim => {
                    const isActive = activeSimulations.includes(sim.id);
                    return (
                      <button
                        key={sim.id}
                        onClick={() => onSimulationToggle?.(sim.id)}
                        className={`w-full flex items-start gap-3 p-3 rounded-lg transition-all text-left ${
                          isActive
                            ? 'bg-[rgba(0,212,255,0.08)] border border-[rgba(0,212,255,0.3)]'
                            : 'hover:bg-[rgba(255,255,255,0.03)] border border-transparent'
                        }`}
                      >
                        {/* Checkbox */}
                        <div className={`flex-shrink-0 mt-0.5 w-5 h-5 rounded flex items-center justify-center transition-all ${
                          isActive
                            ? 'bg-[#00D4FF]'
                            : 'border border-[rgba(255,255,255,0.2)]'
                        }`}>
                          {isActive && <Check className="w-3 h-3 text-[#0a0a0f]" strokeWidth={3} />}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[#00D4FF] font-bold text-sm">{sim.name}</span>
                            {sim.status === 'ACTIVE' && (
                              <span className="text-[9px] bg-[rgba(0,255,65,0.15)] text-[#00FF41] px-1.5 py-0.5 rounded font-bold">
                                ACTIVE
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{sim.description}</p>
                          <p className="text-[10px] text-muted-foreground/60 mt-0.5">{sim.agency}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Footer */}
                <div className="px-4 py-3 border-t border-[rgba(0,255,65,0.1)]">
                  <p className="text-[11px] text-muted-foreground/60 flex items-center gap-1.5">
                    <span className="text-[#FFB300]">*</span>
                    More simulations coming soon
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Filter toggle */}
          <button
            onClick={onFilterToggle}
            className="flex items-center gap-2 glass-panel px-3 py-1.5 rounded hover:border-[#00FF41] transition-colors text-sm"
          >
            <SlidersHorizontal className="w-4 h-4 text-[#00FF41]" />
            <span className="hidden sm:inline text-muted-foreground">[--filter]</span>
          </button>

          {/* Support — coffee icon */}
          <button
            onClick={onSupportClick}
            className="p-1.5 rounded transition-all duration-200 hover:bg-[rgba(255,180,0,0.15)]"
            title="Fuel the mission"
          >
            <Coffee className="w-4 h-4 text-[#FFB300]" />
          </button>
        </div>
      </div>
    </header>
  );
}
