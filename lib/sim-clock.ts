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

export function getSimDate(): Date {
  const realElapsed = Date.now() - simStartReal;
  return new Date(simStartDate.getTime() + realElapsed * TIME_SCALE);
}

export function getMoonSimDate(): Date {
  const realElapsed = Date.now() - simStartReal;
  return new Date(simStartDate.getTime() + realElapsed * TIME_SCALE * MOON_SPEED_MULT);
}
