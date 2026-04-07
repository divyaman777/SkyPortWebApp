# Skyport — Real Satellite Data Integration Summary

## Satellites Tracked

| Satellite | NORAD ID | Type | Data Source |
|---|---|---|---|
| ISS (ZARYA) | 25544 | Space Station | TLE + Open Notify |
| Hubble Space Telescope | 20580 | Space Telescope | TLE + NASA Images API |
| GOES-16 | 41866 | Weather (Geostationary) | TLE + NOAA NESDIS |
| GOES-18 | 51850 | Weather (Geostationary) | TLE + NOAA NESDIS |
| NOAA-19 | 33591 | Weather (Polar) | TLE + SatNOGS |
| Landsat 9 | 49260 | Earth Observation | TLE + NASA/USGS |
| James Webb Space Telescope | 50463 | Space Telescope (L2) | Fixed L2 position + NASA Images API |
| AO-91 (Fox-1B) | 43017 | Amateur Radio CubeSat | TLE + SatNOGS |
| Moon | N/A | Natural Satellite | astronomy-engine.js |

## APIs Used

### 1. Celestrak TLE Data
- **URL**: `https://celestrak.org/NORAD/elements/gp.php?CATNR={NORAD_ID}&FORMAT=TLE`
- **Data**: Two-Line Element sets for orbital propagation
- **Rate Limits**: No strict limits for individual queries; bulk fetches may be throttled
- **Caching**: localStorage, 1 hour TTL
- **CORS**: Friendly (direct browser requests work)

### 2. Open Notify — ISS Position & Crew
- **Position URL**: `http://api.open-notify.org/iss-now.json`
- **Crew URL**: `http://api.open-notify.org/astros.json`
- **Data**: Current ISS lat/lng, current crew manifest
- **Rate Limits**: ~1 request/second recommended
- **Caching**: Crew cached 1 hour; position not cached (updated every second via TLE)
- **CORS**: Requires proxy (corsproxy.io fallback)

### 3. NOAA NESDIS — GOES Weather Imagery
- **GOES-16 URL**: `https://cdn.star.nesdis.noaa.gov/GOES16/ABI/FD/{BAND}/latest.jpg`
- **GOES-18 URL**: `https://cdn.star.nesdis.noaa.gov/GOES18/ABI/FD/{BAND}/latest.jpg`
- **Bands**: GEOCOLOR, Band 13 (IR), Band 09 (Water Vapor)
- **Data**: Full-disk Earth imagery updated every 10 minutes
- **Rate Limits**: None for public CDN
- **Caching**: 10 minutes (matches update cadence)
- **CORS**: Friendly

### 4. NASA Images API
- **URL**: `https://images-api.nasa.gov/search?q={query}&media_type=image&page_size=5`
- **Data**: Public domain imagery from Hubble and JWST
- **Rate Limits**: 1000 requests/hour
- **Caching**: localStorage, 24 hour TTL
- **CORS**: Friendly

### 5. SatNOGS Network
- **Observations URL**: `https://network.satnogs.org/observations/?satellite__norad_cat_id={NORAD_ID}`
- **Telemetry URL**: `https://db.satnogs.org/api/telemetry/?satellite__norad_cat_id={NORAD_ID}&format=json`
- **Data**: Amateur radio observations, satellite telemetry
- **Rate Limits**: Reasonable use
- **Caching**: 5 minutes for telemetry
- **CORS**: May need proxy for API calls; observation links opened in new tab

### 6. YouTube (NASA ISS Live)
- **URL**: `https://www.youtube.com/embed/xRPjKQtRXR8`
- **Data**: NASA HD Earth-viewing camera live stream
- **Rate Limits**: N/A (embedded player)
- **Caching**: N/A
- **CORS**: N/A (iframe embed)

## Client-Side Libraries

| Library | Purpose |
|---|---|
| `satellite.js` | TLE parsing (twoline2satrec), SGP4 orbital propagation, ECI/geodetic conversion |
| `astronomy-engine` | Moon position (equatorial coordinates), illumination/phase calculation |

## Caching Strategy

All caching uses `localStorage` with timestamps:

| Data Type | Cache Duration | Reason |
|---|---|---|
| TLE data | 1 hour | TLE elements change slowly; NORAD updates ~daily |
| ISS crew | 1 hour | Crew changes are rare events |
| GOES imagery | 10 minutes | Images update every 10 minutes |
| NASA images | 24 hours | Archive images don't change |
| SatNOGS telemetry | 5 minutes | Telemetry updates with each pass |

## Error Handling

- All fetch calls use try/catch with fallback to CORS proxy (`corsproxy.io`)
- Failed fetches show `[SIGNAL_LOST]` status with cached data where available
- TLE fetch failures fall back to cached TLE data in localStorage
- Image load failures show error state with retry button
- Moon position computation failure falls back to animated orbit

## Architecture

```
page.tsx (state management)
  ├── initializeTLEs() → fetches all TLEs from Celestrak on load
  ├── computeAllPositions() → builds initial satellite list
  ├── setInterval(1s) → updates positions via computeSatellitePosition()
  │
  ├── earth-globe.tsx → earth-scene.tsx (Three.js Canvas)
  │   ├── Earth (continent outlines, grid, observer marker)
  │   ├── Moon (position from astronomy-engine)
  │   ├── SatelliteMarker[] (position from real lat/lng via lerp)
  │   ├── OrbitPath (computed from TLE propagation, 90 min ahead)
  │   └── OrbitZones (LEO/MEO/GEO indicator rings)
  │
  ├── satellite-detail.tsx (right panel)
  │   ├── Real orbital parameters (live altitude, velocity, position)
  │   └── ConnectButton → real data feeds per satellite
  │       ├── ISS: YouTube live + crew API + live telemetry
  │       ├── GOES: NOAA full-disk weather imagery (3 bands)
  │       ├── Hubble/JWST: NASA Images API gallery
  │       ├── NOAA-19/AO-91: SatNOGS links + frequencies
  │       └── Landsat: NASA/USGS links
  │
  ├── filter-panel.tsx (category toggles)
  ├── navigation-bar.tsx (search + filter button)
  └── status-bar.tsx (data source attribution)
```

## New Files Created

| File | Purpose |
|---|---|
| `lib/satellite-registry.ts` | Registry of all tracked satellites with metadata and data feed URLs |
| `lib/satellite-engine.ts` | TLE fetching, SGP4 propagation, position computation, pass prediction |
| `lib/api-cache.ts` | localStorage-based cache with TTL for API responses |
| `SUMMARY.md` | This file |
