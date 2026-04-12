// Twitter Card image — identical to the OpenGraph image so the Twitter
// crawler never falls back to a missing or mismatched thumbnail.
export { default, alt, size, contentType } from './opengraph-image'

// Re-exports don't carry Next.js route segment config through, so repeat them
// here for `output: 'export'` compatibility.
export const dynamic = 'force-static'
export const revalidate = false
