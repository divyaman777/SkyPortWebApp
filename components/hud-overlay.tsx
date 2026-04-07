'use client';

import { useState, useEffect } from 'react';

interface HUDOverlayProps {
  satelliteCount: number;
  lastSync: number; // seconds ago
}

function formatTimeSince(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}:00`;
}

export function HUDOverlay({ satelliteCount, lastSync }: HUDOverlayProps) {
  const [time, setTime] = useState(new Date());
  const [syncTime, setSyncTime] = useState(lastSync);

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date());
      setSyncTime(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const utcTime = time.toISOString().slice(11, 19);
  const date = time.toISOString().slice(0, 10);

  return (
    <>
      {/* Top-left HUD */}
      <div className="fixed top-20 left-4 z-30 glass-panel p-3 rounded text-xs space-y-1 max-w-[200px]">
        <div className="text-muted-foreground">
          <span className="text-[#00FF41]">//</span> SYSTEM STATUS
        </div>
        <div className="flex gap-2">
          <span className="text-[#00FF41]">&gt;</span>
          <span className="text-muted-foreground">SATELLITES_TRACKED:</span>
          <span className="text-[#00FF41] font-vt323 text-sm glow-green">{satelliteCount}</span>
        </div>
        <div className="flex gap-2">
          <span className="text-[#00FF41]">&gt;</span>
          <span className="text-muted-foreground">DATA_SOURCE:</span>
          <span className="text-[#00D4FF]">CELESTRAK_TLE</span>
        </div>
        <div className="flex gap-2">
          <span className="text-[#00FF41]">&gt;</span>
          <span className="text-muted-foreground">LAST_SYNC:</span>
          <span className="text-foreground font-vt323">{formatTimeSince(syncTime)} ago</span>
        </div>
        <div className="flex gap-2">
          <span className="text-[#00FF41]">&gt;</span>
          <span className="text-muted-foreground">CONNECTION:</span>
          <span className="text-[#00FF41]">[SECURE]</span>
        </div>
      </div>

      {/* Top-right HUD */}
      <div className="fixed top-20 right-4 z-30 glass-panel-cyan p-3 rounded text-xs text-right max-w-[180px]">
        <div className="flex items-center justify-end gap-2 mb-1">
          <span className="text-[#00D4FF] font-vt323 text-lg glow-cyan">UTC {utcTime}</span>
          <span className="status-dot active" />
        </div>
        <div className="text-muted-foreground">DATE: {date}</div>
        <div className="text-muted-foreground mt-1">
          OBSERVER: <span className="text-[#FFB300]">[LOCATION_PENDING]</span>
        </div>
      </div>
    </>
  );
}
