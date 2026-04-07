/**
 * GA4 event tracking for Skyport.
 * Wraps gtag() with typed helpers for each trackable interaction.
 */

type GtagEvent = {
  event_category?: string;
  event_label?: string;
  [key: string]: string | number | boolean | undefined;
};

function trackEvent(eventName: string, params?: GtagEvent) {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag('event', eventName, params);
  }
}

// ─── Satellite Interactions ─────────────────────────────────

export function trackSatelliteClick(name: string, category: string, orbit: string, registryId?: string) {
  trackEvent('satellite_click', {
    event_category: 'satellite',
    satellite_name: name,
    satellite_category: category,
    orbit_type: orbit,
    registry_id: registryId || 'generic',
  });
}

export function trackMoonClick() {
  trackEvent('moon_click', { event_category: 'celestial' });
}

// ─── Orbit Zone Interactions ────────────────────────────────

export function trackOrbitZoneClick(zone: string) {
  trackEvent('orbit_zone_click', {
    event_category: 'orbit_zone',
    zone_name: zone,
  });
}

// ─── Filter Interactions ────────────────────────────────────

export function trackFilterToggle(category: string, enabled: boolean) {
  trackEvent('filter_toggle', {
    event_category: 'filter',
    filter_category: category,
    filter_enabled: enabled,
  });
}

export function trackFilterPanelToggle(open: boolean) {
  trackEvent('filter_panel_toggle', {
    event_category: 'filter',
    panel_open: open,
  });
}

// ─── Satellite Data Feed Interactions ───────────────────────

export function trackDataFeedConnect(satellite: string, feedType: string, feedLabel: string) {
  trackEvent('data_feed_connect', {
    event_category: 'data_feed',
    satellite_name: satellite,
    feed_type: feedType,
    feed_label: feedLabel,
  });
}

export function trackAudioPlay(satellite: string, frequency?: string) {
  trackEvent('audio_play', {
    event_category: 'audio',
    satellite_name: satellite,
    frequency: frequency || 'unknown',
  });
}

export function trackAudioStop(satellite: string) {
  trackEvent('audio_stop', {
    event_category: 'audio',
    satellite_name: satellite,
  });
}

// ─── Search ─────────────────────────────────────────────────

export function trackSearch(query: string) {
  trackEvent('search', {
    event_category: 'search',
    search_term: query,
  });
}

// ─── YouTube / Video Stream ─────────────────────────────────

export function trackVideoStream(satellite: string, action: 'play' | 'next' | 'fallback') {
  trackEvent('video_stream', {
    event_category: 'video',
    satellite_name: satellite,
    video_action: action,
  });
}
