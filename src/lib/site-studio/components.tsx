import type { ReactNode } from "react";
import type {
  SiteCta,
  SiteLeafNode,
  SiteSectionNode,
} from "./document";
import { resolveSectionStyle, resolveContainerStyle } from "./tokens";
import { resolveSiteAsset } from "./assets";

/** Plain helper, same rationale as siteImage: host elements in the tree. */
function ctaButton(cta: SiteCta, variant?: "primary" | "secondary" | "ghost") {
  const tone =
    variant === "secondary"
      ? { border: "1px solid currentColor", background: "transparent" }
      : variant === "ghost"
        ? { background: "transparent", textDecoration: "underline" }
        : { background: "var(--site-ink, #1a1714)", color: "var(--site-paper, #faf8f4)" };
  return (
    <a
      href={cta.href}
      style={{
        display: "inline-block",
        padding: "0.75rem 1.5rem",
        borderRadius: "0.5rem",
        fontWeight: 600,
        ...tone,
      }}
    >
      {cta.label}
    </a>
  );
}

/** Plain helper, deliberately not a component: output stays a host-element
 * tree so previews, QA, and tests inspect exactly what renders. */
function siteImage(assetId: string | undefined, alt: string | undefined, caption?: string) {
  if (!assetId) return null;
  const asset = resolveSiteAsset(assetId);
  if (!asset) {
    return (
      <div
        data-site-fallback="unknown-asset"
        style={{ border: "1px dashed currentColor", padding: "2rem", textAlign: "center" }}
      >
        Image unavailable
      </div>
    );
  }
  const resolvedAlt = alt?.trim() ? alt : asset.alt;
  // Renderer stays a dependency-free host-element tree; optimization belongs to the asset pipeline.
  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={asset.src}
      alt={resolvedAlt}
      style={{ width: "100%", height: "auto", borderRadius: "0.75rem" }}
    />
  );
  if (caption === undefined) return img;
  return (
    <figure style={{ margin: 0 }}>
      {img}
      <figcaption style={{ fontSize: "0.875rem", opacity: 0.75 }}>{caption}</figcaption>
    </figure>
  );
}

function renderLeaf(node: SiteLeafNode): ReactNode {
  switch (node.type) {
    case "hero": {
      const props = node.props;
      return (
        <div style={{ display: "grid", gap: "1.5rem", padding: "3rem 0" }}>
          {props.eyebrow ? (
            <p style={{ textTransform: "uppercase", letterSpacing: "0.08em", fontSize: "0.8rem" }}>
              {props.eyebrow}
            </p>
          ) : null}
          <h1 style={{ fontSize: "2.75rem", lineHeight: 1.1, margin: 0 }}>{props.heading}</h1>
          {props.body ? <p style={{ fontSize: "1.125rem", maxWidth: "42rem" }}>{props.body}</p> : null}
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            {props.primaryCta ? ctaButton(props.primaryCta, "primary") : null}
            {props.secondaryCta ? ctaButton(props.secondaryCta, "secondary") : null}
          </div>
          {siteImage(props.assetId, undefined)}
        </div>
      );
    }
    case "heading": {
      const props = node.props;
      if (props.level === 1)
        return <h1 style={{ fontSize: "2.25rem", lineHeight: 1.15 }}>{props.text}</h1>;
      if (props.level === 3)
        return <h3 style={{ fontSize: "1.25rem", lineHeight: 1.3 }}>{props.text}</h3>;
      return <h2 style={{ fontSize: "1.75rem", lineHeight: 1.2 }}>{props.text}</h2>;
    }
    case "text":
      return <p style={{ fontSize: "1.05rem", lineHeight: 1.65, maxWidth: "44rem" }}>{node.props.text}</p>;
    case "image": {
      const props = node.props;
      return <div>{siteImage(props.assetId, props.alt, props.caption)}</div>;
    }
    case "button":
      return (
        <div>
          {ctaButton(
            { label: node.props.label, href: node.props.href },
            node.props.variant ?? "primary",
          )}
        </div>
      );
    case "featureGrid":
      return (
        <div>
          {node.props.title ? (
            <h2 style={{ fontSize: "1.75rem", lineHeight: 1.2 }}>{node.props.title}</h2>
          ) : null}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(16rem, 1fr))",
              gap: "1.25rem",
            }}
          >
            {node.props.items.map((item) => (
              <div
                key={item.title}
                style={{ border: "1px solid currentColor", borderRadius: "0.75rem", padding: "1.25rem" }}
              >
                <h3 style={{ fontSize: "1.1rem", margin: "0 0 0.5rem" }}>{item.title}</h3>
                <p style={{ margin: 0, lineHeight: 1.55 }}>{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      );
    case "faq":
      return (
        <div>
          {node.props.title ? (
            <h2 style={{ fontSize: "1.75rem", lineHeight: 1.2 }}>{node.props.title}</h2>
          ) : null}
          {node.props.items.map((item) => (
            <details key={item.question} style={{ marginBottom: "0.75rem" }}>
              <summary style={{ fontWeight: 600, cursor: "pointer" }}>{item.question}</summary>
              <p style={{ lineHeight: 1.6 }}>{item.answer}</p>
            </details>
          ))}
        </div>
      );
    case "ctaBand": {
      const props = node.props;
      return (
        <div style={{ textAlign: "center", padding: "2rem 0" }}>
          <h2 style={{ fontSize: "2rem", lineHeight: 1.15 }}>{props.heading}</h2>
          {props.body ? <p style={{ lineHeight: 1.6 }}>{props.body}</p> : null}
          {ctaButton(props.cta, "primary")}
        </div>
      );
    }
  }
}

export function renderSection(node: SiteSectionNode): ReactNode {
  return (
    <section key={node.id} data-site-section={node.id} style={resolveSectionStyle(node.styles)}>
      <div style={resolveContainerStyle(node.styles)}>
        {node.children.map((child) => (
          <div key={child.id} data-site-node={child.id}>
            {renderLeaf(child)}
          </div>
        ))}
      </div>
    </section>
  );
}

export function renderSiteNode(node: SiteSectionNode | SiteLeafNode): ReactNode {
  if (node.type === "section") return renderSection(node);
  return renderLeaf(node as SiteLeafNode);
}
