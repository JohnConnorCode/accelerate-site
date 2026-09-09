"use client";
import { useEffect, useState, type CSSProperties } from "react";
import { WebsitePageContent } from "@/lib/site-studio/website-renderer";
import { renderNativeWebsiteSection } from "@/lib/site-studio/native-renderer";
import { parseWebsiteDocument, type WebsiteDocument } from "@/lib/site-studio/website-document";

export function WebsitePreview({ pageId }: { pageId?: string }) {
  const [document, setDocument] = useState<WebsiteDocument | null>(null);
  const [message, setMessage] = useState("Loading the saved private preview…");
  useEffect(() => {
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
  const page = document?.pages.find((candidate) => candidate.id === pageId) ?? document?.pages[0];
  return (
    <div
      data-website-preview
      className="min-h-screen"
      style={
        document
          ? ({
              background: document.theme.background,
              color: document.theme.foreground,
              "--bg": document.theme.background,
              "--fg": document.theme.foreground,
              "--paper": document.theme.background,
              "--ink": document.theme.foreground,
            } as CSSProperties)
          : undefined
      }
    >
      <p role="status">{message}</p>
      {document && page && (
        <WebsitePageContent
          page={page}
          assets={document.assets}
          renderNative={renderNativeWebsiteSection}
        />
      )}
    </div>
  );
}
