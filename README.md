```
 ███████╗██╗  ██╗██╗   ██╗██████╗  ██████╗ ██████╗ ████████╗
 ██╔════╝██║ ██╔╝╚██╗ ██╔╝██╔══██╗██╔═══██╗██╔══██╗╚══██╔══╝
 ███████╗█████╔╝  ╚████╔╝ ██████╔╝██║   ██║██████╔╝   ██║
 ╚════██║██╔═██╗   ╚██╔╝  ██╔═══╝ ██║   ██║██╔══██╗   ██║
 ███████║██║  ██╗   ██║   ██║     ╚██████╔╝██║  ██║   ██║
 ╚══════╝╚═╝  ╚═╝   ╚═╝   ╚═╝      ╚═════╝ ╚═╝  ╚═╝   ╚═╝

           >  EVERY SATELLITE ABOVE YOU  <
```

<p align="center">
  <a href="https://skyport.space"><b>skyport.space</b></a> &middot;
  A real-time 3D satellite tracker that shows every broadcasting satellite orbiting Earth,<br/>
  with live NASA data feeds, weather imagery, and the Artemis II lunar mission.
</p>

<p align="center">
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-16-000?style=flat-square&logo=next.js">
  <img alt="React" src="https://img.shields.io/badge/React-19-149eca?style=flat-square&logo=react">
  <img alt="Three.js" src="https://img.shields.io/badge/Three.js-r175-000?style=flat-square&logo=three.js">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.7-3178c6?style=flat-square&logo=typescript">
  <img alt="TailwindCSS" src="https://img.shields.io/badge/Tailwind-4-06b6d4?style=flat-square&logo=tailwindcss">
  <img alt="GitHub Pages" src="https://img.shields.io/badge/hosted%20on-GitHub%20Pages-181717?style=flat-square&logo=github">
</p>

---

## `>` what is this

**Skyport** is a browser-based 3D satellite tracker. Point your camera at the planet, spin it around, and watch every broadcasting satellite move in real time — the ISS circling every 90 minutes, Hubble streaming imagery, GOES weather sats sitting still over the equator, and the crew of Artemis II cruising toward the Moon.

It runs entirely in the browser. No backend, no login, no ads. Just orbital mechanics and a lot of Three.js.

## `>` features

- **Live satellite positions** — SGP4 propagation from real TLE data (updated hourly from CelesTrak)
- **10 hand-modelled 3D spacecraft** — ISS, Hubble, GOES, NOAA, Landsat 9, JWST, Tiangong, AO-91 CubeSat, Orion MPCV, and Starlink v2 Mini — built from primitives in React Three Fiber
- **Live Artemis II tracking** — Real trajectory data straight from NASA's JPL Horizons system
- **Starlink constellation simulation** — 1,584 satellites (Shell 1, Walker Delta 53:1584/72/45) with Keplerian propagation, inter-satellite laser links, clickable detail panels with real specs from FCC filings
- **Data feeds** — GOES weather imagery, ISS audio streams, amateur radio transponder frequencies, live DSN status
- **User presence** — See other visitors as tiny dots on the globe (Firebase Realtime Database)
- **Terminal aesthetic** — Green-on-black, scanlines, VT323 readouts, because everything is better with CRT vibes
- **Runs anywhere** — Static export, no server. Deploys to GitHub Pages in under 30 seconds

## `>` satellites we track

| ID | Name | NORAD | Category | Orbit |
|----|------|-------|----------|-------|
| `iss` | International Space Station | 25544 | SPACE_STATION | LEO 408 km |
| `hubble` | Hubble Space Telescope | 20580 | EARTH_OBS | LEO 547 km |
| `goes-16` | GOES-16 (East) | 41866 | WEATHER_SAT | GEO 35,786 km |
| `goes-18` | GOES-18 (West) | 43226 | WEATHER_SAT | GEO 35,786 km |
| `noaa-19` | NOAA-19 | 33591 | WEATHER_SAT | LEO 870 km |
| `landsat-9` | Landsat 9 | 49260 | EARTH_OBS | LEO 705 km |
| `jwst` | James Webb Space Telescope | — | EARTH_OBS | L2, 1.5M km |
| `ao-91` | AO-91 (RadFxSat) | 43017 | AMATEUR_RADIO | LEO 450 km |
| `tiangong` | Tiangong Space Station | 48274 | SPACE_STATION | LEO 390 km |
| `artemis-ii` | Orion MPCV (Integrity) | 68538 | MISSION | Cislunar trajectory |

| `starlink` | Starlink Shell 1 | — | SIMULATION | LEO 550 km (×1,584) |

Plus the Moon (NASA LROC color map) and 1,584 Starlink satellites with inter-satellite laser links.

## `>` tech stack

