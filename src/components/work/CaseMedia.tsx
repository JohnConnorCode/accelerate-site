"use client";

import Image from "next/image";
import { Maximize2 } from "lucide-react";
import type { WorkMedia } from "@/content/work";
import { LazyYouTube } from "./LazyYouTube";
import { WorkDiagram } from "./WorkDiagram";
import { WorkMediaReveal } from "./WorkMotion";
import { MediaParallax } from "@/components/motion/MediaParallax";

export type MediaFrame = "edge" | "film" | "window" | "paper";
export type MediaAspect = "wide" | "editorial" | "portrait" | "cinematic" | "square";

const aspectRatios: Record<MediaAspect, string> = {
  wide: "16 / 10",
  editorial: "4 / 3",
  portrait: "4 / 5",
  cinematic: "21 / 11",
  square: "1 / 1",
};

const frameClasses: Record<MediaFrame, string> = {
  edge: "rounded-[14px]",
  film: "rounded-[14px] shadow-[0_1px_2px_rgba(0,0,0,.04),0_16px_38px_-20px_rgba(0,0,0,.20)]",
  window: "rounded-[14px] shadow-[0_1px_2px_rgba(0,0,0,.04),0_16px_38px_-20px_rgba(0,0,0,.18)]",
  paper: "rounded-[14px] shadow-[0_1px_2px_rgba(0,0,0,.035),0_14px_34px_-20px_rgba(0,0,0,.16)]",
};

export function MediaSurface({
  media,
  priority = false,
  compact = false,
  inverted = false,
  frame = "edge",
  aspect,
  lightbox = false,
}: {
  media: WorkMedia;
  priority?: boolean;
  compact?: boolean;
  inverted?: boolean;
  frame?: MediaFrame;
  aspect?: MediaAspect;
  lightbox?: boolean;
}) {
  const usesInkCanvas = media.kind === "image" && media.canvas === "ink";
  const ratio =
    media.kind === "image"
      ? lightbox
        ? undefined
        : aspect
          ? aspectRatios[aspect]
          : `${media.width} / ${media.height}`
      : undefined;
  const surfaceClass =
    inverted || usesInkCanvas
      ? "bg-[#0b0b0b] outline-white/10"
      : "bg-[var(--bg)] outline-[var(--rule)]";

  return (
    <div
      className={`${surfaceClass} ${lightbox ? "rounded-[14px]" : frameClasses[frame]} relative overflow-hidden outline outline-1 -outline-offset-1`}
      data-media-surface
      data-media-kind={media.kind}
      data-media-fit={media.kind === "image" ? (media.fit ?? "cover") : undefined}
      data-media-presentation={media.kind === "image" ? media.presentation : undefined}
      data-media-compact={compact ? "true" : "false"}
    >
      {media.kind === "image" ? (
        lightbox ? (
          <Image
            src={media.src}
            alt={media.alt}
            width={media.width}
            height={media.height}
            priority
            sizes="100vw"
            className="max-h-[calc(100dvh-9rem)] w-auto max-w-[min(92vw,88rem)] object-contain"
          />
        ) : (
          <div
            className="relative w-full"
            style={{ aspectRatio: ratio }}
            data-media-width={media.width}
            data-media-height={media.height}
          >
            <MediaParallax distance={media.fit === "contain" ? 2.75 : compact ? 4.5 : 5.5}>
              <Image
                src={media.src}
                alt={media.alt}
                fill
                priority={priority}
                sizes={
                  compact ? "(min-width: 1024px) 50vw, 100vw" : "(min-width: 1280px) 1180px, 100vw"
                }
                className={`work-media-image ${media.fit === "contain" ? "object-contain" : "object-cover"} transition-transform duration-700 ease-out group-hover:scale-[1.025] group-focus-visible:scale-[1.025] motion-reduce:transition-none`}
                style={media.objectPosition ? { objectPosition: media.objectPosition } : undefined}
              />
            </MediaParallax>
          </div>
        )
      ) : null}
      {media.kind === "diagram" ? (
        <WorkDiagram media={media} compact={compact && !lightbox} inverted={inverted || lightbox} />
      ) : null}
      {media.kind === "youtube" ? <LazyYouTube media={media} priority={priority} /> : null}
    </div>
  );
}

export function CaseMedia({
  media,
  priority = false,
  compact = false,
  inverted = false,
  frame = "edge",
  aspect,
  reveal = true,
  revealDelay = 0,
  onOpen,
}: {
  media: WorkMedia;
  priority?: boolean;
  compact?: boolean;
  inverted?: boolean;
  frame?: MediaFrame;
  aspect?: MediaAspect;
  reveal?: boolean;
  revealDelay?: number;
  onOpen?: () => void;
}) {
  const eligible = Boolean(onOpen) && media.kind !== "youtube";
  const visual = (
    <MediaSurface
      media={media}
      priority={priority}
      compact={compact}
      inverted={inverted}
      frame={frame}
      aspect={aspect}
    />
  );

  const content = (
    <figure
      className="min-w-0"
      data-case-media={
        media.kind === "image" ? media.src : media.kind === "diagram" ? media.variant : "video"
      }
    >
      {eligible ? (
        <button
          type="button"
          onClick={onOpen}
          className="group/media relative block w-full cursor-zoom-in text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--case-accent)] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--bg)]"
          aria-label={`Open ${media.caption}`}
        >
          {visual}
          <span
            className="pointer-events-none absolute right-3 top-3 grid size-10 place-items-center rounded-full bg-black/70 text-white opacity-0 shadow-[0_8px_24px_-12px_rgba(0,0,0,.6)] backdrop-blur-sm transition-[opacity,transform] duration-200 group-hover/media:opacity-100 group-focus-visible/media:opacity-100 motion-reduce:transition-none sm:right-4 sm:top-4"
            aria-hidden="true"
          >
            <Maximize2 className="size-4" />
          </span>
        </button>
      ) : (
        visual
      )}
      {!compact ? (
        <figcaption
          className={`${inverted ? "text-white/65" : "text-[var(--mid)]"} mt-3 text-pretty font-mono text-[9px] uppercase leading-5 tracking-[0.12em]`}
        >
          {media.caption}
        </figcaption>
      ) : null}
    </figure>
  );

  return reveal ? <WorkMediaReveal delay={revealDelay}>{content}</WorkMediaReveal> : content;
}
