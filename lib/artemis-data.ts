// Artemis II Mission Data - NASA's first crewed lunar mission since Apollo 17

export interface MissionPhase {
  phase: string;
  description: string;
  durationHours: number;
  distanceFromEarth?: number; // km
  distanceFromMoon?: number; // km
}

export interface CrewMember {
  name: string;
  role: string;
  nationality: string;
}

export interface Simulation {
  id: string;
  name: string;
  description: string;
  status: 'PLANNED' | 'ACTIVE' | 'COMPLETED';
  color: string;
  agency: string;
}

export const AVAILABLE_SIMULATIONS: Simulation[] = [
  {
    id: 'artemis-ii',
    name: 'Artemis II',
    description: 'NASA crewed lunar flyby mission',
    status: 'PLANNED',
    color: '#00D4FF',
    agency: 'NASA',
  },
];

export const ARTEMIS_II_MISSION = {
  id: 'artemis-ii',
  name: 'Artemis II',
  agency: 'NASA',
  launchDate: '2025-09-01',
  duration: '10 days',
  crew: [
    { name: 'Reid Wiseman', role: 'Commander', nationality: 'USA' },
    { name: 'Victor Glover', role: 'Pilot', nationality: 'USA' },
    { name: 'Christina Koch', role: 'Mission Specialist', nationality: 'USA' },
    { name: 'Jeremy Hansen', role: 'Mission Specialist', nationality: 'Canada' },
  ] as CrewMember[],
  spacecraft: {
    name: 'Orion MPCV',
    type: 'Crew capsule',
    diameter: 5.02, // meters
    length: 3.3, // meters (crew module)
    mass: 26520, // kg fully loaded
    serviceModule: 'European Service Module (ESM)',
  },
  rocket: {
    name: 'Space Launch System (SLS)',
    variant: 'Block 1',
    height: 98, // meters
    thrust: 39000, // kN at liftoff
  },
  trajectory: {
    type: 'Free-return lunar flyby',
    maxDistanceFromEarth: 380000, // km (beyond Moon)
    closestApproachToMoon: 8900, // km from lunar surface
    totalDistance: 1800000, // km approximate round trip
  },
};

export const ARTEMIS_II_PHASES: MissionPhase[] = [
  {
    phase: 'Launch',
    description: 'Launch from Kennedy Space Center LC-39B',
    durationHours: 0,
    distanceFromEarth: 0,
  },
  {
    phase: 'Earth Orbit',
    description: 'Parking orbit before TLI burn',
    durationHours: 2,
    distanceFromEarth: 1800,
  },
  {
    phase: 'Trans-Lunar Injection',
    description: 'TLI burn - heading to the Moon',
    durationHours: 3,
    distanceFromEarth: 10000,
  },
  {
    phase: 'Outbound Coast',
    description: 'Coasting to the Moon',
    durationHours: 96, // ~4 days
    distanceFromEarth: 380000,
  },
  {
    phase: 'Lunar Flyby',
    description: 'Closest approach to Moon',
    durationHours: 100,
    distanceFromMoon: 8900,
  },
  {
    phase: 'Return Coast',
    description: 'Free-return trajectory to Earth',
    durationHours: 196, // ~8 days total
    distanceFromEarth: 200000,
  },
  {
    phase: 'Re-entry',
    description: 'Atmospheric re-entry and splashdown',
    durationHours: 240, // ~10 days
    distanceFromEarth: 0,
  },
];

// Get current phase based on mission elapsed time
export function getCurrentPhase(missionTimeHours: number): MissionPhase {
  for (let i = ARTEMIS_II_PHASES.length - 1; i >= 0; i--) {
    if (missionTimeHours >= ARTEMIS_II_PHASES[i].durationHours) {
      return ARTEMIS_II_PHASES[i];
    }
  }
  return ARTEMIS_II_PHASES[0];
}

// Calculate velocity based on mission phase (simplified Kepler approximation)
export function getVelocity(progress: number): number {
  // Real velocities vary: ~11 km/s at TLI, ~1 km/s coasting, ~11 km/s re-entry
  if (progress < 0.02) return 7.8; // LEO velocity
  if (progress < 0.05) return 7.8 + progress * 60; // TLI acceleration
  if (progress < 0.4) return 1.5 - progress * 1; // Outbound coast (slowing)
  if (progress < 0.5) return 0.8 + Math.abs(Math.sin((progress - 0.4) * 10 * Math.PI)) * 0.3; // Lunar flyby
  if (progress < 0.95) return 0.8 + (progress - 0.5) * 2; // Return coast (accelerating)
  return 11.0; // Re-entry speed
}
