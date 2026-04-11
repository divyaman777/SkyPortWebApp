import type { Metadata, Viewport } from 'next'
import { JetBrains_Mono, VT323, Share_Tech_Mono } from 'next/font/google'
import { GoogleAnalytics } from '@next/third-parties/google'
import './globals.css'

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
})

const vt323 = VT323({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-vt323',
})

const shareTechMono = Share_Tech_Mono({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-share-tech',
})

const SITE_URL = 'https://skyport.space'
const SITE_NAME = 'Skyport'
const SITE_TITLE = 'Skyport — Live 3D Satellite Tracker | ISS, Hubble, JWST & Artemis II'
const SITE_DESCRIPTION =
  'Track every broadcasting satellite in orbit in real time. Live 3D tracker for the ISS, Hubble, JWST, GOES weather sats, Landsat, Tiangong, and the Artemis II lunar mission — powered by NASA data, CelesTrak TLEs, and JPL Horizons. Free, in-browser, no install.'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: '%s — Skyport',
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: 'Divyaman', url: SITE_URL }],
  creator: 'Divyaman',
  publisher: 'Skyport',
  keywords: [
    'satellite tracker',
    'live satellite tracker',
    'real-time satellite tracking',
    '3D satellite tracker',
    'satellite map',
    'ISS tracker',
    'International Space Station live',
    'where is the ISS',
    'Hubble Space Telescope tracker',
    'James Webb Space Telescope',
    'JWST live position',
    'Artemis II tracker',
    'where is Artemis II',
    'Orion spacecraft tracker',
    'Artemis II lunar mission',
    'GOES-16 live',
    'GOES-18 weather satellite',
    'NOAA-19 tracker',
    'Landsat 9 tracker',
    'Tiangong space station',
    'AO-91 amateur radio satellite',
    'NORAD satellite tracker',
    'TLE tracker',
    'SGP4 propagator',
    'CelesTrak',
    'NASA live data',
    'JPL Horizons',
    'orbital mechanics',
    'orbit visualization',
    'Deep Space Network status',
    'DSN live',
    'space weather imagery',
    'live orbit map',
    'satellite pass prediction',
    'free satellite tracker online',
    'space tracker in browser',
    'Three.js satellite globe',
    'WebGL satellite tracker',
  ],
  category: 'Science',
  classification: 'Astronomy, Space, Satellite Tracking',
  referrer: 'origin-when-cross-origin',
  alternates: {
    canonical: '/',
    types: {
      'application/rss+xml': [],
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: SITE_URL,
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'Skyport — Real-time 3D satellite tracker showing Earth with the ISS, Hubble, JWST, GOES, and the Artemis II mission in orbit',
        type: 'image/png',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'Skyport — Real-time 3D satellite tracker',
      },
    ],
  },
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
        sizes: '32x32',
        type: 'image/png',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
        sizes: '32x32',
        type: 'image/png',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: [{ url: '/apple-icon.png', sizes: '180x180', type: 'image/png' }],
    shortcut: '/icon.svg',
  },
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: SITE_NAME,
    statusBarStyle: 'black-translucent',
  },
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  other: {
    'apple-mobile-web-app-title': SITE_NAME,
    'application-name': SITE_NAME,
    'msapplication-TileColor': '#0a0a0f',
    'msapplication-config': 'none',
  },
}

export const viewport: Viewport = {
  themeColor: '#0a0a0f',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
}

// JSON-LD structured data graph — tells search engines what this page actually is.
const structuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      url: SITE_URL,
      name: SITE_NAME,
      description: SITE_DESCRIPTION,
      inLanguage: 'en-US',
      publisher: { '@id': `${SITE_URL}/#organization` },
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: `${SITE_URL}/?search={search_term_string}`,
        },
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@type': 'WebApplication',
      '@id': `${SITE_URL}/#webapp`,
      name: SITE_NAME,
      alternateName: [
        'Skyport Satellite Tracker',
        'Skyport 3D Satellite Tracker',
      ],
      url: SITE_URL,
      description: SITE_DESCRIPTION,
      applicationCategory: ['ScienceApplication', 'EducationalApplication'],
      applicationSubCategory: 'Satellite Tracking',
      operatingSystem: 'Any (modern web browser)',
      browserRequirements: 'Requires WebGL-enabled browser',
      softwareVersion: '1.0',
      isAccessibleForFree: true,
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
      },
      featureList: [
        'Real-time 3D satellite tracking with SGP4 propagation',
        'Live International Space Station (ISS) position',
        'Hubble Space Telescope position tracker',
        'James Webb Space Telescope (JWST) L2 position',
        'Artemis II live mission tracking from JPL Horizons',
        'GOES-16 and GOES-18 weather satellite imagery',
        'NOAA-19, Landsat 9, and Tiangong tracking',
        'AO-91 amateur radio satellite with transponder frequencies',
        'Live Deep Space Network (DSN) status',
        'Hourly TLE updates from CelesTrak',
        'Static export, runs entirely in the browser, no login',
      ],
      author: { '@id': `${SITE_URL}/#organization` },
      creator: { '@id': `${SITE_URL}/#organization` },
      inLanguage: 'en-US',
      image: `${SITE_URL}/opengraph-image`,
      screenshot: `${SITE_URL}/opengraph-image`,
      aggregateRating: undefined,
    },
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: SITE_URL,
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/icon-dark-32x32.png`,
        width: 32,
        height: 32,
      },
    },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://celestrak.org" />
        <link rel="preconnect" href="https://www.googletagmanager.com" />
        <link rel="dns-prefetch" href="https://ssd.jpl.nasa.gov" />
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </head>
      <body
        className={`${jetbrainsMono.variable} ${vt323.variable} ${shareTechMono.variable} font-mono antialiased`}
      >
        {children}
        <GoogleAnalytics gaId="G-PBGTL2VJEW" />
      </body>
    </html>
  )
}
