import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const title = searchParams.get("title") || "Accelerate";
  const subtitle = searchParams.get("subtitle") || "AI Strategy & Systems for Small Business";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          background: "linear-gradient(145deg, #0a0a0a 0%, #111111 50%, #0d0d0d 100%)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Gold gradient orb top-right */}
        <div
          style={{
            position: "absolute",
            top: "-120px",
            right: "-80px",
            width: "500px",
            height: "500px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(212,175,55,0.12) 0%, transparent 70%)",
          }}
        />

        {/* Gold gradient orb bottom-left */}
        <div
          style={{
            position: "absolute",
            bottom: "-150px",
            left: "-100px",
            width: "450px",
            height: "450px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(245,216,120,0.08) 0%, transparent 70%)",
          }}
        />

        {/* Subtle grid pattern */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />

        {/* Content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: "60px 80px",
            position: "relative",
            zIndex: 1,
            maxWidth: "100%",
          }}
        >
          {/* Logo */}
          <div
            style={{
              fontSize: "32px",
              fontWeight: 700,
              background: "linear-gradient(135deg, #d4af37, #f5d77a)",
              backgroundClip: "text",
              color: "transparent",
              marginBottom: "40px",
              letterSpacing: "-0.5px",
            }}
          >
            Accelerate
          </div>

          {/* Title */}
          <div
            style={{
              fontSize: title.length > 40 ? "48px" : "56px",
              fontWeight: 700,
              color: "#ffffff",
              lineHeight: 1.15,
              marginBottom: "20px",
              maxWidth: "900px",
              letterSpacing: "-1px",
            }}
          >
            {title}
          </div>

          {/* Subtitle */}
          <div
            style={{
              fontSize: "24px",
              color: "rgba(255,255,255,0.55)",
              lineHeight: 1.4,
              maxWidth: "700px",
            }}
          >
            {subtitle}
          </div>

          {/* Gold line accent */}
          <div
            style={{
              width: "80px",
              height: "3px",
              background: "linear-gradient(90deg, #d4af37, #f5d77a)",
              borderRadius: "2px",
              marginTop: "40px",
            }}
          />
        </div>

        {/* Bottom border accent */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "4px",
            background: "linear-gradient(90deg, transparent, #d4af37, #f5d77a, #d4af37, transparent)",
          }}
        />
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
