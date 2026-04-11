import type { MetadataRoute } from 'next'

const SITE_URL = 'https://skyport.space'

// Required for `output: 'export'` — bakes robots.txt into ./out at build time.
export const dynamic = 'force-static'
export const revalidate = false

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/_next/', '/404'],
      },
      // Be explicit with major crawlers — some engines read only their own
      // user agent block and ignore the wildcard rules above.
      {
        userAgent: 'Googlebot',
        allow: '/',
      },
      {
        userAgent: 'Googlebot-Image',
        allow: '/',
      },
      {
        userAgent: 'Bingbot',
        allow: '/',
      },
      {
        userAgent: 'DuckDuckBot',
        allow: '/',
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
