import type { Metadata, Viewport } from 'next'
import { JetBrains_Mono, VT323, Share_Tech_Mono } from 'next/font/google'
import { GoogleAnalytics } from '@next/third-parties/google'
import './globals.css'

const jetbrainsMono = JetBrains_Mono({ 
  subsets: ["latin"],
  variable: '--font-jetbrains',
})

const vt323 = VT323({ 
  weight: '400',
  subsets: ["latin"],
  variable: '--font-vt323',
})

const shareTechMono = Share_Tech_Mono({ 
  weight: '400',
  subsets: ["latin"],
  variable: '--font-share-tech',
})

const SITE_URL = 'https://skyport.space';
const TITLE = 'Skyport — Real-Time 3D Satellite Tracker | ISS, Starlink, JWST Live';
const DESCRIPTION =
  'Skyport is a free real-time 3D satellite tracker. Watch ISS, Hubble, JWST, Starlink, and Artemis II orbit Earth live in your browser — with weather imagery, NASA feeds, and radio transmissions.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    'satellite tracker',
    'ISS tracker',
    'live satellite map',
    'Starlink tracker',
    'Artemis II',
    'space station tracker',
    '3D satellite',
    'real-time satellite tracking',
    'orbital mechanics',
    'Hubble',
    'JWST',
    'GOES weather satellite',
    'amateur radio satellite',
    'TLE data',
    'CelesTrak',
  ],
  authors: [{ name: 'Divyaman', url: SITE_URL }],
  creator: 'Divyaman',
  publisher: 'Skyport',
  applicationName: 'Skyport',
  category: 'Science & Technology',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    type: 'website',
    url: SITE_URL,
    title: TITLE,
    description: DESCRIPTION,
    siteName: 'Skyport',
    locale: 'en_US',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Skyport — Real-time 3D satellite tracker showing Earth with orbiting satellites',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: ['/og-image.png'],
    creator: '@divyaman',
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '48x48' },
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
  manifest: '/manifest.json',
  other: {
    'google-site-verification': 'REPLACE_WITH_YOUR_VERIFICATION_CODE',
    'msvalidate.01': 'REPLACE_WITH_BING_VERIFICATION_CODE',
  },
}

