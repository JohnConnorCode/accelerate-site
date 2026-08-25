import { ImageResponse } from "next/og";
import { getWorkBySlug } from "@/content/work";

export const runtime = "edge";
export const alt = "Accelerate selected work and operating systems";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const colors = { ink: "#202020", red: "#9e1f26", blue: "#093c72", green: "#164d42", violet: "#332050", gold: "#6f501d", slate: "#182638" };

export default async function OpenGraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const project = getWorkBySlug((await params).slug);
  const color = project ? colors[project.accent] : colors.ink;
  const imageUrl = project?.cardMedia.kind === "image" ? `https://www.acceleratewith.us${project.cardMedia.src}` : undefined;
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", overflow: "hidden", background: color, color: "#fbfbfa", padding: "62px", fontFamily: "sans-serif" }}>
      {imageUrl ? <img alt="" src={imageUrl} width="1200" height="630" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.48 }} /> : null}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(120deg, rgba(0,0,0,.14), rgba(0,0,0,.7))" }} />
      <div style={{ position: "absolute", inset: 0, opacity: 0.2, backgroundImage: "linear-gradient(rgba(255,255,255,.65) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.65) 1px,transparent 1px)", backgroundSize: "56px 56px" }} />
      <div style={{ display: "flex", position: "relative", flexDirection: "column", justifyContent: "space-between", width: "100%" }}>
        <div style={{ display: "flex", fontSize: 18, letterSpacing: 4, textTransform: "uppercase", opacity: 0.84 }}>Accelerate / Selected Work</div>
        <div style={{ display: "flex", flexDirection: "column", maxWidth: "940px" }}><div style={{ display: "flex", fontSize: 66, fontWeight: 600, letterSpacing: -3, lineHeight: 0.95 }}>{project?.name ?? "Selected Work"}</div><div style={{ display: "flex", marginTop: 24, fontSize: 28, lineHeight: 1.25, maxWidth: "780px", opacity: 0.9 }}>{project?.cardHeadline ?? "Built around the real constraint."}</div></div>
      </div>
    </div>,
    size
  );
}
