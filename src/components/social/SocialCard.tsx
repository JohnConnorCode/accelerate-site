type SocialCardProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  imageUrl?: string;
  accent?: string;
};

export function SocialCard({ eyebrow = "ACCELERATE", title, description, imageUrl, accent = "#0b0b0b" }: SocialCardProps) {
  const hasImage = Boolean(imageUrl);
  return (
    <div style={{ display: "flex", width: "100%", height: "100%", position: "relative", overflow: "hidden", background: "#f7f6f1", color: "#0b0b0b", fontFamily: "Arial, sans-serif" }}>
      <div style={{ position: "absolute", inset: 0, opacity: 0.34, backgroundImage: "linear-gradient(rgba(11,11,11,.08) 1px,transparent 1px),linear-gradient(90deg,rgba(11,11,11,.08) 1px,transparent 1px)", backgroundSize: "48px 48px" }} />
      <div style={{ display: "flex", width: hasImage ? "63%" : "100%", height: "100%", position: "relative", flexDirection: "column", justifyContent: "space-between", padding: "58px 62px 52px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ display: "flex", fontSize: 30, fontWeight: 700, letterSpacing: -5 }}>»»</div>
          <div style={{ display: "flex", fontSize: 17, fontWeight: 700, letterSpacing: 5 }}>ACCELERATE</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", maxWidth: hasImage ? 680 : 980 }}>
          <div style={{ display: "flex", color: accent, fontSize: 16, fontWeight: 700, letterSpacing: 4, textTransform: "uppercase", marginBottom: 24 }}>{eyebrow}</div>
          <div style={{ display: "flex", fontSize: title.length > 52 ? 62 : 76, fontWeight: 700, lineHeight: 0.96, letterSpacing: -3.5 }}>{title}</div>
          {description ? <div style={{ display: "flex", marginTop: 24, maxWidth: 760, fontSize: 24, lineHeight: 1.35, color: "#45453f" }}>{description}</div> : null}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "2px solid #0b0b0b", paddingTop: 18, fontSize: 14, fontWeight: 700, letterSpacing: 2.5, textTransform: "uppercase" }}>
          <span>Strategy · Systems · Execution</span><span>acceleratewith.us</span>
        </div>
      </div>
      {hasImage ? <div style={{ display: "flex", position: "relative", width: "37%", margin: "34px 34px 34px 0", overflow: "hidden", borderRadius: 26, background: accent }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt="" src={imageUrl} width="444" height="562" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        <div style={{ position: "absolute", inset: 0, boxShadow: "inset 0 0 0 1px rgba(255,255,255,.16)" }} />
      </div> : null}
    </div>
  );
}
