/**
 * aprs-feed.ts
 *
 * Real APRS packets digipeated through the ISS (RS0ISS), captured by the
 * SkyPortService APRS-IS listener and served from the backend Function URL.
 */

const FEED_URL = 'https://j5wvsg6iwlsdd6w6ynqwntwsle0zcyvx.lambda-url.ap-south-1.on.aws/';

export interface IssPacket {
  ts: number;      // epoch ms when our listener heard it
  source: string;  // ham callsign, e.g. "LU2WBA-10"
  path: string;    // digipeater path, contains RS0ISS/ARISS
  info: string;    // raw APRS info field
}

export async function fetchIssPackets(): Promise<IssPacket[]> {
  try {
    const res = await fetch(FEED_URL);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.packets) ? data.packets : [];
  } catch (err) {
    console.warn('[SKYPORT] ISS packet feed failed:', err);
    return [];
  }
}

export function timeAgo(ts: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
