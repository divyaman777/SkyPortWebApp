/**
 * sim-clock.ts
 *
 * Single shared simulation clock. The 3D scene AND the UI panels must
 * read time from here so the rendered satellite positions and the
 * displayed lat/lon/alt/velocity always agree.
 *
 * Simulation runs at 30x real-time anchored at page load — satellites
 * orbit visibly (ISS ~3 min per orbit, Earth rotates once per ~48 min).
 */

export const TIME_SCALE = 30;

// Moon revolution multiplier — Moon orbits in ~87 min of real time
// (27.3 days / (30 × 15)). Keeps the Moon visibly moving without
// spinning unrealistically fast.
export const MOON_SPEED_MULT = 15;

const simStartReal = Date.now();
const simStartDate = new Date(simStartReal);

// Mission-replay override: while set (Artemis playback), EVERY consumer of the
// sim clock — Earth rotation, Moon, satellites, UI panels — reads this exact
// date, so the whole scene replays the mission window in lockstep.
let overrideDate: Date | null = null;

export function setSimTimeOverride(date: Date | null): void {
  overrideDate = date;
}

export function getSimTimeOverride(): Date | null {
  return overrideDate;
}

export function getSimDate(): Date {
  if (overrideDate) return overrideDate;
  const realElapsed = Date.now() - simStartReal;
  return new Date(simStartDate.getTime() + realElapsed * TIME_SCALE);
}

export function getMoonSimDate(): Date {
  // During mission replay the Moon follows the mission clock 1:1 — no extra
  // speed multiplier, so its position is the real position for that date.
  if (overrideDate) return overrideDate;
  const realElapsed = Date.now() - simStartReal;
  return new Date(simStartDate.getTime() + realElapsed * TIME_SCALE * MOON_SPEED_MULT);
}
