/**
 * space-events.ts
 *
 * Upcoming launches and space events (spacewalks, dockings, flybys) from
 * Launch Library 2 by The Space Devs — https://thespacedevs.com/llapi
 *
 * Free, no API key, CORS `*` (verified live against skyport.space origin).
 * Rate limit is 15 requests/hour PER CLIENT IP, so each visitor has their
 * own budget — we still cache aggressively (30 min) and make at most two
 * calls per session.
 */

import { cachedFetch } from './api-cache';

const LL2 = 'https://ll.thespacedevs.com/2.3.0';
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes — well within 15 req/hr/IP

export interface SpaceLaunch {
  id: string;
  name: string;          // "Falcon 9 Block 5 | Starlink Group 10-30"
  status: string;        // "Go", "TBC", "Success", ...
  statusName: string;
  net: string;           // ISO launch time
  provider?: string;
  pad?: string;
  image?: string | null;
}

export interface SpaceEvent {
  id: number;
  name: string;          // "US EVA-98"
  type: string;          // "EVA", "Docking", ...
  date: string;          // ISO
  location?: string;
  videoUrl?: string;
  newsUrl?: string;
}

interface LL2LaunchResponse {
  results: {
    id: string;
    name: string;
    status: { abbrev: string; name: string };
    net: string;
    launch_service_provider?: { name: string };
    pad?: { name: string; location?: { name: string } };
    image?: { thumbnail_url?: string } | null;
  }[];
}

interface LL2EventResponse {
  results: {
    id: number;
    name: string;
    type?: { name: string };
    date: string;
    location?: string;
    vid_urls?: { url: string }[];
    info_urls?: { url: string }[];
  }[];
}

export async function fetchUpcomingLaunches(): Promise<SpaceLaunch[]> {
  const data = await cachedFetch<LL2LaunchResponse>(
    `${LL2}/launches/upcoming/?limit=8&mode=list&hide_recent_previous=true`,
    'll2-launches',
    CACHE_TTL,
  );
  if (!data?.results) return [];

  return data.results.map(l => ({
    id: l.id,
    name: l.name,
    status: l.status?.abbrev ?? '—',
    statusName: l.status?.name ?? '',
    net: l.net,
    provider: l.launch_service_provider?.name,
    pad: l.pad?.location?.name ?? l.pad?.name,
    image: l.image?.thumbnail_url ?? null,
  }));
}

export async function fetchUpcomingEvents(): Promise<SpaceEvent[]> {
  const data = await cachedFetch<LL2EventResponse>(
    `${LL2}/events/upcoming/?limit=8`,
    'll2-events',
    CACHE_TTL,
  );
  if (!data?.results) return [];

  return data.results.map(e => ({
    id: e.id,
    name: e.name,
    type: e.type?.name ?? 'Event',
    date: e.date,
    location: e.location,
    videoUrl: e.vid_urls?.[0]?.url,
    newsUrl: e.info_urls?.[0]?.url,
  }));
}

/** Compact T-minus / T-plus string for countdowns, e.g. "T-2d 04:32:11" */
export function formatCountdown(isoDate: string): string {
  const diffMs = new Date(isoDate).getTime() - Date.now();
  const sign = diffMs < 0 ? 'T+' : 'T-';
  const total = Math.floor(Math.abs(diffMs) / 1000);
  const days = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600).toString().padStart(2, '0');
  const m = Math.floor((total % 3600) / 60).toString().padStart(2, '0');
  const s = Math.floor(total % 60).toString().padStart(2, '0');
  return days > 0 ? `${sign}${days}d ${h}:${m}:${s}` : `${sign}${h}:${m}:${s}`;
}
