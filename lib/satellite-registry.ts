import { SatelliteCategory } from './satellite-data';

export interface SatelliteRegistryEntry {
  id: string;
  noradId: number;
  name: string;
  category: SatelliteCategory;
  type: string;
  nominalAltitude: number; // km
  launchDate: string;
  country: string;
  signals?: {
    type: 'AMATEUR_RADIO' | 'SSTV_IMAGES' | 'TELEMETRY' | 'BROADCAST';
    frequency?: string;
    mode?: string;
    status?: string;
    description?: string;
  }[];
  dataFeeds: DataFeed[];
  special?: 'GEOSTATIONARY' | 'L2_POINT' | 'MOON';
}

export interface DataFeed {
  id: string;
  label: string;
  type: 'youtube' | 'image' | 'api_json' | 'link' | 'iframe';
  url: string;
  refreshInterval?: number; // ms, 0 = no auto refresh
  corsProxy?: boolean; // needs CORS proxy
  cacheDuration?: number; // ms
}

export const SATELLITE_REGISTRY: SatelliteRegistryEntry[] = [
  {
    id: 'iss',
    noradId: 25544,
    name: 'ISS (ZARYA)',
    category: 'SPACE_STATION',
    type: 'Space Station',
    nominalAltitude: 408,
    launchDate: '1998-11-20',
    country: 'International',
    signals: [
      { type: 'AMATEUR_RADIO', frequency: '145.800 MHz', mode: 'FM voice + APRS', status: 'active' },
      { type: 'AMATEUR_RADIO', frequency: '145.825 MHz', mode: 'APRS packet', status: 'active' },
      { type: 'SSTV_IMAGES', mode: 'PD120 / Robot36', status: 'periodic broadcasts' },
      { type: 'TELEMETRY', description: 'System health, crew comms' },
    ],
    dataFeeds: [
      { id: 'iss-live', label: 'NASA HD Live Stream', type: 'youtube', url: 'https://www.youtube.com/embed/xRPjKQtRXR8?autoplay=1', refreshInterval: 0 },
      { id: 'iss-crew', label: 'Current Crew', type: 'api_json', url: 'http://api.open-notify.org/astros.json', refreshInterval: 3600000, corsProxy: true, cacheDuration: 3600000 },
      { id: 'iss-pos', label: 'Live Position', type: 'api_json', url: 'http://api.open-notify.org/iss-now.json', refreshInterval: 1000, corsProxy: true, cacheDuration: 0 },
    ],
  },
  {
    id: 'hubble',
    noradId: 20580,
    name: 'HUBBLE SPACE TELESCOPE',
    category: 'EARTH_OBS',
    type: 'Space Telescope',
    nominalAltitude: 547,
    launchDate: '1990-04-24',
    country: 'USA',
    signals: [
      { type: 'TELEMETRY', description: 'S-band telemetry' },
    ],
    dataFeeds: [
      { id: 'hubble-images', label: 'Latest Hubble Images', type: 'api_json', url: 'https://images-api.nasa.gov/search?q=hubble&media_type=image&page_size=5', refreshInterval: 0, cacheDuration: 86400000 },
    ],
  },
  {
    id: 'goes-16',
    noradId: 41866,
    name: 'GOES-16',
    category: 'WEATHER_SAT',
    type: 'Weather Satellite (Geostationary)',
    nominalAltitude: 35786,
    launchDate: '2016-11-19',
    country: 'USA',
    special: 'GEOSTATIONARY',
    signals: [
      { type: 'BROADCAST', frequency: '1694.1 MHz', mode: 'HRIT/LRIT', status: 'continuous' },
    ],
    dataFeeds: [
      { id: 'goes16-geocolor', label: 'Full Disk GeoColor', type: 'image', url: 'https://cdn.star.nesdis.noaa.gov/GOES16/ABI/FD/GEOCOLOR/latest.jpg', refreshInterval: 600000, cacheDuration: 600000 },
      { id: 'goes16-ir', label: 'Infrared Band 13', type: 'image', url: 'https://cdn.star.nesdis.noaa.gov/GOES16/ABI/FD/13/latest.jpg', refreshInterval: 600000, cacheDuration: 600000 },
      { id: 'goes16-wv', label: 'Water Vapor Band 09', type: 'image', url: 'https://cdn.star.nesdis.noaa.gov/GOES16/ABI/FD/09/latest.jpg', refreshInterval: 600000, cacheDuration: 600000 },
    ],
  },
  {
    id: 'goes-18',
    noradId: 51850,
    name: 'GOES-18',
    category: 'WEATHER_SAT',
    type: 'Weather Satellite (Geostationary)',
    nominalAltitude: 35786,
    launchDate: '2022-03-01',
    country: 'USA',
    special: 'GEOSTATIONARY',
    signals: [
      { type: 'BROADCAST', frequency: '1694.1 MHz', mode: 'HRIT/LRIT', status: 'continuous' },
    ],
    dataFeeds: [
      { id: 'goes18-geocolor', label: 'Full Disk GeoColor', type: 'image', url: 'https://cdn.star.nesdis.noaa.gov/GOES18/ABI/FD/GEOCOLOR/latest.jpg', refreshInterval: 600000, cacheDuration: 600000 },
      { id: 'goes18-ir', label: 'Infrared Band 13', type: 'image', url: 'https://cdn.star.nesdis.noaa.gov/GOES18/ABI/FD/13/latest.jpg', refreshInterval: 600000, cacheDuration: 600000 },
      { id: 'goes18-wv', label: 'Water Vapor Band 09', type: 'image', url: 'https://cdn.star.nesdis.noaa.gov/GOES18/ABI/FD/09/latest.jpg', refreshInterval: 600000, cacheDuration: 600000 },
    ],
  },
  {
    id: 'noaa-19',
    noradId: 33591,
    name: 'NOAA-19',
    category: 'WEATHER_SAT',
    type: 'Weather Satellite (Polar)',
    nominalAltitude: 870,
    launchDate: '2009-02-06',
    country: 'USA',
    signals: [
      { type: 'BROADCAST', frequency: '137.100 MHz', mode: 'APT', status: 'continuous' },
      { type: 'BROADCAST', frequency: '1698.0 MHz', mode: 'HRPT', status: 'continuous' },
    ],
    dataFeeds: [
      { id: 'noaa19-satnogs', label: 'SatNOGS Observations', type: 'link', url: 'https://network.satnogs.org/observations/?satellite__norad_cat_id=33591', refreshInterval: 0 },
    ],
  },
  {
    id: 'landsat-9',
    noradId: 49260,
    name: 'LANDSAT 9',
    category: 'EARTH_OBS',
    type: 'Earth Observation',
    nominalAltitude: 705,
    launchDate: '2021-09-27',
    country: 'USA',
    signals: [
      { type: 'TELEMETRY', description: 'X-band data downlink' },
    ],
    dataFeeds: [
      { id: 'landsat-images', label: 'Latest Landsat Imagery', type: 'link', url: 'https://landsat.gsfc.nasa.gov/', refreshInterval: 0 },
      { id: 'landsat-earthexplorer', label: 'USGS EarthExplorer', type: 'link', url: 'https://earthexplorer.usgs.gov/', refreshInterval: 0 },
    ],
  },
  {
    id: 'jwst',
    noradId: 50463,
    name: 'JAMES WEBB SPACE TELESCOPE',
    category: 'EARTH_OBS',
    type: 'Space Telescope (L2 Point)',
    nominalAltitude: 1500000,
    launchDate: '2021-12-25',
    country: 'International',
    special: 'L2_POINT',
    signals: [
      { type: 'TELEMETRY', description: 'Ka-band science data' },
    ],
    dataFeeds: [
      { id: 'jwst-images', label: 'Latest JWST Images', type: 'api_json', url: 'https://images-api.nasa.gov/search?q=james+webb+space+telescope&media_type=image&page_size=5', refreshInterval: 0, cacheDuration: 86400000 },
    ],
  },
  {
    id: 'ao-91',
    noradId: 43017,
    name: 'AO-91 (Fox-1B)',
    category: 'AMATEUR_RADIO',
    type: 'Amateur Radio CubeSat',
    nominalAltitude: 550,
    launchDate: '2018-01-12',
    country: 'USA',
    signals: [
      { type: 'AMATEUR_RADIO', frequency: '145.960 MHz', mode: 'FM transponder', status: 'active' },
      { type: 'TELEMETRY', frequency: '435.250 MHz', mode: 'DUV telemetry', status: 'active' },
    ],
    dataFeeds: [
      { id: 'ao91-telemetry', label: 'SatNOGS Telemetry', type: 'api_json', url: 'https://db.satnogs.org/api/telemetry/?satellite__norad_cat_id=43017&format=json', refreshInterval: 0, corsProxy: true, cacheDuration: 300000 },
    ],
  },
  {
    id: 'moon',
    noradId: 0,
    name: 'MOON',
    category: 'EARTH_OBS',
    type: 'Natural Satellite',
    nominalAltitude: 384400,
    launchDate: '~4.5 billion years ago',
    country: 'N/A',
    special: 'MOON',
    signals: [],
    dataFeeds: [
      { id: 'moon-phase', label: 'Moon Phase Visualization', type: 'link', url: 'https://svs.gsfc.nasa.gov/4955', refreshInterval: 0 },
    ],
  },
];

// Map from satellite ID to registry entry for quick lookup
export const REGISTRY_MAP = new Map<string, SatelliteRegistryEntry>(
  SATELLITE_REGISTRY.map(entry => [entry.id, entry])
);

// Map from NORAD ID to registry entry
export const REGISTRY_BY_NORAD = new Map<number, SatelliteRegistryEntry>(
  SATELLITE_REGISTRY.filter(e => e.noradId > 0).map(entry => [entry.noradId, entry])
);
