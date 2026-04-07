'use client';

import { useState, useEffect } from 'react';
import { Search, SlidersHorizontal, Coffee, Heart, X } from 'lucide-react';

interface NavigationBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onFilterToggle: () => void;
  showSupportModal: boolean;
  onSupportModalChange: (show: boolean) => void;
}

export function NavigationBar({ searchQuery, onSearchChange, onFilterToggle, showSupportModal, onSupportModalChange }: NavigationBarProps) {
  const [cursorVisible, setCursorVisible] = useState(true);
  const [supportHovered, setSupportHovered] = useState(false);

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

          {/* Filter toggle */}
          <button
            onClick={onFilterToggle}
            className="flex items-center gap-2 glass-panel px-3 py-1.5 rounded hover:border-[#00FF41] transition-colors text-sm"
          >
            <SlidersHorizontal className="w-4 h-4 text-[#00FF41]" />
            <span className="hidden sm:inline text-muted-foreground">[--filter]</span>
          </button>

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
