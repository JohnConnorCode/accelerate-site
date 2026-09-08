import { ImageResponse } from "next/og";

// Apple touch icon — paper chevrons on an ink tile, generated
// at build time so it stays in sync with the SVG favicon (src/app/icon.svg) and
// the in-page LogoMark. Ink tile (#0B0B0B) matches --ink; the old lime
// (#C6FF3D) was retired with the editorial system.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Chevron polygon coords scaled to fit 180×180 with breathing room
// (each chevron 32 wide × 80 tall, three in a row with overlap, centered).
function Chevron({ x, opacity }: { x: number; opacity: number }) {
  return (
    <svg
      width={56}
      height={80}
      viewBox="0 0 22 32"
      style={{ position: "absolute", left: x, top: 50 }}
    >
      <path d="M 0 0 L 14 0 L 22 16 L 14 32 L 0 32 L 8 16 Z" fill="#FBFBFA" fillOpacity={opacity} />
    </svg>
  );
}

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        position: "relative",
        width: 180,
        height: 180,
        background: "#0B0B0B",
      }}
    >
      <Chevron x={22} opacity={0.3} />
      <Chevron x={62} opacity={0.6} />
      <Chevron x={102} opacity={1} />
    </div>,
    { ...size },
  );
}
