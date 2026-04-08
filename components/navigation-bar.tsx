'use client';

import { useState, useEffect } from 'react';
import { Search, SlidersHorizontal, Coffee, Heart, X, Orbit, ChevronDown, Check } from 'lucide-react';
import { AVAILABLE_SIMULATIONS } from '@/lib/artemis-data';

interface NavigationBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onFilterToggle: () => void;
  showSupportModal: boolean;
  onSupportModalChange: (show: boolean) => void;
  activeSimulations: string[];
  onToggleSimulation: (simId: string) => void;
}

export function NavigationBar({ searchQuery, onSearchChange, onFilterToggle, showSupportModal, onSupportModalChange, activeSimulations, onToggleSimulation }: NavigationBarProps) {
  const [cursorVisible, setCursorVisible] = useState(true);
  const [supportHovered, setSupportHovered] = useState(false);
  const [simulationsOpen, setSimulationsOpen] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setCursorVisible(prev => !prev);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
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
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Search - compact on mobile */}
          <div className="flex items-center gap-1 sm:gap-2 glass-panel px-2 sm:px-3 py-1.5 rounded">
            <Search className="w-4 h-4 text-[#00FF41] sm:hidden" />
            <span className="text-[#00FF41] text-sm hidden sm:inline">&gt;</span>
            <span className="text-muted-foreground text-sm hidden lg:inline">search:</span>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="[____]"
                className="bg-transparent border-none outline-none text-[#00D4FF] placeholder:text-muted-foreground w-12 sm:w-24 md:w-32 lg:w-40 text-sm"
              />
              {searchQuery === '' && (
                <span className={`absolute right-0 top-0 text-[#00FF41] hidden sm:inline ${cursorVisible ? 'opacity-100' : 'opacity-0'}`}>|</span>
              )}
            </div>
          </div>

          {/* Filter toggle */}
          <button
            onClick={onFilterToggle}
            className="flex items-center gap-1 sm:gap-2 glass-panel px-2 sm:px-3 py-1.5 rounded hover:border-[#00FF41] transition-colors text-sm"
          >
            <SlidersHorizontal className="w-4 h-4 text-[#00FF41]" />
            <span className="hidden md:inline text-muted-foreground">[--filter]</span>
          </button>

          {/* Simulations dropdown */}
          <div className="relative">
            <button
              onClick={() => setSimulationsOpen(!simulationsOpen)}
              className={`flex items-center gap-1 sm:gap-2 glass-panel px-2 sm:px-3 py-1.5 rounded transition-colors text-sm ${
                activeSimulations.length > 0 
                  ? 'border-[#00D4FF] hover:border-[#00D4FF]' 
                  : 'hover:border-[#00D4FF]'
              }`}
            >
              <Orbit className={`w-4 h-4 ${activeSimulations.length > 0 ? 'text-[#00D4FF]' : 'text-[#00D4FF]'}`} />
              <span className="hidden md:inline text-muted-foreground">[--simulate]</span>
              {activeSimulations.length > 0 && (
                <span className="w-4 h-4 rounded-full bg-[#00D4FF] text-black text-[10px] font-bold flex items-center justify-center">
                  {activeSimulations.length}
                </span>
              )}
              <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform hidden sm:block ${simulationsOpen ? 'rotate-180' : ''}`} />
            </button>
            
            {/* Dropdown panel */}
            {simulationsOpen && (
              <>
                {/* Backdrop to close dropdown - transparent but clickable */}
                <div 
                  className="fixed inset-0 z-40 bg-transparent cursor-default"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSimulationsOpen(false);
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                />
                <div className="absolute top-full right-0 mt-2 w-72 sm:w-80 glass-panel border border-[rgba(0,212,255,0.3)] rounded-lg p-2 z-50">
                  <div className="text-xs text-muted-foreground px-2 py-1.5 border-b border-[rgba(0,255,65,0.1)] mb-2 flex items-center justify-between">
                    <span>
                      <span className="text-[#00D4FF]">$</span> select_simulation
                    </span>
                    <span className="text-[9px] text-[#00FF41]">
                      {activeSimulations.length} active
                    </span>
                  </div>
                  
                  {AVAILABLE_SIMULATIONS.map((sim) => {
                    const isActive = activeSimulations.includes(sim.id);
                    return (
                      <button
                        key={sim.id}
                        onClick={() => onToggleSimulation(sim.id)}
                        className={`w-full flex items-center gap-3 px-2 py-2.5 rounded text-left transition-all mb-1 ${
                          isActive 
                            ? 'bg-[rgba(0,212,255,0.15)] border border-[rgba(0,212,255,0.3)]' 
                            : 'hover:bg-[rgba(0,255,65,0.05)] border border-transparent'
                        }`}
                      >
                        <div 
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                            isActive 
                              ? 'bg-[#00D4FF] border-[#00D4FF]' 
                              : 'border-muted-foreground'
                          }`}
                        >
                          {isActive && <Check className="w-3 h-3 text-black" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium" style={{ color: sim.color }}>{sim.name}</span>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                              sim.status === 'ACTIVE' ? 'bg-[rgba(0,255,65,0.2)] text-[#00FF41]' :
                              sim.status === 'PLANNED' ? 'bg-[rgba(0,212,255,0.2)] text-[#00D4FF]' :
                              'bg-[rgba(128,128,128,0.2)] text-muted-foreground'
                            }`}>
                              {sim.status}
                            </span>
                          </div>
                          <p className="text-[10px] text-muted-foreground truncate">{sim.description}</p>
                          <p className="text-[9px] text-muted-foreground/70">{sim.agency}</p>
                        </div>
                      </button>
                    );
                  })}
                  
                  <div className="text-[10px] px-2 pt-2 mt-1 border-t border-[rgba(0,255,65,0.1)]">
                    <span className="text-[#FFB400]">*</span> <span className="text-[#8a8a9a]">More simulations coming soon</span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Support/Fuel button - subtle */}
          <button
            onClick={() => onSupportModalChange(true)}
            onMouseEnter={() => setSupportHovered(true)}
            onMouseLeave={() => setSupportHovered(false)}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded text-sm transition-all duration-300 hover:bg-[rgba(255,180,0,0.1)] border border-transparent hover:border-[rgba(255,180,0,0.3)]"
            title="Keep the satellites running"
          >
            <Coffee className={`w-4 h-4 transition-colors duration-300 ${supportHovered ? 'text-[#FFB400]' : 'text-muted-foreground'}`} />
            <span className={`hidden lg:inline text-xs transition-colors duration-300 ${supportHovered ? 'text-[#FFB400]' : 'text-muted-foreground'}`}>
              fuel_station
            </span>
          </button>
        </div>
      </div>
    </header>

    {/* Support Modal */}
    {showSupportModal && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        {/* Backdrop */}
        <div 
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          onClick={() => onSupportModalChange(false)}
        />
        
        {/* Modal */}
        <div className="relative glass-panel border border-[rgba(0,255,65,0.3)] rounded-lg p-6 max-w-md w-full animate-in fade-in zoom-in-95 duration-200">
          {/* Close button */}
          <button
            onClick={() => onSupportModalChange(false)}
            className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-[rgba(255,180,0,0.15)] flex items-center justify-center">
              <Coffee className="w-5 h-5 text-[#FFB400]" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">
                <span className="text-[#00FF41]">$</span> fuel_station
              </h3>
              <p className="text-xs text-muted-foreground">keep the mission running</p>
            </div>
          </div>

          {/* Message */}
          <div className="space-y-3 mb-6">
            <p className="text-sm text-muted-foreground leading-relaxed">
              <span className="text-[#00FF41]">&gt;</span> Tracking satellites costs real fuel. Server costs, API calls, and late-night debugging sessions add up.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              <span className="text-[#00D4FF]">&gt;</span> If Skyport helps you explore the skies, consider fueling the mission with a coffee.
            </p>
          </div>

          {/* Amount options */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { amount: 3, label: 'Espresso' },
              { amount: 5, label: 'Latte' },
              { amount: 10, label: 'Rocket Fuel' },
            ].map(({ amount, label }) => (
              <a
                key={amount}
                href={`https://buymeacoffee.com/skyport?amount=${amount}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-1 p-3 rounded border border-[rgba(0,255,65,0.2)] hover:border-[#FFB400] hover:bg-[rgba(255,180,0,0.1)] transition-all group"
              >
                <span className="text-lg font-bold text-foreground group-hover:text-[#FFB400] transition-colors">${amount}</span>
                <span className="text-[10px] text-muted-foreground">{label}</span>
              </a>
            ))}
          </div>

          {/* Main CTA */}
          <a
            href="https://buymeacoffee.com/skyport"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3 rounded bg-gradient-to-r from-[#FFB400] to-[#FF8C00] text-black font-bold text-sm hover:opacity-90 transition-opacity"
          >
            <Coffee className="w-4 h-4" />
            Buy me a coffee
          </a>

          {/* Footer note */}
          <p className="text-center text-[10px] text-muted-foreground mt-4 flex items-center justify-center gap-1">
            Made with <Heart className="w-3 h-3 text-red-500 fill-red-500" /> for space enthusiasts
          </p>
        </div>
      </div>
    )}
    </>
  );
}
