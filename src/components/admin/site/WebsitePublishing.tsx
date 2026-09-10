"use client";
import { useState } from "react";
import { AdminDialog } from "@/components/admin/AdminDialog";
import type { WebsiteState } from "@/lib/site-studio/website-store";
import type { WebsiteDocument } from "@/lib/site-studio/website-document";
import type { WebsiteCommand } from "@/lib/site-studio/website-commands";
import { websiteButtonClass as button } from "./WebsiteFields";
export function WebsitePublishing({
  state,
  document,
  disabled,
  onCommand,
}: {
  state: WebsiteState;
  document: WebsiteDocument;
  disabled: boolean;
  onCommand: (command: WebsiteCommand) => void;
}) {
  const [review, setReview] = useState<"publish" | "unpublish" | "history" | null>(null);
  const [revisions, setRevisions] = useState<
    { id: string; createdAt: string; previouslyPublished: boolean }[]
  >([]);
  const [rollback, setRollback] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const command = (operation: "publish" | "unpublish" | "rollback", revisionId?: string) => {
    if (disabled) return;
    const base = { requestKey: crypto.randomUUID(), expectedVersion: state.version };
    if (operation === "unpublish") onCommand({ ...base, operation });
    else if (revisionId) onCommand({ ...base, operation, revisionId });
    setReview(null);
    setRollback(null);
  };
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-2 text-xs text-[var(--admin-muted)]">
          {state.publishedRevisionId ? "Published website" : "No published revision"}
        </span>
        <button
          className={button}
          disabled={disabled || !state.draft}
          onClick={() => setReview("publish")}
        >
          Review publication
        </button>
        <button
          className={button}
          disabled={!state.draft || loading}
          onClick={async () => {
            setReview("history");
            setLoading(true);
            setError("");
            try {
              const response = await fetch("/api/admin/site/website?history=1", {
                cache: "no-store",
              });
              const result = await response.json();
              if (!response.ok) throw new Error(result.error ?? "History unavailable");
              setRevisions(result.revisions);
            } catch {
              setError("History is unavailable. Close and retry; your edits are preserved.");
            } finally {
              setLoading(false);
            }
          }}
        >
          History
        </button>
      </div>
      <AdminDialog
        className="rounded-2xl bg-[var(--admin-surface)] text-[var(--admin-ink)] shadow-2xl"
        open={review !== null}
        onClose={() => {
          setReview(null);
          setRollback(null);
        }}
        title={review === "history" ? "Website history" : "Review publication"}
      >
        <div className="space-y-4 p-5">
          <h2 className="text-xl font-semibold">
            {review === "publish"
              ? "Publish this saved website?"
              : review === "unpublish"
                ? "Unpublish website?"
                : "Website history"}
          </h2>
          {review === "publish" && (
            <>
              <p className="text-sm">
                This makes the saved revision public. Confirm the copy, images, links and mobile
                preview before continuing.
              </p>
              <ul className="max-h-60 space-y-2 overflow-auto text-sm">
                {document.pages.map((page) => (
                  <li key={page.id}>
                    <strong>{page.metadata.title}</strong>
                    <span className="block text-[var(--admin-muted)]">
                      {page.path}
                      {page.metadata.noIndex ? " · Hidden from search" : ""}
                    </span>
                  </li>
                ))}
              </ul>
              <button
                className={button}
                disabled={disabled}
                onClick={() => command("publish", state.draft!.id)}
              >
                Publish saved revision
              </button>
            </>
          )}
          {review === "unpublish" && (
            <>
              <p className="text-sm">
                Published website content will be unavailable. Private drafts and history remain
                saved for recovery.
              </p>
              <button className={button} disabled={disabled} onClick={() => command("unpublish")}>
                Confirm unpublish
              </button>
            </>
          )}
          {review === "history" && (
            <>
              <p className="text-sm text-[var(--admin-muted)]">
                Recent saved revisions. Rollback restores a previously published version while
                preserving your current draft.
              </p>
              {state.publishedRevisionId && (
                <button
                  className={button}
                  disabled={disabled}
                  onClick={() => setReview("unpublish")}
                >
                  Unpublish
                </button>
              )}
              {loading && <p role="status">Loading history…</p>}
              {error && <p role="alert">{error}</p>}
              <ul className="max-h-80 space-y-3 overflow-auto">
                {revisions.map((revision) => (
                  <li
                    key={revision.id}
                    className="rounded-lg border border-[var(--admin-border)] p-3 text-sm"
                  >
                    <span>{new Date(revision.createdAt).toLocaleString()}</span>
                    <p className="text-xs text-[var(--admin-muted)]">
                      {revision.id === state.publishedRevisionId
                        ? "Currently published"
                        : revision.id === state.draft?.id
                          ? "Current draft"
                          : revision.previouslyPublished
                            ? "Previously published"
                            : "Saved draft"}
                    </p>
                    {revision.previouslyPublished && revision.id !== state.publishedRevisionId && (
                      <button
                        className={button}
                        disabled={disabled}
                        onClick={() => setRollback(revision.id)}
                      >
                        Review rollback
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              {rollback && (
                <div className="space-y-2 border-t border-[var(--admin-border)] pt-3">
                  <p className="text-sm">
                    Replace the public website with this previously published revision?
                  </p>
                  <button
                    className={button}
                    disabled={disabled}
                    onClick={() => command("rollback", rollback)}
                  >
                    Confirm rollback
                  </button>
                </div>
              )}
            </>
          )}
          <button
            className={button}
            onClick={() => {
              setReview(null);
              setRollback(null);
            }}
          >
            Keep editing
          </button>
        </div>
      </AdminDialog>
    </>
  );
}
