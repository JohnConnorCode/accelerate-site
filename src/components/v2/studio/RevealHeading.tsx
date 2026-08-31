"use client";

import { Children, Fragment, isValidElement } from "react";
import type { CSSProperties, ReactNode } from "react";
import { useRevealLifecycle } from "@/components/motion/useReveal";

/* ──────────────────────────────────────────────────────────────────────────
   Word-by-word heading reveal — the single source of truth for animated
   headings across the site. A heading rises into place WORD BY WORD (each word
   climbs out from behind a clip mask, staggered), reading as a deliberate,
   cinematic entrance instead of one flat fade.

   • <WordMask tokens=…>  — low-level: renders pre-tokenized words. Used by both
     RevealHeading (string in) and the `Heading` primitive (children in).
   • <RevealHeading lead accent> — convenience for `lead` + gold-italic `accent`.
   • childrenToTokens(children) — flatten JSX (strings + `.display-italic`
     spans) into tokens so existing `<Heading>` call-sites animate unchanged.

   IMPORTANT: animated headings must NOT use the `.display-1/2/3` classes — those
   are claimed by the CSS section-reveal system and would double-animate. Pass
   `.display-hero` / a `text-[…]` recipe via className instead, and the element
   carries `reveal-self` so the section-reveal content-cascade skips it.
   ────────────────────────────────────────────────────────────────────────── */

export interface WordToken {
  w: string;
  italic?: boolean;
}

/** Rebuild readable markup from tokens (reduced-motion / no-anim fallback). */
function renderPlain(tokens: WordToken[]): ReactNode {
  return tokens.map((t, i) => (
    <Fragment key={i}>
      {t.italic ? <span className="display-italic">{t.w}</span> : t.w}
      {i < tokens.length - 1 ? " " : null}
    </Fragment>
  ));
}

export function WordMask({
  tokens,
  as = "h2",
  className = "",
  stagger = 0.055,
  delay = 0.08,
  entrance = "self",
}: {
  tokens: WordToken[];
  as?: "h1" | "h2" | "h3";
  className?: string;
  stagger?: number;
  delay?: number;
  /** Use `parent` only inside PublicHeroEntrance's shared lifecycle. */
  entrance?: "self" | "parent";
}) {
  const Tag = as;
  const ref = useRevealLifecycle<HTMLHeadingElement>({ initialViewport: "immediate" });

  if (tokens.length === 0) {
    return <Tag ref={entrance === "self" ? ref : undefined} className={`reveal-self word-mask-heading ${className}`}>{renderPlain(tokens)}</Tag>;
  }

  return (
    <Tag ref={entrance === "self" ? ref : undefined} className={`reveal-self word-mask-heading ${className}`} data-motion-role="heading" data-hero-heading={entrance === "parent" ? "true" : undefined}>
      {tokens.map((t, i) => (
        <Fragment key={i}>
          {/* mask: clip-path preserves the true text baseline (unlike overflow-hidden
              which forces baseline to bottom margin edge). inset prevents clipping italics
              tails horizontally but hides it vertically. */}
          <span
            className="word-mask-word inline-block pb-[0.18em] -mb-[0.18em]"
            style={{ clipPath: "inset(-10% -10% 0 -10%)", "--word-delay": `${delay + i * stagger}s` } as CSSProperties}
          >
            <span className={`inline-block ${t.italic ? "display-italic" : ""}`}>
              {t.w}
            </span>
          </span>
          {i < tokens.length - 1 ? " " : null}
        </Fragment>
      ))}
    </Tag>
  );
}

/** Flatten heading children (plain strings + `.display-italic` spans) into
 *  word tokens. Returns null if children contain anything we can't safely
 *  tokenize, so the caller can fall back to rendering them as-is. */
export function childrenToTokens(children: ReactNode): WordToken[] | null {
  const tokens: WordToken[] = [];
  let ok = true;

  const pushWords = (text: string, italic: boolean) => {
    text.trim().split(/\s+/).filter(Boolean).forEach((w) => tokens.push({ w, italic }));
  };

  Children.forEach(children, (child) => {
    if (child == null || typeof child === "boolean") return;
    if (typeof child === "string" || typeof child === "number") {
      pushWords(String(child), false);
      return;
    }
    if (isValidElement(child)) {
      const props = child.props as { className?: string; children?: ReactNode };
      const isItalic = typeof props.className === "string" && props.className.includes("display-italic");
      let elemOk = isItalic; // only know how to tokenize the gold-italic accent span
      if (isItalic) {
        Children.forEach(props.children, (sub) => {
          if (typeof sub === "string" || typeof sub === "number") pushWords(String(sub), true);
          else elemOk = false;
        });
      }
      if (!elemOk) ok = false;
      return;
    }
    ok = false;
  });

  return ok ? tokens : null;
}

export function RevealHeading({
  lead,
  accent,
  as = "h2",
  className = "",
  stagger = 0.055,
  delay = 0.08,
  entrance = "self",
}: {
  lead: string;
  accent?: string;
  as?: "h1" | "h2" | "h3";
  className?: string;
  stagger?: number;
  delay?: number;
  entrance?: "self" | "parent";
}) {
  const tokens: WordToken[] = [
    ...lead.trim().split(/\s+/).filter(Boolean).map((w) => ({ w, italic: false })),
    ...(accent ? accent.trim().split(/\s+/).filter(Boolean).map((w) => ({ w, italic: true })) : []),
  ];
  return <WordMask tokens={tokens} as={as} className={className} stagger={stagger} delay={delay} entrance={entrance} />;
}
