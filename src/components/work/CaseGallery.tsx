"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { WorkMedia, WorkVisualBlock } from "@/content/work";
import { CaseMedia, type MediaAspect, type MediaFrame } from "./CaseMedia";
import { MediaLightbox, mediaKey } from "@/components/media/MediaLightbox";

export function CaseGallery({
  media,
  layout = "single",
  inverted = false,
  frame = "edge",
  priority = false,
  groupLabel,
}: {
  media: WorkMedia[];
  layout?: WorkVisualBlock["layout"];
  inverted?: boolean;
  frame?: MediaFrame;
  priority?: boolean;
  groupLabel: string;
}) {
  const eligibleMedia = useMemo(() => media.filter((item) => item.kind !== "youtube"), [media]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const closeLightbox = useCallback(() => setActiveIndex(null), []);
  const gridClass =
    layout === "single"
      ? "grid-cols-1"
      : layout === "interface-grid"
        ? "lg:grid-cols-12"
        : layout === "triptych" || layout === "filmstrip"
          ? "lg:grid-cols-3"
          : "lg:grid-cols-2";

  return (
    <>
      <div
        className={`grid items-start gap-6 sm:gap-8 ${gridClass}`}
        data-case-gallery={groupLabel}
      >
        {media.map((item, index) => {
          const lightboxIndex = eligibleMedia.findIndex(
            (candidate) => mediaKey(candidate) === mediaKey(item),
          );
          const interfaceSpan =
            layout !== "interface-grid"
              ? ""
              : index === 0
                ? "lg:col-span-12"
                : media.length === 4
                  ? "lg:col-span-4"
                  : "lg:col-span-6";
          const photoAspect: MediaAspect | undefined =
            layout === "filmstrip" ? "portrait" : undefined;
          return (
            <div key={mediaKey(item)} className={interfaceSpan}>
              <CaseMedia
                media={item}
                priority={priority && index === 0}
                inverted={inverted}
                frame={frame}
                aspect={photoAspect}
                revealDelay={Math.min(index * 0.08, 0.24)}
                onOpen={
                  item.kind === "youtube"
                    ? undefined
                    : () => {
                        returnFocus.current = document.activeElement as HTMLElement;
                        setActiveIndex(lightboxIndex);
                      }
                }
              />
            </div>
          );
        })}
      </div>
      <MediaLightbox
        media={eligibleMedia}
        activeIndex={activeIndex}
        groupLabel={groupLabel}
        onIndexChange={setActiveIndex}
        onClose={closeLightbox}
        returnFocus={returnFocus}
      />
    </>
  );
}
