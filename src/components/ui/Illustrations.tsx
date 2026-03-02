"use client";

/**
 * Abstract geometric pattern for section backgrounds.
 * Subtle grid with highlighted intersection points.
 */
export function GridPattern({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 400" fill="none" className={className} aria-hidden="true">
      <defs>
        <radialGradient id="grid-dot">
          <stop offset="0%" stopColor="#D4AF37" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#D4AF37" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Grid lines */}
      {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <g key={`grid${i}`}>
          <line x1={i * 50} y1="0" x2={i * 50} y2="400" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
          <line x1="0" y1={i * 50} x2="400" y2={i * 50} stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
        </g>
      ))}

      {/* Highlighted intersections */}
      {[
        [100, 100], [300, 100], [200, 200], [100, 300], [300, 300],
        [150, 150], [250, 250], [350, 150], [50, 250],
      ].map(([cx, cy], i) => (
        <g key={`dot${i}`}>
          <circle cx={cx} cy={cy} r="12" fill="url(#grid-dot)" />
          <circle cx={cx} cy={cy} r="2" fill="#D4AF37" opacity="0.5" />
        </g>
      ))}

      {/* Connecting lines between some dots */}
      {[
        [100, 100, 200, 200], [200, 200, 300, 100], [200, 200, 300, 300],
        [200, 200, 100, 300], [150, 150, 250, 250],
      ].map(([x1, y1, x2, y2], i) => (
        <line key={`conn${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(212,175,55,0.08)" strokeWidth="1" />
      ))}
    </svg>
  );
}
