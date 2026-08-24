'use client';

import { useState, useEffect, useRef } from 'react';
import { Eye, Rocket, Calendar, Bell, BellRing } from 'lucide-react';
import { fetchUpcomingLaunches, formatCountdown } from '@/lib/space-events';
import { fetchKpIndex, kpColor } from '@/lib/space-weather';
import { pushSupported, alertsEnabled, enablePassAlerts, disablePassAlerts } from '@/lib/push-alerts';

interface StatusBarProps {
  overheadCount: number;
  onSupportClick?: () => void;
  onViewListClick?: () => void;
  onEventsClick?: () => void;
}

// Live "NEXT LAUNCH T-xx" chip — Launch Library 2, cached 30 min
function NextLaunchChip({ onClick }: { onClick?: () => void }) {
  const [launch, setLaunch] = useState<{ name: string; net: string } | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchUpcomingLaunches().then(list => {
      const next = list.find(l => new Date(l.net).getTime() > Date.now());
      if (!cancelled && next) setLaunch({ name: next.name, net: next.net });
    });
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  if (!launch) return null;

  return (
    <button
      onClick={onClick}
      title={launch.name}
      className="hidden md:flex items-center gap-1.5 px-2 py-1 glass-panel rounded hover:bg-[rgba(0,255,65,0.1)] transition-colors flex-shrink-0 font-mono"
    >
      <Calendar className="w-3 h-3 text-[#00FF41]" />
      <span className="text-muted-foreground text-[10px]">LAUNCH</span>
      <span className="text-[#00FF41] font-vt323 text-sm">{formatCountdown(launch.net)}</span>
    </button>
  );
}

// "ISS overhead" push alerts toggle — backed by SkyPortService on AWS
function AlertsChip() {
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSupported(pushSupported());
    setEnabled(alertsEnabled());
  }, []);

  if (!supported) return null;

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (enabled) {
        await disablePassAlerts();
        setEnabled(false);
      } else {
        const error = await enablePassAlerts();
        if (error) {
          window.alert(`[SKYPORT] ${error}`);
        } else {
          setEnabled(true);
        }
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={toggle}
      disabled={busy}
      title={enabled ? 'ISS pass alerts ON — click to disable' : 'Get notified ~10 min before the ISS passes over you'}
      className={`hidden md:flex items-center gap-1.5 px-2 py-1 glass-panel rounded transition-colors flex-shrink-0 font-mono ${
        enabled ? 'border-[rgba(0,255,65,0.5)]' : 'hover:bg-[rgba(0,255,65,0.1)]'
      } ${busy ? 'opacity-50' : ''}`}
    >
      {enabled
        ? <BellRing className="w-3 h-3 text-[#00FF41]" />
        : <Bell className="w-3 h-3 text-muted-foreground" />}
      <span className={`text-[10px] ${enabled ? 'text-[#00FF41]' : 'text-muted-foreground'}`}>
        {enabled ? 'ALERTS ON' : 'ALERTS'}
      </span>
    </button>
  );
}

// Live geomagnetic Kp index — NOAA SWPC, cached 15 min
function KpChip() {
  const [kp, setKp] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchKpIndex().then(r => { if (!cancelled && r) setKp(r.kp); });
    return () => { cancelled = true; };
  }, []);

  if (kp === null) return null;

  return (
    <div
      className="hidden lg:flex items-center gap-1.5 px-2 py-1 glass-panel rounded flex-shrink-0 font-mono"
      title={`Planetary Kp index (NOAA SWPC). ${kp >= 5 ? 'Geomagnetic storm — aurora likely!' : kp >= 4 ? 'Active conditions' : 'Quiet conditions'}`}
    >
      <span className="text-muted-foreground text-[10px]">KP</span>
      <span className="font-vt323 text-sm" style={{ color: kpColor(kp) }}>{kp.toFixed(1)}</span>
    </div>
  );
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

export function StatusBar({ overheadCount, onSupportClick, onViewListClick, onEventsClick }: StatusBarProps) {
  const [cursorVisible, setCursorVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setCursorVisible(prev => !prev);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-50 h-10 glass-panel border-t border-[rgba(0,255,65,0.2)]">
      <div className="flex items-center justify-between h-full px-2 sm:px-4 gap-2">
        {/* Left - Data sources */}
        <div className="hidden sm:flex items-center gap-2 text-xs overflow-hidden min-w-0">
          <span className="text-[#00FF41] flex-shrink-0">&gt;</span>
          <span className="text-muted-foreground hidden md:inline">data:</span>
          <a href="https://celestrak.org" target="_blank" rel="noopener noreferrer" className="text-[#00D4FF] hover:text-[#00FF41] transition-colors whitespace-nowrap">Celestrak</a>
          <span className="text-muted-foreground hidden md:inline">·</span>
          <span className="text-muted-foreground hidden md:inline whitespace-nowrap">Open Notify</span>
          <span className="text-muted-foreground hidden lg:inline">·</span>
          <span className="text-muted-foreground hidden lg:inline">NOAA</span>
          <span className="text-muted-foreground hidden lg:inline">·</span>
          <span className="text-muted-foreground hidden lg:inline">NASA</span>
          <span className="text-muted-foreground flex-shrink-0">|</span>
          <span className="text-[#00FF41] flex-shrink-0">LIVE</span>
          <span className={`text-[#00FF41] flex-shrink-0 ${cursorVisible ? 'opacity-100' : 'opacity-0'}`}>_</span>
        </div>

        {/* Mobile-only: just LIVE indicator on left */}
        <div className="flex sm:hidden items-center gap-1.5 text-xs flex-shrink-0">
          <span className="text-[#00FF41]">&gt;</span>
          <span className="text-[#00FF41]">LIVE</span>
          <span className={`text-[#00FF41] ${cursorVisible ? 'opacity-100' : 'opacity-0'}`}>_</span>
        </div>

        {/* Center - Mini world map */}
        <div className="hidden lg:block">
          <MiniWorldMap />
        </div>

        {/* Right - Live chips + overhead count */}
        <div className="flex items-center gap-1.5 sm:gap-3 text-xs min-w-0">
          <NextLaunchChip onClick={onEventsClick} />
          <KpChip />
          <AlertsChip />
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            <span className="text-muted-foreground hidden sm:inline">overhead_now:</span>
            <span className="text-[#00FF41] font-vt323 text-base glow-green">{overheadCount}</span>
            <span className="text-muted-foreground hidden sm:inline">objects</span>
          </div>
          <button
            onClick={onViewListClick}
            className="hidden md:flex items-center gap-2 px-2 py-1 glass-panel rounded hover:bg-[rgba(0,255,65,0.1)] transition-colors flex-shrink-0"
          >
            <Eye className="w-3 h-3 text-[#00D4FF]" />
            <span className="text-foreground">[VIEW_LIST]</span>
          </button>
          <button
            onClick={onSupportClick}
            className="group flex items-center gap-1.5 px-2 py-1 glass-panel rounded hover:border-[#FFB300] transition-all duration-200 flex-shrink-0"
            title="Fuel the mission"
          >
            <Rocket className="w-3 h-3 text-[#FFB300]" />
            <span className="text-muted-foreground group-hover:text-[#FFB300] transition-colors hidden sm:inline">[</span>
            <span className="text-[#FFB300] group-hover:glow-amber transition-all hidden sm:inline">FUEL_MISSION</span>
            <span className="text-muted-foreground group-hover:text-[#FFB300] transition-colors hidden sm:inline">]</span>
            <span className="text-[#FFB300] sm:hidden">FUEL</span>
          </button>
        </div>
      </div>
    </footer>
  );
}
