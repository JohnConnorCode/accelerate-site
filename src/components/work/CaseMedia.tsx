import Image from "next/image";
import type { WorkMedia } from "@/content/work";
import { LazyYouTube } from "./LazyYouTube";
import { WorkDiagram } from "./WorkDiagram";
import { WorkMediaReveal } from "./WorkMotion";

type MediaFrame = "edge" | "film" | "window" | "paper";
type MediaAspect = "wide" | "editorial" | "portrait" | "cinematic" | "square";

const aspectClasses: Record<MediaAspect, string> = {
  wide: "aspect-[16/10]",
  editorial: "aspect-[4/3]",
  portrait: "aspect-[4/5]",
  cinematic: "aspect-[21/11]",
  square: "aspect-square",
};

const frameClasses: Record<MediaFrame, string> = {
  edge: "rounded-[2px]",
  film: "rounded-xl shadow-[0_18px_60px_rgba(0,0,0,.18),0_2px_8px_rgba(0,0,0,.12)]",
  window: "rounded-lg shadow-[0_16px_50px_rgba(0,0,0,.14),0_2px_8px_rgba(0,0,0,.10)]",
  paper: "rounded-[3px] shadow-[0_12px_40px_rgba(0,0,0,.10)]",
};

export function CaseMedia({ media, priority = false, compact = false, inverted = false, frame = "edge", aspect = "wide", revealDelay = 0 }: { media: WorkMedia; priority?: boolean; compact?: boolean; inverted?: boolean; frame?: MediaFrame; aspect?: MediaAspect; revealDelay?: number }) {
  const usesInkCanvas = media.kind === "image" && media.canvas === "ink";
  const content = (
    <figure className="min-w-0">
      <div className={`${inverted || usesInkCanvas ? "bg-[#0b0b0b] outline-white/10" : "bg-[var(--paper)] outline-black/10 dark:outline-white/10"} ${frameClasses[frame]} overflow-hidden outline outline-1 -outline-offset-1`}>
        {media.kind === "image" ? (
          <div className={`${aspectClasses[aspect]} ${compact ? "" : aspect === "wide" || aspect === "cinematic" ? "min-h-[17rem]" : ""} relative`}>
            <Image
              src={media.src}
              alt={media.alt}
              fill
              priority={priority}
              sizes={compact ? "(min-width: 1024px) 50vw, 100vw" : "(min-width: 1280px) 1180px, 100vw"}
              className={`work-media-image ${media.fit === "contain" ? "object-contain p-3 sm:p-6" : "object-cover"}`}
              style={media.objectPosition ? { objectPosition: media.objectPosition } : undefined}
            />
          </div>
        ) : null}
        {media.kind === "diagram" ? <WorkDiagram media={media} compact={compact} inverted={inverted} /> : null}
        {media.kind === "youtube" ? <LazyYouTube media={media} priority={priority} /> : null}
      </div>
      {!compact ? <figcaption className={`${inverted ? "text-white/65" : "text-[var(--mid)]"} mt-3 text-pretty font-mono text-[9px] uppercase leading-5 tracking-[0.12em]`}>{media.caption}</figcaption> : null}
    </figure>
  );

  return <WorkMediaReveal delay={revealDelay}>{content}</WorkMediaReveal>;
}