export const viewport: Viewport = {
  themeColor: '#0a0a0f',
  colorScheme: 'dark',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const webAppJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Skyport',
    url: SITE_URL,
    description: DESCRIPTION,
    applicationCategory: 'EducationalApplication',
    operatingSystem: 'Any',
    browserRequirements: 'Requires WebGL',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    author: { '@type': 'Person', name: 'Divyaman', url: SITE_URL },
    creator: { '@type': 'Person', name: 'Divyaman' },
    keywords: 'satellite tracker, ISS tracker, Starlink, Artemis II, 3D, real-time, space',
    image: `${SITE_URL}/og-image.png`,
    screenshot: `${SITE_URL}/og-image.png`,
    featureList: [
      'Real-time satellite positions via SGP4 propagation',
      '10 hand-modelled 3D spacecraft',
      'Starlink constellation simulation (1,584 satellites)',
      'Live Artemis II mission tracking',
      'GOES weather satellite imagery',
      'ISS live audio streams',
      'Deep Space Network status',
      'Amateur radio transponder frequencies',
    ],
    softwareVersion: '1.0.0',
    inLanguage: 'en',
  };

  const webSiteJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Skyport',
    url: SITE_URL,
    description: DESCRIPTION,
    inLanguage: 'en',
    publisher: {
      '@type': 'Person',
      name: 'Divyaman',
      url: SITE_URL,
    },
  };

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'What is Skyport?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Skyport is a free, real-time 3D satellite tracker that runs entirely in your browser. It shows the live positions of ISS, Hubble, JWST, Starlink, Tiangong, GOES weather satellites, and more using real TLE data from CelesTrak.',
        },
      },
      {
        '@type': 'Question',
        name: 'How does Skyport track satellites in real time?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Skyport uses SGP4 orbital propagation with Two-Line Element (TLE) data updated hourly from CelesTrak. Each satellite\'s position is calculated using real orbital mechanics — the same math used by NASA and NORAD.',
        },
      },
      {
        '@type': 'Question',
        name: 'Can I track the ISS live on Skyport?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. Skyport shows the International Space Station\'s live position, altitude, velocity, orbital period, and inclination. You can click on the ISS to see detailed telemetry and listen to live ISS audio streams.',
        },
      },
      {
        '@type': 'Question',
        name: 'Does Skyport track Starlink satellites?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Skyport simulates the full Starlink Shell 1 constellation — 1,584 satellites across 72 orbital planes at 550 km altitude, with inter-satellite laser links visualized in real time. Click any Starlink satellite for detailed specs from FCC filings.',
        },
      },
      {
        '@type': 'Question',
        name: 'Is Skyport free to use?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes, Skyport is completely free. No login, no ads, no backend. It runs entirely in your browser using WebGL and Three.js.',
        },
      },
    ],
  };

  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://celestrak.org" />
        <link rel="preconnect" href="https://cdn.star.nesdis.noaa.gov" />
        <link rel="dns-prefetch" href="https://celestrak.org" />
        <link rel="dns-prefetch" href="https://cdn.star.nesdis.noaa.gov" />
      </head>
      <body className={`${jetbrainsMono.variable} ${vt323.variable} ${shareTechMono.variable} font-mono antialiased`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(webSiteJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
        {children}
        <noscript>
          <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto', fontFamily: 'system-ui, sans-serif', color: '#e0e0e0', backgroundColor: '#0a0a0f' }}>
            <h1>Skyport — Real-Time 3D Satellite Tracker</h1>
            <p>Skyport is a free, browser-based 3D satellite tracker that shows the live position of every broadcasting satellite orbiting Earth. Built with Three.js and real orbital mechanics (SGP4 propagation from CelesTrak TLE data).</p>
            <h2>Satellites We Track</h2>
            <ul>
              <li><strong>ISS (International Space Station)</strong> — NORAD 25544, LEO 408 km, live audio streams</li>
              <li><strong>Hubble Space Telescope</strong> — NORAD 20580, LEO 547 km</li>
              <li><strong>JWST (James Webb Space Telescope)</strong> — L2 Lagrange point, 1.5 million km from Earth</li>
              <li><strong>Starlink Constellation</strong> — 1,584 satellites, 72 orbital planes, 550 km altitude, inter-satellite laser links</li>
              <li><strong>Tiangong Space Station</strong> — NORAD 48274, LEO 390 km</li>
              <li><strong>GOES-16 &amp; GOES-18</strong> — Geostationary weather satellites, live imagery</li>
              <li><strong>NOAA-19</strong> — Polar-orbiting weather satellite, LEO 870 km</li>
              <li><strong>Landsat 9</strong> — Earth observation, LEO 705 km</li>
              <li><strong>AO-91 (RadFxSat)</strong> — Amateur radio CubeSat, LEO 450 km</li>
              <li><strong>Artemis II (Orion MPCV)</strong> — Cislunar trajectory, JPL Horizons data</li>
            </ul>
            <h2>Features</h2>
            <ul>
              <li>Real-time satellite positions using SGP4 orbital propagation</li>
              <li>10 hand-modelled 3D spacecraft built from Three.js primitives</li>
              <li>Live Artemis II mission tracking with NASA JPL Horizons data</li>
              <li>Starlink constellation simulation with Walker Delta phasing and laser links</li>
              <li>GOES weather satellite imagery</li>
              <li>ISS live audio streams and Deep Space Network status</li>
              <li>Amateur radio transponder frequencies</li>
            </ul>
            <h2>Frequently Asked Questions</h2>
            <h3>What is Skyport?</h3>
            <p>Skyport is a free, real-time 3D satellite tracker that runs entirely in your browser. It shows live positions of ISS, Hubble, JWST, Starlink, Tiangong, GOES weather satellites, and more using real TLE data from CelesTrak.</p>
            <h3>How does Skyport track satellites?</h3>
            <p>Skyport uses SGP4 orbital propagation with Two-Line Element (TLE) data updated hourly from CelesTrak — the same math used by NASA and NORAD.</p>
            <h3>Is Skyport free?</h3>
            <p>Yes. No login, no ads, no backend. Runs entirely in your browser using WebGL.</p>
            <p>Please enable JavaScript to use the interactive 3D satellite tracker.</p>
            <p><a href="https://skyport.space" style={{ color: '#00D4FF' }}>Visit Skyport</a></p>
          </div>
        </noscript>
        <GoogleAnalytics gaId="G-PBGTL2VJEW" />
      </body>
    </html>
  )
}
