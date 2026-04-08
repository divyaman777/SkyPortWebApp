// Artemis II Mission Data - NASA's first crewed lunar mission since Apollo 17
// Data sourced from NASA official documents and Wikipedia
// Mission launched: April 1, 2026, 22:35:12 UTC
// Expected splashdown: April 11, 2026

export interface MissionPhase {
  phase: string;
  description: string;
  startHours: number; // Hours from launch
  endHours: number;
  distanceFromEarth?: number; // km
  distanceFromMoon?: number; // km
}

export interface CrewMember {
  name: string;
  role: string;
  nationality: string;
  agency: string;
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
    description: 'NASA crewed lunar flyby mission - LIVE',
    status: 'ACTIVE',
    color: '#00D4FF',
    agency: 'NASA',
  },
];

// Mission launch time: April 1, 2026, 22:35:12 UTC
export const ARTEMIS_II_LAUNCH_TIME = new Date('2026-04-01T22:35:12Z');

export const ARTEMIS_II_MISSION = {
  id: 'artemis-ii',
  name: 'Artemis II',
  fullName: 'Artemis II: First Crewed Lunar Flyby in 50 Years',
  agency: 'NASA',
  launchDate: 'April 1, 2026, 22:35:12 UTC',
  launchSite: 'Kennedy Space Center, LC-39B',
  expectedSplashdown: 'April 11, 2026, ~01:42 UTC',
  splashdownLocation: 'Pacific Ocean, off San Diego',
  duration: '10 days',
  durationHours: 240,
  crew: [
    { name: 'Reid Wiseman', role: 'Commander', nationality: 'USA', agency: 'NASA' },
    { name: 'Victor Glover', role: 'Pilot', nationality: 'USA', agency: 'NASA' },
    { name: 'Christina Koch', role: 'Mission Specialist 1', nationality: 'USA', agency: 'NASA' },
    { name: 'Jeremy Hansen', role: 'Mission Specialist 2', nationality: 'Canada', agency: 'CSA' },
  ] as CrewMember[],
  spacecraft: {
    name: 'Orion MPCV',
    callsign: 'Integrity',
    designation: 'CM-003',
    type: 'Crew capsule',
    diameter: 5.02, // meters
    length: 3.3, // meters (crew module)
    mass: 26520, // kg fully loaded
    serviceModule: 'European Service Module (ESM-2)',
    manufacturer: 'Lockheed Martin (Orion), Airbus (ESM)',
  },
  rocket: {
    name: 'Space Launch System (SLS)',
    variant: 'Block 1',
    height: 98, // meters
    thrust: 39000, // kN at liftoff
    upperStage: 'Interim Cryogenic Propulsion Stage (ICPS)',
  },
  trajectory: {
    type: 'Free-return lunar flyby',
    maxDistanceFromEarth: 406841, // km (252,799 miles - record breaking!)
    closestApproachToMoon: 6513, // km (4,047 miles) from lunar surface
    distanceBeyondMoon: 7600, // km (4,700 miles) past Moon
    totalDistance: 1800000, // km approximate round trip
    reentrySpeed: 40000, // km/h (25,000 mph)
    reentrySpeedKms: 11.1, // km/s
  },
  records: {
    farthestFromEarth: true, // 406,841 km vs Apollo 13's 400,171 km
    farthestBeyondMoon: true, // 7,600 km vs Apollo 13's 254 km
    fastestReentry: true, // ~25,000 mph
    mostPeopleDeepSpace: true, // 4 (vs Apollo 8's 3)
    firstWomanBeyondLEO: 'Christina Koch',
    firstPersonOfColorBeyondLEO: 'Victor Glover',
    firstNonAmericanToMoon: 'Jeremy Hansen',
  },
};

// Mission timeline based on NASA official schedule
// Source: artemis2.app and NASA mission logs
export const ARTEMIS_II_PHASES: MissionPhase[] = [
  {
    phase: 'Launch & Ascent',
    description: 'SLS liftoff from Kennedy Space Center LC-39B, 8-minute ascent to orbit',
    startHours: 0,
    endHours: 0.15, // ~8 minutes
    distanceFromEarth: 0,
  },
  {
    phase: 'Earth Orbit & Proximity Ops',
    description: 'High Earth orbit (74,080 km apogee), spacecraft checkout, proximity ops with ICPS',
    startHours: 0.15,
    endHours: 24, // Day 1
    distanceFromEarth: 74080,
  },
  {
    phase: 'Trans-Lunar Injection',
    description: 'TLI burn complete - Orion on trajectory to the Moon',
    startHours: 24,
    endHours: 26, // Day 2 start
    distanceFromEarth: 80000,
  },
  {
    phase: 'Outbound Transit',
    description: 'Coasting to the Moon, trajectory correction burns, crew activities',
    startHours: 26,
    endHours: 110, // ~Day 5
    distanceFromEarth: 350000,
  },
  {
    phase: 'Lunar Sphere of Influence',
    description: 'Entered lunar gravity influence, final approach preparations',
    startHours: 110,
    endHours: 116, // Day 5-6
    distanceFromMoon: 66000,
  },
  {
    phase: 'Lunar Flyby',
    description: 'Closest approach: 6,513 km (4,047 mi) from lunar surface - HISTORIC!',
    startHours: 116,
    endHours: 125, // Day 6
    distanceFromMoon: 6513,
  },
  {
    phase: 'Return Transit',
    description: 'Free-return trajectory back to Earth, crew experiments and observations',
    startHours: 125,
    endHours: 216, // Day 9
    distanceFromEarth: 300000,
  },
  {
    phase: 'Re-entry Preparation',
    description: 'Final trajectory corrections, suit checks, cabin stow',
    startHours: 216,
    endHours: 225, // Day 10
    distanceFromEarth: 50000,
  },
  {
    phase: 'Re-entry & Splashdown',
    description: 'Atmospheric re-entry at 25,000 mph (11.1 km/s), parachute deploy, Pacific splashdown',
    startHours: 225,
    endHours: 226, // ~T+9d 1h 42m
    distanceFromEarth: 0,
  },
];

// Get current phase based on mission elapsed time
export function getCurrentPhase(missionTimeHours: number): MissionPhase {
  for (let i = ARTEMIS_II_PHASES.length - 1; i >= 0; i--) {
    if (missionTimeHours >= ARTEMIS_II_PHASES[i].startHours) {
      return ARTEMIS_II_PHASES[i];
    }
  }
  return ARTEMIS_II_PHASES[0];
}

// Calculate real-time mission progress based on current date
export function getRealMissionProgress(): { 
  elapsedHours: number; 
  progress: number; 
  isLive: boolean;
  phase: MissionPhase;
} {
  const now = new Date();
  const launchTime = ARTEMIS_II_LAUNCH_TIME;
  const elapsedMs = now.getTime() - launchTime.getTime();
  const elapsedHours = elapsedMs / (1000 * 60 * 60);
  
  // Mission is ~226 hours (10 days)
  const totalMissionHours = 226;
  const progress = Math.max(0, Math.min(1, elapsedHours / totalMissionHours));
  const isLive = elapsedHours >= 0 && elapsedHours <= totalMissionHours;
  
  return {
    elapsedHours: Math.max(0, elapsedHours),
    progress,
    isLive,
    phase: getCurrentPhase(Math.max(0, elapsedHours)),
  };
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