| Layer | Tool |
|-------|------|
| Framework | [Next.js 16](https://nextjs.org) (static export, no API routes) |
| 3D | [Three.js](https://threejs.org) via [React Three Fiber](https://r3f.docs.pmnd.rs/) + [drei](https://github.com/pmndrs/drei) |
| Orbital math | [satellite.js](https://github.com/shashwatak/satellite-js) — SGP4 propagator, ECI↔geodetic |
| Astronomy | [astronomy-engine](https://github.com/cosinekitty/astronomy) — Moon/Sun equatorial positions |
| Styling | [Tailwind CSS 4](https://tailwindcss.com) + custom terminal theme |
| Presence | [Firebase Realtime Database](https://firebase.google.com/docs/database) |
| Analytics | Google Analytics 4 via `@next/third-parties/google` |
| Hosting | [GitHub Pages](https://pages.github.com/) |

## `>` how it works

<details>
<summary><b>Orbital mechanics (click to expand)</b></summary>

1. **TLE data** is fetched from CelesTrak and cached in `localStorage` for 1 hour
2. **Simulation time** runs at 30× real-time (`TIME_SCALE = 30`) so the ISS completes an orbit every ~3 minutes
3. Each frame, `satellite.propagate(satrec, simDate)` returns an **ECI position** in km
4. That position is mapped to Three.js coordinates: `ECI.x → Three.x`, `ECI.z → Three.y` (north pole = up), `ECI.y → -Three.z`
5. Orbit radius is **compressed non-linearly** so LEO/MEO/GEO are all visible in the same viewport (LEO at ~2.3 units, GEO at ~4.5, Moon at 20)
6. **Satellites live in the inertial frame** and never rotate — the Earth rotates under them via `getGMST()`

</details>

<details>
<summary><b>Artemis II live tracking (click to expand)</b></summary>

At build time, `scripts/fetch-artemis-trajectory.mjs` queries the JPL Horizons API for:
- Orion MPCV state vectors (`COMMAND='-1024'`)
- Moon state vectors (`COMMAND='301'`)

...at 15-minute intervals across the mission window. The ECI J2000 coordinates are projected onto a **fixed Earth-Moon reference frame** (ê_x = Earth→Moon at flyby, ê_z = orbit normal), scaled so the Moon sits at scene position (20, 0, 0). Pre-TLI elliptical orbits are trimmed, and points near the Moon are clamped to keep the visible trajectory outside the (visually oversized) Moon sphere.

The result is saved as `public/artemis-live-trajectory.json` and loaded at runtime. Orion's current position is interpolated from real mission elapsed time.

</details>

<details>
<summary><b>Starlink constellation simulation (click to expand)</b></summary>

1. **Walker Delta 53:1584/72/45** — 72 orbital planes, 22 sats each, phasing parameter F=45 (from observational data, arxiv 2603.25835)
2. All 1,584 satellites use **Keplerian circular orbit propagation** — mean anomaly + RAAN rotation + inclination tilt, converted from ECI to Three.js coordinates
3. The inter-plane phase offset `(planeIdx × F / totalSats) × 2pi` prevents satellites from colliding at orbital crossing points
4. **InstancedMesh** renders all 1,584 satellites in a single draw call, with custom distance-based raycasting for click/hover
5. **3,168 laser links** (1,584 intra-plane + 1,584 cross-plane) are drawn as `LineDashedMaterial` with positions updated per frame via shared `Float32Array`
6. Satellite specs in the detail panel come from FCC filings (SAT-MOD-20190830-00087) and SpaceX public data

</details>

<details>
<summary><b>Instant border rendering (click to expand)</b></summary>

Country/state borders from [world.geo.json](https://github.com/johan/world.geo.json) + [india-official-geojson](https://github.com/AbhinavSwami28/india-official-geojson) are **pre-baked at build time** by `scripts/build-earth-borders.mjs` into `lib/earth-borders.json`. The file is imported directly — zero runtime fetch, borders render on the same frame as the Earth sphere.

</details>

## `>` local development

```bash
# clone and install
git clone https://github.com/yourusername/skyport.git
cd skyport
npm install

# run dev server
npm run dev
# → http://localhost:3000

# build static export to ./out
npm run build
```

### Data generation scripts

```bash
# Re-fetch Artemis II trajectory from JPL Horizons
npm run fetch-artemis

# Re-bake Earth country/state borders from GeoJSON sources
npm run build-borders
```

## `>` project structure

```
app/
├── layout.tsx              # Root layout — fonts, GA4
├── page.tsx                # State orchestrator (satellites, selection, filters)
└── globals.css             # Terminal theme, glass panels, scanlines

components/
├── earth-scene.tsx         # THE CORE — 3D scene with Earth, Moon, satellites, orbits
├── earth-globe.tsx         # Dynamic (ssr:false) wrapper for earth-scene
├── navigation-bar.tsx      # Top bar — logo, search, simulate dropdown, filters
├── filter-panel.tsx        # Category toggles
├── satellite-detail.tsx    # Right panel — orbital data + feeds
├── artemis-detail.tsx      # Right panel — Artemis II mission telemetry
├── starlink-detail.tsx     # Right panel — Starlink satellite specs (FCC data)
├── status-bar.tsx          # Bottom bar — data sources, overhead count, fuel button
└── simulations/
    ├── artemis-ii-simulation.tsx   # Orion + ghost moon + trajectory rendering
    └── starlink-simulation.tsx     # 1,584 sats + laser links + orbit rings

lib/
├── satellite-engine.ts     # TLE fetching, SGP4, ECI↔Three.js conversion
├── satellite-registry.ts   # 10 satellites with metadata, signals, data feeds
├── artemis-data.ts         # Mission constants, phases, crew, trajectory helpers
├── starlink-data.ts        # Walker Delta constellation config, Keplerian propagation, laser links
├── earth-borders.json      # Pre-baked GeoJSON borders (do not edit)
└── presence.ts             # Firebase Realtime DB user presence

scripts/
├── fetch-artemis-trajectory.mjs  # JPL Horizons → public/artemis-live-trajectory.json
└── build-earth-borders.mjs       # GeoJSON → lib/earth-borders.json

public/
├── moon-texture.jpg              # NASA LROC 2K color map
└── artemis-live-trajectory.json  # Pre-fetched Orion trajectory
```

## `>` deploy

Static export to `./out/`, published via GitHub Actions on every push to `main`:

```yaml
# .github/workflows/deploy.yml
- run: npm install && npm run build
- uses: peaceiris/actions-gh-pages@v3
  with:
    publish_dir: ./out
    cname: skyport.space
```

Because `next.config.mjs` has `output: 'export'`, there are no API routes — everything is static HTML + JS. Perfect for GitHub Pages.

## `>` roadmap

- [x] Live Artemis II tracking with JPL Horizons data
- [x] 10 hand-built 3D spacecraft models
- [x] User presence dots on the globe
- [x] Mobile-responsive layout
- [x] Starlink constellation simulation (1,584 sats, laser links, Walker Delta phasing)
- [ ] Pass prediction for your location
- [ ] Launch countdown integration
- [ ] More missions: Europa Clipper, Psyche, JUICE

## `>` hand-built spacecraft

Every spacecraft in Skyport is **hand-built from Three.js primitives** — no imported GLTF files, no external models. Each one is a composition of spheres, cylinders, boxes, and cones arranged to match the real thing as closely as a real-time 3D scene allows.

All models live in `components/earth-scene.tsx`, `components/simulations/artemis-ii-simulation.tsx` (Orion), and `components/simulations/starlink-simulation.tsx` (Starlink). Open any `*Model()` or `createStarlinkGeometry()` function — each one is under 100 lines of JSX primitives.

- **ISS** — truss backbone + pressurized modules + 8 solar arrays
- **Hubble** — cylindrical body + aperture door + twin solar wings
- **GOES-16 / 18** — imager bus + magnetometer boom + sun-tracking panel
- **NOAA-19** — drum body + single deployable solar array
- **Landsat 9** — OLI-2 + TIRS-2 instruments + articulating array
- **JWST** — 18 hexagonal gold mirrors + 5-layer sunshield
- **Tiangong** — Tianhe core + Wentian + Mengtian modules
- **AO-91 CubeSat** — 1U chassis + deployable antennas
- **Orion MPCV** — crew module + ESM + 4 X-config solar wings + AJ10-190 nozzle
- **Starlink v2 Mini** — thin flat bus (4.1m x 2.7m) + two deployable solar wings (~30m span) + phased array antenna

## `>` data sources

- **TLE ephemeris** — [CelesTrak](https://celestrak.org) (updated hourly)
- **Artemis II trajectory** — [JPL Horizons](https://ssd.jpl.nasa.gov/horizons/)
- **Moon position** — [astronomy-engine](https://github.com/cosinekitty/astronomy) (Equator(Body.Moon))
- **Moon texture** — NASA LROC 2K color map
- **Country borders** — [world.geo.json](https://github.com/johan/world.geo.json)
- **India state boundaries** — [india-official-geojson](https://github.com/AbhinavSwami28/india-official-geojson)
- **Starlink constellation** — [FCC SAT-MOD-20190830-00087](https://fcc.report/IBFS/SAT-MOD-20190830-00087/1877764.pdf), Walker phasing from [arxiv 2603.25835](https://arxiv.org/abs/2603.25835)
- **Weather imagery** — NOAA GOES-16/18 public feeds
- **Deep Space Network** — [eyes.nasa.gov/dsn](https://eyes.nasa.gov/dsn/dsn.html)

## `>` support the mission

Skyport is a hobby project built by one person in India. Server costs, API calls, and late-night debugging sessions run on chai.

<p align="center">
  <a href="https://buymeachai.ezee.li/divyaman"><b>☕  Buy me a chai  →</b></a>
</p>

## `>` license

MIT — do whatever you want with it. If you build something cool on top of Skyport, I'd love to hear about it.

---

<p align="center">
  <sub>Built with chai, Three.js, and an unhealthy amount of respect for SGP4.</sub><br/>
  <sub><code>$ exit 0</code></sub>
</p>
