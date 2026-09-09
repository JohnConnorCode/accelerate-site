"use client";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { websiteThemeStyle } from "@/lib/site-studio/website-theme";
import { useEffect, useState } from "react";
import { WebsitePageContent } from "@/lib/site-studio/website-renderer";
import { renderNativeWebsiteSection } from "@/lib/site-studio/native-renderer";
import { parseWebsiteDocument, type WebsiteDocument } from "@/lib/site-studio/website-document";

export function WebsitePreview({ pageId }: { pageId?: string }) {
  const [document, setDocument] = useState<WebsiteDocument | null>(null);
  const [message, setMessage] = useState("Loading the saved private preview…");
  const [livePage, setLivePage] = useState(pageId);
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (
        event.origin !== window.location.origin ||
        event.source !== window.parent ||
        event.data?.type !== "website-preview-document"
      )
        return;
      try {
        setDocument(parseWebsiteDocument(event.data.document));
        setLivePage(event.data.pageId);
        setMessage("Private live preview");
      } catch {
        /* Retain the last valid preview. */
      }
    };
    window.addEventListener("message", receive);
    window.parent.postMessage({ type: "website-preview-ready" }, window.location.origin);
    return () => window.removeEventListener("message", receive);
  }, []);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("live") === "1") return;
    let cancelled = false;
    void fetch("/api/admin/site/website", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "The private preview is unavailable.");
        if (!result.website.draft)
          throw new Error("Save a website draft before opening its preview.");
        const next = parseWebsiteDocument(result.website.draft.document);
        if (!cancelled) {
          setDocument(next);
          setMessage(
            `Private preview of saved revision ${result.website.version}. This is not a publication.`,
          );
        }
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setMessage(
            error instanceof Error ? error.message : "The private preview is unavailable.",
          );
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const entry = document?.collections
    .flatMap((collection) => collection.entries)
    .find((entry) => entry.id === livePage);
  const page = entry
    ? {
        id: entry.id,
        path: entry.path,
        metadata: { ...entry.metadata, title: entry.title },
        content: { kind: "article" as const, body: entry.body },
      }
    : (document?.pages.find((candidate) => candidate.id === livePage) ?? document?.pages[0]);
  return (
    <div
      onClickCapture={(event) => {
        const target = event.target as HTMLElement;
        if (target.closest("a")) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
      onSubmitCapture={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      data-website-preview
      className="min-h-screen"
      style={document ? websiteThemeStyle(document.theme) : undefined}
    >
      <p role="status" className="sr-only">
        {message}
      </p>
      {document && page && (
        <>
          <Header
            content={document.header}
            navLinks={document.navigation}
            brandName={document.identity.name}
            logoSrc={document.assets.find((a) => a.id === document.identity.logoAssetId)?.src}
          />
          <WebsitePageContent
            page={page}
            assets={document.assets}
            renderNative={renderNativeWebsiteSection}
          />
          <Footer
            content={document.footer}
            brandName={document.identity.name}
            logoSrc={document.assets.find((a) => a.id === document.identity.logoAssetId)?.src}
          />
        </>
      )}
    </div>
  );
}
