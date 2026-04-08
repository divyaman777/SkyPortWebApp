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
    type: 'Free-return lunar flyby (figure-8)',
    maxDistanceFromEarth: 380000, // km (beyond Moon)
    closestApproachToMoon: 6500, // km from lunar surface (NASA official: ~4,047 miles / 6,513 km)
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

// Calculate velocity based on mission phase using NASA/physics data
// Real velocities: 
// - LEO: ~7.8 km/s
// - TLI burn peak: ~10.9 km/s 
// - Outbound coast: gradually slows from 10.9 to ~0.9 km/s
// - Lunar flyby: ~0.9-1.5 km/s (gravity assist)
// - Return coast: gradually accelerates from 0.9 to ~11 km/s
// - Re-entry: ~11.2 km/s (25,000 mph - NASA official)
export function getVelocity(progress: number): number {
  if (progress < 0.01) {
    // Launch to LEO
    return 7.8;
  } else if (progress < 0.03) {
    // TLI burn - accelerating from 7.8 to 10.9 km/s
    const tliProgress = (progress - 0.01) / 0.02;
    return 7.8 + tliProgress * 3.1;
  } else if (progress < 0.42) {
    // Outbound coast - gradually slowing (10.9 to 0.9 km/s)
    const coastProgress = (progress - 0.03) / 0.39;
    return 10.9 - coastProgress * 10.0;
  } else if (progress < 0.52) {
    // Lunar flyby - slight speed increase from gravity assist
    const flybyProgress = (progress - 0.42) / 0.1;
    const flybySpeed = 0.9 + Math.sin(flybyProgress * Math.PI) * 0.6;
    return flybySpeed;
  } else if (progress < 0.97) {
    // Return coast - accelerating toward Earth (0.9 to 11 km/s)
    const returnProgress = (progress - 0.52) / 0.45;
    return 0.9 + returnProgress * 10.1;
  } else {
    // Re-entry - constant ~11.2 km/s (25,000 mph NASA official)
    return 11.2;
  }
}
