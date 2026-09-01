"use client";

import Image from "next/image";
import { useCallback, useState } from "react";
import type { WorkVideo } from "@/content/work";

export function LazyYouTube({ media, priority = false }: { media: WorkVideo; priority?: boolean }) {
  const [playing, setPlaying] = useState(false);
  const hydrationRef = useCallback((node: HTMLDivElement | null) => {
    if (node) node.dataset.lazyVideoHydrated = "true";
  }, []);

  return (
    <div
      ref={hydrationRef}
      className="relative aspect-video overflow-hidden bg-black"
      data-lazy-video={media.youtubeId}
    >
      {playing ? (
        <iframe
          className="absolute inset-0 size-full"
          src={`https://www.youtube-nocookie.com/embed/${media.youtubeId}?autoplay=1&rel=0`}
          title={media.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          className="group absolute inset-0 size-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white"
          aria-label={`Play ${media.title}`}
        >
          <Image
            src={media.poster}
            alt=""
            fill
            priority={priority}
            sizes="(min-width: 1024px) 80vw, 100vw"
            className="object-cover opacity-90 transition-[opacity,transform] duration-300 ease-out group-hover:scale-[1.015] group-hover:opacity-100 motion-reduce:transition-none"
          />
          <span className="absolute inset-0 bg-black/20 transition-colors group-hover:bg-black/10 motion-reduce:transition-none" />
          <span className="absolute left-1/2 top-1/2 grid size-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/70 bg-black/70 text-white shadow-lg transition-transform duration-200 group-hover:scale-105 motion-reduce:transition-none sm:size-20">
            <span aria-hidden="true" className="ml-1 text-2xl">
              ▶
            </span>
          </span>
          <span className="absolute bottom-4 left-4 bg-black/75 px-3 py-2 font-mono text-[9px] uppercase tracking-[0.14em] text-white">
            Play motion study
          </span>
        </button>
      )}
    </div>
  );
}
