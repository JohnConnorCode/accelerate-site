import { tenant } from "@/config/tenant";
import { distributionProfile } from "@/lib/distribution/profile";
import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { SocialCard } from "@/components/social/SocialCard";

export const runtime = "edge";

function clean(value: string | null, fallback: string, max: number) {
  return (value?.replace(/\s+/g, " ").trim() || fallback).slice(0, max);
}

export function GET(request: NextRequest) {
  const neutral = distributionProfile() === "neutral";
  const title = clean(
    request.nextUrl.searchParams.get("title"),
    neutral ? tenant.brand.name : "Build the right system for the business.",
    110,
  );
  const description = clean(
    request.nextUrl.searchParams.get("description") || request.nextUrl.searchParams.get("subtitle"),
    neutral
      ? tenant.brand.tagline
      : "AI strategy, custom systems, and execution built around how the business actually works.",
    190,
  );
  const eyebrow = clean(
    request.nextUrl.searchParams.get("eyebrow"),
    neutral ? tenant.brand.name : "AI-ENABLED OPERATIONS",
    52,
  );
  return new ImageResponse(
    <SocialCard
      eyebrow={eyebrow}
      title={title}
      description={description}
      businessName={neutral ? tenant.brand.name : undefined}
      businessDomain={neutral ? tenant.brand.domain : undefined}
      businessTagline={neutral ? tenant.brand.tagline : undefined}
    />,
    {
      width: 1200,
      height: 630,
      headers: { "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800" },
    },
  );
}
