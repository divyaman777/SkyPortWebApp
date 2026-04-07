'use client';

import { useState, useEffect } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';

interface NavigationBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onFilterToggle: () => void;
}

export function NavigationBar({ searchQuery, onSearchChange, onFilterToggle }: NavigationBarProps) {
  const [cursorVisible, setCursorVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setCursorVisible(prev => !prev);
    }, 500);
    return () => clearInterval(interval);
  }, []);

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

          {/* Filter toggle */}
          <button
            onClick={onFilterToggle}
            className="flex items-center gap-2 glass-panel px-3 py-1.5 rounded hover:border-[#00FF41] transition-colors text-sm"
          >
            <SlidersHorizontal className="w-4 h-4 text-[#00FF41]" />
            <span className="hidden sm:inline text-muted-foreground">[--filter]</span>
          </button>
        </div>
      </div>
    </header>
  );
}
