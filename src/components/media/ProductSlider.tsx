"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { MediaLightbox } from "@/components/media/MediaLightbox";
import type { ProductScreenshot } from "@/content/product-screenshots";

const AUTOPLAY_MS = 5000;
const SWIPE_THRESHOLD_PX = 40;

/** A track-based slider: every slide stays mounted side by side and the
    track translates, so there is never a mount/unmount gap between slides
    (the cause of a white flash with a crossfade-and-remount approach).
    The same layout naturally supports touch swipe and shares one click-to-
    expand lightbox with the rest of the site instead of building a second
    one. */
export function ProductSlider({
  slides,
  groupLabel = "Product screens",
  className,
}: {
  slides: ProductScreenshot[];
  groupLabel?: string;
  className?: string;
}) {
  const [index, setIndex] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const reduced = useReducedMotion();
  const returnFocus = useRef<HTMLElement | null>(null);
  const touchStartX = useRef<number | null>(null);
  const paused = useRef(false);

  const go = (delta: number) => {
    setIndex((current) => (current + delta + slides.length) % slides.length);
  };

  useEffect(() => {
    if (reduced || slides.length < 2) return;
    const id = setInterval(() => {
      if (!paused.current) go(1);
    }, AUTOPLAY_MS);
    return () => clearInterval(id);
    // go() only depends on slides.length, which is effectively static for a
    // given slider instance; re-subscribing per render would restart the
    // timer on every state change instead of just once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, slides.length]);

  const openLightbox = (i: number) => {
    returnFocus.current = document.activeElement as HTMLElement;
    setLightboxIndex(i);
  };

  const slide = slides[index]!;

  return (
    <div className={className}>
      <div
        className="group relative aspect-[1400/875] overflow-hidden rounded-[14px] border border-[color-mix(in_srgb,var(--fg)_14%,transparent)] shadow-[0_20px_60px_-20px_rgba(0,0,0,0.35)]"
        onMouseEnter={() => (paused.current = true)}
        onMouseLeave={() => (paused.current = false)}
        onTouchStart={(event) => {
          paused.current = true;
          touchStartX.current = event.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(event) => {
          paused.current = false;
          const startX = touchStartX.current;
          touchStartX.current = null;
          if (startX === null) return;
          const endX = event.changedTouches[0]?.clientX ?? startX;
          const delta = endX - startX;
          if (delta > SWIPE_THRESHOLD_PX) go(-1);
          else if (delta < -SWIPE_THRESHOLD_PX) go(1);
        }}
      >
        <motion.div
          className="flex h-full"
          style={{ width: `${slides.length * 100}%` }}
          animate={{ x: `-${(index * 100) / slides.length}%` }}
          transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 320, damping: 34 }}
        >
          {slides.map((s, i) => (
            <button
              key={s.src}
              type="button"
              onClick={() => openLightbox(i)}
              aria-label={`Open ${s.caption} in full screen`}
              className="relative h-full shrink-0 cursor-zoom-in"
              style={{ width: `${100 / slides.length}%` }}
            >
              <Image
                src={s.src}
                alt={s.alt}
                fill
                sizes="(min-width: 1024px) 46vw, 90vw"
                className="object-cover"
                priority={i === 0}
                draggable={false}
              />
            </button>
          ))}
        </motion.div>

        {slides.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Previous screen"
              className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white opacity-70 backdrop-blur-sm transition-opacity focus-visible:opacity-100 group-hover:opacity-100 sm:opacity-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Next screen"
              className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white opacity-70 backdrop-blur-sm transition-opacity focus-visible:opacity-100 group-hover:opacity-100 sm:opacity-0"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        )}
      </div>

      {slides.length > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          {slides.map((s, i) => (
            <button
              key={s.src}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Show slide ${i + 1} of ${slides.length}`}
              aria-current={i === index}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === index
                  ? "w-6 bg-[var(--fg)]"
                  : "w-1.5 bg-[color-mix(in_srgb,var(--fg)_22%,transparent)]",
              )}
            />
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
        <p className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-white-muted">
          {slide.caption}
        </p>
        <Link
          href={slide.demoHref}
          data-cursor="link"
          className="inline-flex items-center gap-1 font-mono text-[0.6rem] uppercase tracking-[0.18em] text-white-muted underline-offset-4 transition-colors hover:text-gold hover:underline"
        >
          Try it live
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>

      <MediaLightbox
        media={slides}
        activeIndex={lightboxIndex}
        groupLabel={groupLabel}
        onIndexChange={setLightboxIndex}
        onClose={() => setLightboxIndex(null)}
        returnFocus={returnFocus}
      />
    </div>
  );
}
