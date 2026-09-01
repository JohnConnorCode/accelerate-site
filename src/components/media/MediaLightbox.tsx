"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { WorkMedia } from "@/content/work";
import { MediaSurface } from "@/components/work/CaseMedia";

/** Shared full-screen media viewer: portaled, focus-trapped, arrow-key and
    swipe-free keyboard navigation, one instance for every page that opens
    a set of images into a lightbox (Work case studies, product
    screenshots, anywhere else that adopts this instead of rolling its own
    modal). Extracted from the Work portfolio's gallery so every consumer
    shares one focus-trap and portal implementation instead of each page
    reimplementing it slightly differently. */
export function mediaKey(media: WorkMedia) {
  if (media.kind === "image") return media.src;
  if (media.kind === "diagram") return media.variant;
  return `youtube-${media.youtubeId}`;
}

export function MediaLightbox({
  media,
  activeIndex,
  groupLabel,
  onIndexChange,
  onClose,
  returnFocus,
}: {
  media: WorkMedia[];
  activeIndex: number | null;
  groupLabel: string;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  returnFocus: React.RefObject<HTMLElement | null>;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const reduceMotion = useReducedMotion();
  const active = activeIndex === null ? null : media[activeIndex];
  const isOpen = activeIndex !== null;

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    const returnTarget = returnFocus.current;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "Tab") {
        const dialog = document.querySelector<HTMLElement>("[data-media-lightbox-dialog]");
        const focusable = dialog
          ? [
              ...dialog.querySelectorAll<HTMLElement>(
                'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
              ),
            ]
          : [];
        if (!focusable.length) return;
        const first = focusable[0]!;
        const last = focusable.at(-1)!;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      returnTarget?.focus();
    };
  }, [isOpen, onClose, returnFocus]);

  useEffect(() => {
    if (!isOpen || activeIndex === null || media.length < 2) return;
    const onArrowKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") onIndexChange((activeIndex - 1 + media.length) % media.length);
      if (event.key === "ArrowRight") onIndexChange((activeIndex + 1) % media.length);
    };
    document.addEventListener("keydown", onArrowKey);
    return () => document.removeEventListener("keydown", onArrowKey);
  }, [activeIndex, isOpen, media.length, onIndexChange]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence initial={false}>
      {active ? (
        <motion.div
          className="fixed inset-0 z-[10000] grid place-items-center bg-black/88 p-3 backdrop-blur-xl sm:p-6"
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.18 }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose();
          }}
          data-media-lightbox
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={`${groupLabel} image viewer`}
            className="relative flex max-h-[calc(100dvh-1.5rem)] w-full max-w-[92rem] flex-col items-center justify-center rounded-[18px] bg-[#111110]/94 p-3 text-white shadow-[0_30px_90px_-36px_rgba(0,0,0,.85)] ring-1 ring-white/10 sm:max-h-[calc(100dvh-3rem)] sm:p-5"
            initial={reduceMotion ? false : { opacity: 0, y: 10, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.99 }}
            transition={{ type: "spring", duration: reduceMotion ? 0 : 0.3, bounce: 0 }}
            onMouseDown={(event) => event.stopPropagation()}
            data-media-lightbox-dialog
          >
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              className="absolute right-3 top-3 z-10 grid size-11 place-items-center rounded-full bg-black/72 text-white ring-1 ring-white/16 backdrop-blur-sm transition-[background-color,transform] duration-150 hover:bg-black active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:right-4 sm:top-4"
              aria-label="Close image viewer"
            >
              <X className="size-5" />
            </button>

            <div
              key={mediaKey(active)}
              className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-[12px]"
              data-media-lightbox-active={mediaKey(active)}
            >
              <MediaSurface media={active} inverted lightbox />
            </div>

            <div className="mt-3 flex w-full items-center justify-between gap-3 px-1 sm:mt-4">
              <div className="min-w-0">
                <p className="truncate text-pretty text-sm text-white/82">{active.caption}</p>
                <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.14em] text-white/45">
                  {groupLabel}
                </p>
              </div>
              <span className="shrink-0 font-mono text-[10px] tabular-nums tracking-[0.12em] text-white/55">
                {activeIndex! + 1} / {media.length}
              </span>
            </div>

            {media.length > 1 ? (
              <>
                <button
                  type="button"
                  onClick={() => onIndexChange((activeIndex! - 1 + media.length) % media.length)}
                  className="absolute left-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-black/72 text-white ring-1 ring-white/16 backdrop-blur-sm transition-[background-color,transform] duration-150 hover:bg-black active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:left-4"
                  aria-label="Previous image"
                >
                  <ChevronLeft className="size-5 -translate-x-px" />
                </button>
                <button
                  type="button"
                  onClick={() => onIndexChange((activeIndex! + 1) % media.length)}
                  className="absolute right-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-black/72 text-white ring-1 ring-white/16 backdrop-blur-sm transition-[background-color,transform] duration-150 hover:bg-black active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:right-4"
                  aria-label="Next image"
                >
                  <ChevronRight className="size-5 translate-x-px" />
                </button>
              </>
            ) : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
