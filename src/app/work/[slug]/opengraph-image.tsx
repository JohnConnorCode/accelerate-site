import { ImageResponse } from "next/og";
import { getWorkBySlug } from "@/content/work";
import { SocialCard } from "@/components/social/SocialCard";

export const runtime = "edge";
export const alt = "Accelerate selected work and operating systems";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const colors = { ink: "#202020", red: "#9e1f26", blue: "#093c72", green: "#164d42", violet: "#332050", gold: "#6f501d", slate: "#182638" };

export default async function OpenGraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const project = getWorkBySlug((await params).slug);
  const color = project ? colors[project.accent] : colors.ink;
  const imageUrl = project?.cardMedia.kind === "image" ? `https://www.acceleratewith.us${project.cardMedia.src}` : undefined;
  return new ImageResponse(<SocialCard eyebrow="Selected Work" title={project?.name ?? "Selected Work"} description={project?.cardHeadline ?? "Built around the real constraint."} imageUrl={imageUrl} accent={color} />, size);
}
