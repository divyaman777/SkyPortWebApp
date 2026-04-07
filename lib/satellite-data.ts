export type SatelliteCategory = 
  | 'WEATHER_SAT'
  | 'SPACE_STATION'
  | 'AMATEUR_RADIO'
  | 'EARTH_OBS'
  | 'GPS_GNSS'
  | 'COMMS';

export interface Satellite {
  id: string;
  noradId: number;
  name: string;
  category: SatelliteCategory;
  status: 'ACTIVE' | 'INACTIVE' | 'DECAYED';
  inView: boolean;
  altitude: number; // km
  velocity: number; // km/s
  inclination: number; // degrees
  period: number; // minutes
  latitude: number;
  longitude: number;
  nextPass?: string; // countdown string
  signals?: SatelliteSignal[];
}

export interface SatelliteSignal {
  type: 'AMATEUR_RADIO' | 'SSTV_IMAGES' | 'TELEMETRY' | 'BROADCAST';
  frequency?: string;
  mode?: string;
  status?: string;
  description?: string;
}

export const categoryColors: Record<SatelliteCategory, string> = {
  WEATHER_SAT: '#FFB300',
  SPACE_STATION: '#00FF41',
  AMATEUR_RADIO: '#00D4FF',
  EARTH_OBS: '#FF8C00',
  GPS_GNSS: '#BB86FC',
  COMMS: '#E0E0E0',
};

export const categoryLabels: Record<SatelliteCategory, string> = {
  WEATHER_SAT: 'Weather Satellites',
  SPACE_STATION: 'Space Stations',
  AMATEUR_RADIO: 'Amateur Radio / CubeSats',
  EARTH_OBS: 'Earth Observation',
  GPS_GNSS: 'GPS / GNSS',
  COMMS: 'Communications',
};

// Mock satellite data - in production, this would come from Celestrak TLE API
export const mockSatellites: Satellite[] = [
  {
    id: 'iss',
    noradId: 25544,
    name: 'ISS (ZARYA)',
    category: 'SPACE_STATION',
    status: 'ACTIVE',
    inView: true,
    altitude: 408.3,
    velocity: 7.66,
    inclination: 51.6,
    period: 92.7,
    latitude: 23.4,
    longitude: 78.2,
    nextPass: '02:14:33',
    signals: [
      { type: 'AMATEUR_RADIO', frequency: '145.800 MHz', mode: 'FM voice + APRS', status: 'active' },
      { type: 'SSTV_IMAGES', mode: 'PD120 / Robot36', status: 'periodic broadcasts' },
      { type: 'TELEMETRY', description: 'system health, crew comms' },
    ],
  },
  {
    id: 'noaa-19',
    noradId: 33591,
    name: 'NOAA-19',
    category: 'WEATHER_SAT',
    status: 'ACTIVE',
    inView: false,
    altitude: 870,
    velocity: 7.46,
    inclination: 99.1,
    period: 102.1,
    latitude: -15.2,
    longitude: -45.8,
    signals: [
      { type: 'BROADCAST', frequency: '137.100 MHz', mode: 'APT', status: 'continuous' },
    ],
  },
  {
    id: 'noaa-18',
    noradId: 28654,
    name: 'NOAA-18',
    category: 'WEATHER_SAT',
    status: 'ACTIVE',
    inView: true,
    altitude: 854,
    velocity: 7.47,
    inclination: 99.0,
    period: 101.8,
    latitude: 42.1,
    longitude: -122.5,
  },
  {
    id: 'goes-16',
    noradId: 41866,
    name: 'GOES-16',
    category: 'WEATHER_SAT',
    status: 'ACTIVE',
    inView: false,
    altitude: 35786,
    velocity: 3.07,
    inclination: 0.04,
    period: 1436.1,
    latitude: 0.0,
    longitude: -75.2,
  },
  {
    id: 'landsat-8',
    noradId: 39084,
    name: 'LANDSAT-8',
    category: 'EARTH_OBS',
    status: 'ACTIVE',
    inView: false,
    altitude: 705,
    velocity: 7.52,
    inclination: 98.2,
    period: 98.9,
    latitude: 35.6,
    longitude: 139.7,
  },
  {
    id: 'landsat-9',
    noradId: 49260,
    name: 'LANDSAT-9',
    category: 'EARTH_OBS',
    status: 'ACTIVE',
    inView: true,
    altitude: 705,
    velocity: 7.52,
    inclination: 98.2,
    period: 98.9,
    latitude: -22.9,
    longitude: -43.2,
  },
  {
    id: 'sentinel-2a',
    noradId: 40697,
    name: 'SENTINEL-2A',
    category: 'EARTH_OBS',
    status: 'ACTIVE',
    inView: false,
    altitude: 786,
    velocity: 7.45,
    inclination: 98.6,
    period: 100.6,
    latitude: 51.5,
    longitude: -0.1,
  },
  {
    id: 'gps-iir-21',
    noradId: 32711,
    name: 'GPS BIIR-21 (PRN 21)',
    category: 'GPS_GNSS',
    status: 'ACTIVE',
    inView: true,
    altitude: 20180,
    velocity: 3.87,
    inclination: 55.0,
    period: 718.0,
    latitude: 45.2,
    longitude: -93.5,
  },
  {
    id: 'gps-iii-04',
    noradId: 48859,
    name: 'GPS III SV04 (PRN 18)',
    category: 'GPS_GNSS',
    status: 'ACTIVE',
    inView: false,
    altitude: 20200,
    velocity: 3.87,
    inclination: 55.0,
    period: 718.0,
    latitude: -12.4,
    longitude: 88.9,
  },
  {
    id: 'starlink-1007',
    noradId: 44713,
    name: 'STARLINK-1007',
    category: 'COMMS',
    status: 'ACTIVE',
    inView: true,
    altitude: 550,
    velocity: 7.59,
    inclination: 53.0,
    period: 95.6,
    latitude: 28.5,
    longitude: -80.6,
  },
  {
    id: 'starlink-1130',
    noradId: 44914,
    name: 'STARLINK-1130',
    category: 'COMMS',
    status: 'ACTIVE',
    inView: false,
    altitude: 550,
    velocity: 7.59,
    inclination: 53.0,
    period: 95.6,
    latitude: -33.9,
    longitude: 151.2,
  },
  {
    id: 'ao-91',
    noradId: 43017,
    name: 'AO-91 (RadFxSat)',
    category: 'AMATEUR_RADIO',
    status: 'ACTIVE',
    inView: false,
    altitude: 450,
    velocity: 7.64,
    inclination: 97.6,
    period: 93.5,
    latitude: 19.4,
    longitude: -99.1,
    signals: [
      { type: 'AMATEUR_RADIO', frequency: '145.960 MHz', mode: 'FM repeater' },
    ],
  },
  {
    id: 'ao-92',
    noradId: 43137,
    name: 'AO-92 (Fox-1D)',
    category: 'AMATEUR_RADIO',
    status: 'ACTIVE',
    inView: true,
    altitude: 450,
    velocity: 7.64,
    inclination: 97.5,
    period: 93.5,
    latitude: 55.8,
    longitude: 37.6,
    signals: [
      { type: 'AMATEUR_RADIO', frequency: '145.880 MHz', mode: 'FM repeater' },
    ],
  },
  {
    id: 'cubesat-1',
    noradId: 99001,
    name: 'AMSAT CUBESAT-1',
    category: 'AMATEUR_RADIO',
    status: 'ACTIVE',
    inView: false,
    altitude: 400,
    velocity: 7.67,
    inclination: 51.6,
    period: 92.5,
    latitude: -35.3,
    longitude: -58.4,
  },
  {
    id: 'tiangong',
    noradId: 48274,
    name: 'TIANGONG (CSS)',
    category: 'SPACE_STATION',
    status: 'ACTIVE',
    inView: false,
    altitude: 390,
    velocity: 7.68,
    inclination: 41.5,
    period: 91.5,
    latitude: 31.2,
    longitude: 121.5,
  },
];

