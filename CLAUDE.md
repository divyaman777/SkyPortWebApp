# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Skyport (skyport.space) — a browser-based real-time 3D satellite tracker. Static Next.js export (no backend, no API routes), Three.js via React Three Fiber, deployed to GitHub Pages on every push to `main`.

## Commands

Uses npm (a stale `pnpm-lock.yaml` exists; ignore it).

```bash
npm run dev            # dev server at localhost:3000
npm run build          # static export to ./out — this is the deploy artifact
npm run lint           # eslint .
npm run fetch-artemis  # re-fetch Artemis II trajectory from JPL Horizons → public/artemis-live-trajectory.json
npm run build-borders  # re-bake country/state borders from GeoJSON → lib/earth-borders.json
```

There is no test suite. `next.config.mjs` sets `typescript.ignoreBuildErrors: true`, so **a passing build does not mean the types are clean** — run `npx tsc --noEmit` to typecheck.

Generated files `lib/earth-borders.json` and `public/artemis-live-trajectory.json` must never be hand-edited; regenerate them with the scripts above.

## Architecture

### State and rendering split

All app state lives in `app/page.tsx` via `useState` (no state library): satellite list, selection, search, filters, active simulations, support modal. Props are drilled down. `components/earth-globe.tsx` is a thin `next/dynamic` wrapper with `ssr: false` — Three.js cannot be server-rendered; never import `earth-scene.tsx` directly from a server-rendered path.

`components/earth-scene.tsx` (~1600 lines) is the core: the R3F `<Canvas>` with Earth, Moon, orbit zones, grid, presence dots, observer marker, and all satellite 3D models (every spacecraft is hand-built from Three.js primitives in `*Model()` functions — no GLTF imports).

### Coordinate system (the part that's easy to get wrong)

- Satellites are computed in the **ECI inertial frame** and never rotate. The Earth group rotates under them each frame via `earthRef.rotation.y = getGMST(simDate)`. Anything pinned to the ground (borders, grid, observer marker, presence dots) must be a child of the rotating Earth group; anything orbiting must not be.
- ECI → Three.js axis mapping in `eciToThreeJSSat()`: ECI.x → Three.x, ECI.z → Three.y (north pole = up), ECI.y → −Three.z.
- Altitudes are **non-linearly compressed** so LEO/MEO/GEO fit one viewport (`getVisualOrbitRadius()` in `lib/satellite-engine.ts`, duplicated in `earth-scene.tsx` — keep them in sync): Earth radius = 2 units, LEO 2.3–3.5, GEO ~4.5, Moon at 20. Real distances are never used directly for scene positions.
- Simulation time runs at `TIME_SCALE = 30` (30× real time, defined in `earth-scene.tsx`); the Moon additionally uses `MOON_SPEED_MULT = 15` with its own `getMoonSimDate()`.

### Satellite data flow

1. `lib/satellite-registry.ts` defines the tracked satellites (NORAD IDs, category, signals, data feeds). **To add a satellite**: add a registry entry, then a 3D model case in `earth-scene.tsx`. Special cases use the `special` flag (`MOON`, `L2_POINT`, `GEOSTATIONARY`).
2. `lib/satellite-engine.ts` fetches TLEs from CelesTrak (localStorage cache, 1 h TTL), runs SGP4 via satellite.js per frame, and exposes ECI position/orbit-path helpers. JWST has no TLE — placed anti-sunward via astronomy-engine.
3. External data feeds (GOES imagery, NASA images, SatNOGS, Open Notify) are fetched client-side with localStorage caching in `lib/api-cache.ts`; some need the corsproxy.io fallback. Failure states show `[SIGNAL_LOST]` — degrade gracefully, never crash the scene.

### Simulations (opt-in via nav dropdown)

- **Artemis II** (`components/simulations/artemis-ii-simulation.tsx` + `lib/artemis-data.ts`): real JPL Horizons trajectory fetched at build time by `scripts/fetch-artemis-trajectory.mjs`, projected onto a fixed Earth-Moon frame with the Moon at scene (20, 0, 0). Falls back to a parametric Bezier trajectory if the JSON is missing. Has real-time and fast-forward playback modes.
- **Starlink** (`components/simulations/starlink-simulation.tsx` + `lib/starlink-data.ts`): 1,584 satellites, Walker Delta 53:1584/72/45, pure Keplerian propagation (no TLEs). Rendered as a single `InstancedMesh` with custom raycasting; laser links update a shared `Float32Array` per frame. Performance-sensitive — avoid per-satellite React state here.

### Other integrations

- **Firebase Realtime DB** (`lib/presence.ts`): live visitor dots on the globe. Presence at `/presence/{sessionId}`, cleanup via `onDisconnect` + heartbeat.
- **GA4** (`lib/analytics.ts`): typed event helpers (e.g. `trackSatelliteClick`). Use these rather than calling `gtag` directly.
- **UI**: full shadcn/ui set in `components/ui/` (scaffolded; much of it unused). Terminal aesthetic — green-on-black (#00FF41 / #00D4FF / #FFB300 accents), glass panels, scanlines — defined in `app/globals.css`. New UI should match this look.

### Deploy

Push to `main` → GitHub Actions (`.github/workflows/deploy.yml`) → `npm run build` → publish `./out` to GitHub Pages with CNAME skyport.space. Because of `output: 'export'`, nothing server-side will ever run — don't add API routes, server actions, or middleware.
