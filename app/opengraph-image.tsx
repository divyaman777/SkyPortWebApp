import { ImageResponse } from 'next/og'

// Required for `output: 'export'` — bakes the PNG into ./out at build time
// rather than trying to render it per-request.
export const dynamic = 'force-static'
export const revalidate = false

// Route segment metadata — Next.js uses this for the generated file.
export const alt =
  'Skyport — Real-time 3D satellite tracker showing Earth, the ISS, JWST, GOES weather sats, and the Artemis II lunar mission'
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = 'image/png'

// Runs at build time under `output: 'export'` and bakes the PNG into ./out.
export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px 72px',
          color: '#e0e0e0',
          fontFamily:
            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
          background: '#05060b',
          backgroundImage: [
            'radial-gradient(circle at 18% 28%, rgba(0,212,255,0.22), transparent 42%)',
            'radial-gradient(circle at 82% 72%, rgba(0,255,65,0.18), transparent 46%)',
            'radial-gradient(circle at 50% 120%, rgba(255,179,0,0.12), transparent 55%)',
            'linear-gradient(180deg, #05060b 0%, #0a0a0f 55%, #05060b 100%)',
          ].join(','),
        }}
      >
        {/* Top row — terminal chrome */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            fontSize: 22,
            letterSpacing: 2,
            color: '#00FF41',
            opacity: 0.85,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: 7,
                background: '#ff5f56',
              }}
            />
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: 7,
                background: '#ffbd2e',
              }}
            />
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: 7,
                background: '#27c93f',
              }}
            />
          </div>
          <div style={{ display: 'flex' }}>~/skyport.space</div>
          <div style={{ display: 'flex', marginLeft: 'auto', color: '#00D4FF' }}>
            LIVE · 3D · NO-LOGIN
          </div>
        </div>

        {/* Middle — wordmark + tagline */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            marginTop: 8,
          }}
        >
          <div
            style={{
              display: 'flex',
              fontSize: 168,
              lineHeight: 1,
              fontWeight: 900,
              letterSpacing: -4,
            }}
          >
            <span style={{ color: '#00FF41' }}>SKY</span>
            <span style={{ color: '#00D4FF' }}>PORT</span>
          </div>

          <div
            style={{
              display: 'flex',
              marginTop: 28,
              fontSize: 42,
              lineHeight: 1.15,
              color: '#e0e0e0',
              maxWidth: 1000,
            }}
          >
            Every broadcasting satellite above you — live in 3D.
          </div>

          <div
            style={{
              display: 'flex',
              marginTop: 14,
              fontSize: 28,
              color: '#8a8f99',
              maxWidth: 1050,
            }}
          >
            ISS · Hubble · JWST · GOES · Landsat · Tiangong · Artemis II
          </div>
        </div>

        {/* Bottom bar — data sources + URL */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 24,
            paddingTop: 24,
            borderTop: '1px solid rgba(0,255,65,0.25)',
          }}
        >
          <div style={{ display: 'flex', color: '#00FF41' }}>
            NASA · CelesTrak · JPL Horizons
          </div>
          <div style={{ display: 'flex', color: '#00D4FF' }}>
            skyport.space
          </div>
        </div>
      </div>
    ),
    { ...size },
  )
}