// Generate more satellites to reach ~323 total
export function generateMockSatellites(): Satellite[] {
  const baseSatellites = [...mockSatellites];
  const categories: SatelliteCategory[] = ['WEATHER_SAT', 'AMATEUR_RADIO', 'EARTH_OBS', 'GPS_GNSS', 'COMMS'];
  
  // Add more satellites to reach target counts
  const targetCounts: Record<SatelliteCategory, number> = {
    WEATHER_SAT: 23,
    SPACE_STATION: 1,
    AMATEUR_RADIO: 148,
    EARTH_OBS: 31,
    GPS_GNSS: 31,
    COMMS: 89,
  };

  let noradCounter = 99100;
  
  categories.forEach(category => {
    const existing = baseSatellites.filter(s => s.category === category).length;
    const needed = targetCounts[category] - existing;
    
    for (let i = 0; i < needed; i++) {
      noradCounter++;
      const lat = Math.random() * 180 - 90;
      const lon = Math.random() * 360 - 180;
      
      // Assign altitude based on satellite category to match real orbit zones:
      // LEO (160-2000km): Most satellites - ISS, Earth obs, amateur, Starlink
      // MEO (2000-35786km): GPS/GNSS navigation satellites
      // GEO (35786km): Geostationary weather and comms
      let altitude: number;
      switch (category) {
        case 'GPS_GNSS':
          // MEO - GPS satellites orbit at ~20,200 km
          altitude = 20180 + Math.random() * 40;
          break;
        case 'WEATHER_SAT':
          // Mix of LEO polar (800-900km) and GEO (35786km)
          altitude = Math.random() > 0.3 ? 800 + Math.random() * 100 : 35786;
          break;
        case 'COMMS':
          // Mix of LEO (Starlink ~550km) and GEO (35786km)
          altitude = Math.random() > 0.4 ? 540 + Math.random() * 20 : 35786;
          break;
        case 'EARTH_OBS':
          // LEO polar orbits (400-900km)
          altitude = 400 + Math.random() * 500;
          break;
        case 'AMATEUR_RADIO':
          // LEO (400-600km)
          altitude = 400 + Math.random() * 200;
          break;
        default:
          // LEO default
          altitude = 400 + Math.random() * 600;
      }
      
      baseSatellites.push({
        id: `${category.toLowerCase()}-${noradCounter}`,
        noradId: noradCounter,
        name: `${category.replace('_', '-')}-${i + 1}`,
        category,
        status: Math.random() > 0.05 ? 'ACTIVE' : 'INACTIVE',
        inView: Math.random() > 0.6,
        altitude,
        velocity: Math.sqrt(398600 / (6371 + altitude)),
        inclination: Math.random() * 100,
        period: 2 * Math.PI * Math.sqrt(Math.pow(6371 + altitude, 3) / 398600) / 60,
        latitude: lat,
        longitude: lon,
      });
    }
  });

  return baseSatellites;
}

export function getCategoryCounts(satellites: Satellite[]): Record<SatelliteCategory, number> {
  return satellites.reduce((acc, sat) => {
    acc[sat.category] = (acc[sat.category] || 0) + 1;
    return acc;
  }, {} as Record<SatelliteCategory, number>);
}
