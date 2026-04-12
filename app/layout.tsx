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
const TITLE = 'Skyport | Every Satellite Above You';
const DESCRIPTION =
  'Real-time 3D satellite tracker — watch ISS, Hubble, JWST, Starlink, and Artemis II orbit Earth live. Weather imagery, NASA feeds, radio transmissions, all in your browser.';

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
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Skyport',
    url: SITE_URL,
    description: DESCRIPTION,
    applicationCategory: 'EducationalApplication',
    operatingSystem: 'Any',
    browserRequirements: 'Requires WebGL',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    author: { '@type': 'Person', name: 'Divyaman' },
    keywords: 'satellite tracker, ISS tracker, Starlink, Artemis II, 3D, real-time, space',
  };

  return (
    <html lang="en" className="dark">
      <body className={`${jetbrainsMono.variable} ${vt323.variable} ${shareTechMono.variable} font-mono antialiased`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {children}
        <GoogleAnalytics gaId="G-PBGTL2VJEW" />
      </body>
    </html>
  )
}
