import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
      <div className="star-field" />
      <div className="scanlines" />

      <div className="z-10 text-center px-4 max-w-lg">
        <div className="text-8xl font-bold mb-4">
          <span className="text-[#00FF41] glow-green">4</span>
          <span className="text-[#00D4FF] glow-cyan">0</span>
          <span className="text-[#FFB300]">4</span>
        </div>

        <div className="glass-panel p-4 rounded border border-[rgba(0,255,65,0.3)] mb-6">
          <div className="bg-[rgba(0,0,0,0.5)] p-3 rounded">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[#00FF41]">&gt;</span>
              <span className="text-muted-foreground text-xs">NAVIGATION_ERROR</span>
            </div>
            <p className="text-[#00FF41] text-sm font-mono">
              Signal lost. This orbital path does not exist.
            </p>
          </div>
        </div>

        <p className="text-muted-foreground text-sm mb-6">
          The page you&apos;re looking for has drifted out of range.
          <br />
          Return to mission control to track satellites in real time.
        </p>

        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 rounded border border-[#00FF41] text-[#00FF41] hover:bg-[rgba(0,255,65,0.1)] transition-colors text-sm font-mono"
        >
          <span>&gt;</span> Return to Skyport
        </Link>

        <div className="mt-8 text-muted-foreground text-xs space-y-1">
          <p>Skyport — Real-time 3D satellite tracker</p>
          <p>Track ISS, Hubble, JWST, Starlink, Tiangong, and Artemis II live in your browser.</p>
        </div>
      </div>
    </div>
  );
}
