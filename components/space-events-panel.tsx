'use client';

import { useState, useEffect } from 'react';
import { X, Rocket, Calendar, AlertTriangle, RadioTower, ExternalLink } from 'lucide-react';
import { fetchUpcomingLaunches, fetchUpcomingEvents, formatCountdown, type SpaceLaunch, type SpaceEvent } from '@/lib/space-events';
import { fetchTopConjunctions, type Conjunction } from '@/lib/conjunctions';
import { fetchDsnStatus, formatDataRate, type DsnLink } from '@/lib/dsn';
import { trackDataFeedConnect } from '@/lib/analytics';

interface SpaceEventsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

// Ticks every second so all countdowns stay live while the panel is open
function useNowTick(active: boolean) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, [active]);
}

export function SpaceEventsPanel({ isOpen, onClose }: SpaceEventsPanelProps) {
  const [launches, setLaunches] = useState<SpaceLaunch[]>([]);
  const [events, setEvents] = useState<SpaceEvent[]>([]);
  const [conjunctions, setConjunctions] = useState<Conjunction[]>([]);
  const [dsnLinks, setDsnLinks] = useState<DsnLink[]>([]);
  const [loaded, setLoaded] = useState(false);

  useNowTick(isOpen);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    trackDataFeedConnect('SPACE_EVENTS', 'live', 'events-panel');
    fetchUpcomingLaunches().then(d => { if (!cancelled) setLaunches(d); });
    fetchUpcomingEvents().then(d => { if (!cancelled) setEvents(d); });
    fetchTopConjunctions(6).then(d => { if (!cancelled) setConjunctions(d); });
    fetchDsnStatus().then(d => { if (!cancelled) { setDsnLinks(d); setLoaded(true); } });

    // Keep DSN fresh while open
    const dsnInterval = setInterval(() => {
      fetchDsnStatus().then(d => { if (!cancelled) setDsnLinks(d); });
    }, 60000);

    return () => { cancelled = true; clearInterval(dsnInterval); };
  }, [isOpen]);

  if (!isOpen) return null;

  const nextLaunch = launches.find(l => new Date(l.net).getTime() > Date.now());

  return (
    <aside className="fixed top-14 left-0 bottom-10 w-full md:w-[380px] z-40 glass-panel border-r border-[rgba(0,255,65,0.2)] overflow-y-auto scan-reveal">
      <div className="p-4 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#00FF41]" />
            <h2 className="text-sm font-bold text-foreground">SPACE_EVENTS</h2>
            <span className="flex items-center gap-1 text-[8px] bg-[rgba(0,255,65,0.12)] text-[#00FF41] px-1.5 py-0.5 rounded">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00FF41] animate-pulse" />
              LIVE
            </span>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Next launch hero countdown */}
        {nextLaunch && (
          <div className="glass-panel p-3 rounded border-[rgba(0,255,65,0.25)]">
            <div className="text-[9px] text-muted-foreground mb-1 flex items-center gap-1.5">
              <Rocket className="w-3 h-3 text-[#00FF41]" /> NEXT LAUNCH
            </div>
            <div className="text-2xl font-vt323 text-[#00FF41] glow-green">{formatCountdown(nextLaunch.net)}</div>
            <div className="text-[11px] text-foreground mt-1 leading-snug">{nextLaunch.name}</div>
            <div className="text-[9px] text-muted-foreground mt-0.5">
              {nextLaunch.provider}{nextLaunch.pad ? ` · ${nextLaunch.pad}` : ''} · {nextLaunch.status}
            </div>
          </div>
        )}

        {/* Upcoming launches */}
        <section>
          <h3 className="text-[9px] text-muted-foreground mb-2 tracking-widest">UPCOMING LAUNCHES</h3>
          <div className="space-y-1.5">
            {launches.slice(0, 6).map(l => (
              <div key={l.id} className="flex items-start justify-between gap-2 text-[10px] font-mono glass-panel px-2 py-1.5 rounded">
                <div className="min-w-0">
                  <div className="text-foreground truncate">{l.name}</div>
                  <div className="text-muted-foreground text-[9px]">{l.provider}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-[#00D4FF]">{formatCountdown(l.net)}</div>
                  <div className={`text-[9px] ${l.status === 'Go' ? 'text-[#00FF41]' : 'text-muted-foreground'}`}>[{l.status}]</div>
                </div>
              </div>
            ))}
            {loaded && launches.length === 0 && (
              <div className="text-[10px] text-[#FFB300] font-mono">[SIGNAL_LOST] Launch data unavailable</div>
            )}
          </div>
        </section>

        {/* Spacewalks / dockings / mission events */}
        {events.length > 0 && (
          <section>
            <h3 className="text-[9px] text-muted-foreground mb-2 tracking-widest">MISSION EVENTS</h3>
            <div className="space-y-1.5">
              {events.slice(0, 5).map(e => (
                <div key={e.id} className="text-[10px] font-mono glass-panel px-2 py-1.5 rounded">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-foreground truncate">{e.name}</div>
                      <div className="text-[9px]">
                        <span className="text-[#FFB300]">[{e.type.toUpperCase()}]</span>
                      </div>
                    </div>
                    <div className="text-[#00D4FF] flex-shrink-0">{formatCountdown(e.date)}</div>
                  </div>
                  {e.videoUrl && (
                    <a
                      href={e.videoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[9px] text-[#00D4FF] hover:text-[#4DE8FF] mt-1"
                    >
                      <ExternalLink className="w-2.5 h-2.5" /> WATCH
                    </a>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Close approaches — SOCRATES */}
        <section>
          <h3 className="text-[9px] text-muted-foreground mb-2 tracking-widest flex items-center gap-1.5">
            <AlertTriangle className="w-3 h-3 text-[#FFB300]" /> CLOSE APPROACHES — NEXT 7 DAYS
          </h3>
          <div className="space-y-1.5">
            {conjunctions.map((c, i) => (
              <div key={`${c.noradId1}-${c.noradId2}-${i}`} className="text-[10px] font-mono glass-panel px-2 py-1.5 rounded">
                <div className="text-foreground truncate">{c.name1}</div>
                <div className="text-muted-foreground truncate">× {c.name2}</div>
                <div className="flex items-center justify-between mt-0.5 text-[9px]">
                  <span className={c.rangeKm < 0.1 ? 'text-[#FF4444]' : 'text-[#FFB300]'}>
                    {c.rangeKm < 1 ? `${Math.round(c.rangeKm * 1000)} m` : `${c.rangeKm.toFixed(2)} km`}
                    <span className="text-muted-foreground"> @ {c.relSpeedKmS.toFixed(1)} km/s</span>
                  </span>
                  <span className="text-[#00D4FF]">{formatCountdown(c.tca.replace(' ', 'T') + 'Z')}</span>
                </div>
              </div>
            ))}
            {loaded && conjunctions.length === 0 && (
              <div className="text-[10px] text-muted-foreground font-mono">No close approaches loaded</div>
            )}
          </div>
          <div className="text-[8px] text-muted-foreground mt-1.5">Data: CelesTrak SOCRATES Plus · refreshed 3x/day</div>
        </section>

        {/* Deep Space Network — live */}
        <section>
          <h3 className="text-[9px] text-muted-foreground mb-2 tracking-widest flex items-center gap-1.5">
            <RadioTower className="w-3 h-3 text-[#00D4FF]" /> DEEP SPACE NETWORK — LIVE
          </h3>
          <div className="space-y-1">
            {dsnLinks.slice(0, 8).map((l, i) => (
              <div key={`${l.dish}-${l.spacecraftCode}-${i}`} className="flex items-center justify-between text-[10px] font-mono glass-panel px-2 py-1 rounded">
                <span className="text-muted-foreground">
                  {l.station} <span className="text-foreground">{l.dish}</span>
                </span>
                <span className="text-[#00D4FF] truncate mx-2">
                  {l.direction === 'up' ? '↑' : l.direction === 'both' ? '⇅' : '↓'} {l.spacecraft}
                </span>
                <span className="text-[#00FF41] flex-shrink-0">{formatDataRate(l.dataRateBps)}</span>
              </div>
            ))}
            {loaded && dsnLinks.length === 0 && (
              <div className="text-[10px] text-muted-foreground font-mono">No active links right now</div>
            )}
          </div>
          <div className="text-[8px] text-muted-foreground mt-1.5">Data: NASA JPL DSN Now · live antenna status · refreshed 60s</div>
        </section>
      </div>
    </aside>
  );
}
