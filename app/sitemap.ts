import type { MetadataRoute } from 'next'

const SITE_URL = 'https://skyport.space'

// Required for `output: 'export'` — bakes sitemap.xml into ./out at build time.
export const dynamic = 'force-static'
export const revalidate = false

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  return [
    {
      url: `${SITE_URL}/`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1.0,
    },
  ]
}
