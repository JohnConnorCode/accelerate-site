import { ImageResponse } from "next/og";
import { SocialCard } from "@/components/social/SocialCard";

export const runtime = "edge";
export const alt = "Selected Work | Accelerate";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(<SocialCard eyebrow="Selected Work" title="Built for the work behind the business." description="AI-enabled operations, software products, and growth systems built around how the business actually works." />, size);
}
