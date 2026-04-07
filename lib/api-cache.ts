/**
 * Lightweight localStorage cache for API responses.
 */

const CACHE_PREFIX = 'skyport_api_';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export function getCached<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    if (Date.now() - entry.timestamp > entry.ttl) {
      localStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

export function setCache<T>(key: string, data: T, ttlMs: number): void {
  try {
    const entry: CacheEntry<T> = { data, timestamp: Date.now(), ttl: ttlMs };
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
  } catch {
    // Storage full — evict oldest entries
    try {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k?.startsWith(CACHE_PREFIX)) keys.push(k);
      }
      // Remove first 5 oldest cache entries
      keys.slice(0, 5).forEach(k => localStorage.removeItem(k));
      // Retry
      const entry: CacheEntry<T> = { data, timestamp: Date.now(), ttl: ttlMs };
      localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
    } catch {
      // Give up silently
    }
  }
}

/**
 * Fetch with caching and CORS proxy fallback.
 */
export async function cachedFetch<T>(
  url: string,
  cacheKey: string,
  cacheTtlMs: number,
  useCorsProxy: boolean = false,
): Promise<T | null> {
  // Check cache first
  const cached = getCached<T>(cacheKey);
  if (cached) {
    console.log(`[SKYPORT] Cache hit: ${cacheKey}`);
    return cached;
  }

  const urls = useCorsProxy
    ? [url, `https://corsproxy.io/?${encodeURIComponent(url)}`]
    : [url];

  for (const fetchUrl of urls) {
    try {
      const response = await fetch(fetchUrl);
      if (!response.ok) continue;
      const data = await response.json() as T;
      if (cacheTtlMs > 0) {
        setCache(cacheKey, data, cacheTtlMs);
      }
      console.log(`[SKYPORT] Fetched: ${cacheKey} ✓`);
      return data;
    } catch {
      continue;
    }
  }

  console.warn(`[SKYPORT] Fetch failed: ${cacheKey}`);
  return null;
}
