'use client';

import { useState, useEffect, useRef } from 'react';
import { Rocket } from 'lucide-react';

interface StatusBarProps {
  overheadCount: number;
  onSupportClick?: () => void;
}

function MiniWorldMap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const width = 120;
    const height = 60;

    // Clear
    ctx.clearRect(0, 0, width, height);

    // Background
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, width, height);

    // Simple world outline
    ctx.strokeStyle = 'rgba(0, 255, 65, 0.3)';
    ctx.lineWidth = 1;

    // Draw simplified continents as rectangles
    ctx.fillStyle = 'rgba(0, 255, 65, 0.15)';
    
    // North America
    ctx.fillRect(15, 15, 25, 20);
    
    // South America
    ctx.fillRect(25, 35, 12, 18);
    
    // Europe
    ctx.fillRect(55, 12, 15, 12);
    
    // Africa
    ctx.fillRect(55, 25, 18, 25);
    
    // Asia
    ctx.fillRect(72, 10, 35, 25);
    
    // Australia
    ctx.fillRect(95, 38, 15, 12);

    // Draw horizon circle
    ctx.strokeStyle = 'rgba(0, 212, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(60, 30, 20, 0, Math.PI * 2);
    ctx.stroke();

    // Observer dot
    ctx.fillStyle = '#00D4FF';
    ctx.beginPath();
    ctx.arc(60, 30, 2, 0, Math.PI * 2);
    ctx.fill();
    
    // Glow
    const gradient = ctx.createRadialGradient(60, 30, 0, 60, 30, 20);
    gradient.addColorStop(0, 'rgba(0, 212, 255, 0.3)');
    gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(60, 30, 20, 0, Math.PI * 2);
    ctx.fill();

  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={120}
      height={60}
      className="rounded border border-[rgba(0,255,65,0.2)]"
    />
  );
}

export function StatusBar({ overheadCount, onSupportClick }: StatusBarProps) {
  const [cursorVisible, setCursorVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setCursorVisible(prev => !prev);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-50 h-10 glass-panel border-t border-[rgba(0,255,65,0.2)]">
      <div className="flex items-center justify-between h-full px-4">
        {/* Left - Data source */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-[#00FF41]">&gt;</span>
          <span className="text-muted-foreground">data_src:</span>
          <a 
            href="https://celestrak.org/SOCRATES" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-[#00D4FF] hover:text-[#00FF41] transition-colors"
          >
            celestrak.org/SOCRATES
          </a>
          <span className="text-muted-foreground">|</span>
          <span className="text-muted-foreground">refresh:</span>
          <span className="text-[#00FF41]">auto/30s</span>
          <span className={`text-[#00FF41] ${cursorVisible ? 'opacity-100' : 'opacity-0'}`}>_</span>
        </div>

        {/* Center - Mini world map */}
        <div className="hidden md:block">
          <MiniWorldMap />
        </div>

        {/* Right - Overhead count and support */}
        <div className="flex items-center gap-2 text-xs">
          <div className="hidden sm:flex items-center gap-2">
            <span className="text-muted-foreground">overhead_now:</span>
            <span className="text-[#00FF41] font-vt323 text-base glow-green">{overheadCount}</span>
            <span className="text-muted-foreground">objects</span>
          </div>
          
          <span className="text-muted-foreground hidden sm:inline">|</span>
          
          {/* Support CTA - terminal style */}
          <button
            onClick={onSupportClick}
            className="group flex items-center gap-1.5 px-2 py-1 glass-panel rounded hover:border-[#FFB300] transition-all duration-200"
          >
            <Rocket className="w-3 h-3 text-[#FFB300]" />
            <span className="text-muted-foreground group-hover:text-[#FFB300] transition-colors">[</span>
            <span className="text-[#FFB300] group-hover:glow-amber transition-all">FUEL_MISSION</span>
            <span className="text-muted-foreground group-hover:text-[#FFB300] transition-colors">]</span>
          </button>
        </div>
      </div>
    </footer>
  );
}
