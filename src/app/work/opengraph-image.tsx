import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Selected Work | Accelerate";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(<div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "62px", background: "#202020", color: "#fbfbfa", fontFamily: "sans-serif", backgroundImage: "linear-gradient(rgba(255,255,255,.12) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.12) 1px,transparent 1px)", backgroundSize: "56px 56px" }}><div style={{ display: "flex", fontSize: 18, letterSpacing: 4, textTransform: "uppercase", opacity: .84 }}>Accelerate / Selected Work</div><div style={{ display: "flex", flexDirection: "column", maxWidth: "900px" }}><div style={{ display: "flex", fontSize: 92, lineHeight: .88, letterSpacing: -5, fontWeight: 600 }}>Built around the real constraint.</div><div style={{ display: "flex", marginTop: 26, fontSize: 28, lineHeight: 1.3, maxWidth: "760px", opacity: .84 }}>Systems, products, operations, and growth work by the people behind Accelerate.</div></div></div>, size);
}
