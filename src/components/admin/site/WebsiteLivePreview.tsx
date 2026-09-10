"use client";
import { useEffect, useRef, useState } from "react";
import { useAdminDemo } from "@/components/admin/AdminDemoBoundary";
import { parseWebsiteDocument, type WebsiteDocument } from "@/lib/site-studio/website-document";
import { websiteButtonClass as button } from "./WebsiteFields";
export function WebsiteLivePreview({
  document,
  pageId,
}: {
  document: WebsiteDocument;
  pageId: string;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const demo = useAdminDemo();
  const [width, setWidth] = useState(1440);
  const [ready, setReady] = useState(0);
  const [invalid, setInvalid] = useState(false);
  const holder = useRef<HTMLDivElement>(null);
  const measured = useRef(false);
  const [available, setAvailable] = useState(600);
  useEffect(() => {
    const element = holder.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry && entry.contentRect.width > 0) {
        setAvailable(entry.contentRect.width);
        if (!measured.current) {
          measured.current = true;
          if (entry.contentRect.width < 500) setWidth(390);
        }
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (
        event.origin === window.location.origin &&
        event.source === frame.current?.contentWindow &&
        event.data?.type === "website-preview-ready"
      )
        setReady((value) => value + 1);
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const valid = parseWebsiteDocument(document);
        frame.current?.contentWindow?.postMessage(
          { type: "website-preview-document", document: valid, pageId },
          window.location.origin,
        );
        setInvalid(false);
      } catch {
        setInvalid(true);
      }
    }, 180);
    return () => clearTimeout(timer);
  }, [document, pageId, ready]);
  const query = new URLSearchParams({ page: pageId, live: "1" });
  if (demo) query.set("scenario", demo.scenarioId);
  const scale = Math.min(1, available / width);
  return (
    <section
      aria-label="Live page preview"
      className="min-w-0 space-y-3 lg:sticky lg:top-4 lg:self-start"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium">Live preview</span>
        <div className="flex gap-1">
          {[
            [390, "Phone"],
            [768, "Tablet"],
            [1440, "Desktop"],
          ].map(([size, label]) => (
            <button
              type="button"
              className={button}
              key={size}
              aria-pressed={width === size}
              onClick={() => setWidth(Number(size))}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {invalid && (
        <p role="status" className="text-xs text-[var(--admin-muted)]">
          Finish the current field to update the preview. Showing the last valid draft.
        </p>
      )}
      <div
        ref={holder}
        className="flex justify-center h-[70vh] min-h-96 overflow-hidden rounded-lg bg-[var(--admin-surface-subtle)] outline outline-1 outline-[var(--admin-border)]"
      >
        <iframe
          ref={frame}
          title="Live website preview"
          src={`/site-preview?${query}`}
          onLoad={() => setReady((value) => value + 1)}
          className="block shrink-0 origin-top border-0 bg-white"
          style={{
            width,
            height: `${70 / scale}vh`,
            transform: `scale(${scale})`,
          }}
        />
      </div>
      <p className="text-xs text-[var(--admin-muted)]">
        {width}px viewport · Unsaved changes are private. Links and forms are inactive in this
        preview.
      </p>
    </section>
  );
}
