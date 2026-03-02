"use client";

/**
 * CSS-only scroll progress indicator using animation-timeline: scroll().
 * Falls back gracefully in browsers that don't support it (bar stays hidden).
 */
export function ScrollProgressBar() {
  return (
    <div
      className="scroll-progress-bar"
      role="progressbar"
      aria-label="Page scroll progress"
    />
  );
}
