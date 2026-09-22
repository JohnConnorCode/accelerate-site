"use client";

import { useEffect, useRef, useState } from "react";
import { Download, FilePenLine, RefreshCw, WifiOff, X } from "lucide-react";
import { trackWorkspaceEvent } from "@/lib/analytics";
import {
  listOfflineDrafts,
  readOfflineSnapshot,
  saveOfflineDraft,
  saveOfflineSnapshot,
  type OfflineDraft,
  type OfflineSnapshot,
} from "@/lib/admin/offline-store";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type Props = {
  tenantSlug: string;
  userId: string;
  enabled: boolean;
};

function isStandalone() {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  const safariStandalone = (navigator as Navigator & { standalone?: boolean }).standalone;
  return window.matchMedia("(display-mode: standalone)").matches || safariStandalone === true;
}

function isIosSafari() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && /safari/i.test(navigator.userAgent);
}

function isCommandCenterHost() {
  if (typeof window === "undefined") return false;
  const configuredOrigin = process.env.NEXT_PUBLIC_COMMAND_CENTER_ORIGIN?.trim();
  if (!configuredOrigin)
    return window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  try {
    return window.location.host === new URL(configuredOrigin).host;
  } catch {
    return false;
  }
}

export function CommandCenterPwa({ tenantSlug, userId, enabled }: Props) {
  const [online, setOnline] = useState(true);
  const [hostEligible, setHostEligible] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installHelpOpen, setInstallHelpOpen] = useState(false);
  const [updateReady, setUpdateReady] = useState<ServiceWorkerRegistration | null>(null);
  const [snapshot, setSnapshot] = useState<OfflineSnapshot | null>(null);
  const [drafts, setDrafts] = useState<OfflineDraft[]>([]);
  const [draftOpen, setDraftOpen] = useState(false);
  const [draftBody, setDraftBody] = useState("");
  const [draftKind, setDraftKind] = useState<OfflineDraft["kind"]>("note");
  const [draftError, setDraftError] = useState("");
  const [savingDraft, setSavingDraft] = useState(false);
  const requestRef = useRef<AbortController | null>(null);
  const dialogReturnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!enabled || !isCommandCenterHost()) return;
    const controller = new AbortController();
    requestRef.current = controller;
    const initialStateTimer = window.setTimeout(() => {
      setHostEligible(true);
      setOnline(navigator.onLine);
      setInstalled(isStandalone());
    }, 0);
    const syncOnline = () => setOnline(navigator.onLine);
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
      trackWorkspaceEvent("pwa_install_prompted");
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
      trackWorkspaceEvent("pwa_installed");
    };
    const onOpenInstall = () => {
      dialogReturnFocusRef.current = document.activeElement as HTMLElement | null;
      setInstallHelpOpen(true);
    };
    const onClear = () => {
      controller.abort();
      setSnapshot(null);
      setDrafts([]);
      setDraftBody("");
      setDraftOpen(false);
      navigator.serviceWorker?.controller?.postMessage({ type: "CLEAR_WORKSPACE_CACHE" });
    };

    window.addEventListener("online", syncOnline);
    window.addEventListener("offline", syncOnline);
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener("admin:open-pwa-install", onOpenInstall);
    window.addEventListener("pwa:clear-local-state", onClear);

    const loadSnapshot = async () => {
      let freshSnapshot: OfflineSnapshot | null = null;
      if (navigator.onLine) {
        try {
          const response = await fetch("/api/admin/offline-snapshot", {
            cache: "no-store",
            signal: controller.signal,
            headers: { "x-tenant-slug": tenantSlug },
          });
          if (response.ok) {
            const next = (await response.json()) as OfflineSnapshot;
            if (
              controller.signal.aborted ||
              next.tenantSlug !== tenantSlug ||
              next.userId !== userId
            )
              return;
            await saveOfflineSnapshot(next, controller.signal);
            if (controller.signal.aborted) return;
            freshSnapshot = next;
            setSnapshot(next);
            trackWorkspaceEvent("pwa_snapshot_loaded");
          }
        } catch {
          // The online banner remains authoritative. IndexedDB fallback handles transient loss.
        }
      }
      const stored = await readOfflineSnapshot(tenantSlug, userId);
      const savedDrafts = await listOfflineDrafts(tenantSlug, userId);
      if (controller.signal.aborted) return;
      if (!freshSnapshot && stored) setSnapshot(stored);
      setDrafts(savedDrafts);
    };
    void loadSnapshot().catch(() => {
      /* Offline storage is optional; keep the live workspace usable. */
    });

    let registration: ServiceWorkerRegistration | null = null;
    const register = async () => {
      if (!("serviceWorker" in navigator)) return;
      try {
        registration = await navigator.serviceWorker.register("/command-center-sw.js", {
          scope: "/",
          updateViaCache: "none",
        });
        if (registration.waiting) setUpdateReady(registration);
        registration.addEventListener("updatefound", () => {
          const worker = registration?.installing;
          if (!worker) return;
          worker.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller)
              setUpdateReady(registration);
          });
        });
      } catch {
        // PWA support is progressive. App functionality remains network-first.
      }
    };
    void register();

    return () => {
      controller.abort();
      window.clearTimeout(initialStateTimer);
      window.removeEventListener("online", syncOnline);
      window.removeEventListener("offline", syncOnline);
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("admin:open-pwa-install", onOpenInstall);
      window.removeEventListener("pwa:clear-local-state", onClear);
    };
  }, [enabled, tenantSlug, userId]);

  useEffect(() => {
    if (!installHelpOpen && !draftOpen) return;
    const opener = dialogReturnFocusRef.current;
    const onKeyDown = (event: KeyboardEvent) => {
      const dialog = document.querySelector<HTMLElement>("[data-command-center-dialog]");
      if (!dialog) return;
      if (event.key === "Escape") {
        event.preventDefault();
        setInstallHelpOpen(false);
        setDraftOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute("disabled"));
      if (!focusable.length) return;
      const first = focusable.at(0);
      const last = focusable.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    document
      .querySelector<HTMLElement>("[data-command-center-dialog] [data-dialog-initial-focus]")
      ?.focus();
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      opener?.focus();
      dialogReturnFocusRef.current = null;
    };
  }, [draftOpen, installHelpOpen]);

  if (!enabled || !hostEligible) return null;

  const canOfferInstall = !installed && (Boolean(installPrompt) || isIosSafari());

  const install = async () => {
    if (!installPrompt) {
      setInstallHelpOpen(true);
      return;
    }
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    trackWorkspaceEvent("pwa_install_choice", { outcome: choice.outcome });
    if (choice.outcome === "accepted") setInstallPrompt(null);
  };

  const activateUpdate = () => {
    const waiting = updateReady?.waiting;
    if (!waiting) {
      window.location.reload();
      return;
    }
    trackWorkspaceEvent("pwa_update_accepted");
    const reload = () => window.location.reload();
    navigator.serviceWorker.addEventListener("controllerchange", reload, { once: true });
    waiting.postMessage({ type: "SKIP_WAITING" });
  };

  const saveDraft = async () => {
    if (savingDraft) return;
    setSavingDraft(true);
    setDraftError("");
    const signal = requestRef.current?.signal;
    const draft: OfflineDraft = {
      id: `${tenantSlug}:${crypto.randomUUID()}`,
      tenantSlug,
      userId,
      kind: draftKind,
      body: draftBody.trim(),
      updatedAt: new Date().toISOString(),
      status: "local",
    };
    try {
      if (!(await saveOfflineDraft(draft, signal))) throw new Error("Storage unavailable");
      if (signal?.aborted) return;
      setDrafts((current) => [draft, ...current]);
      setDraftBody("");
      setDraftOpen(false);
      trackWorkspaceEvent("pwa_draft_saved", { kind: draftKind });
    } catch {
      if (!signal?.aborted)
        setDraftError(
          "This browser could not save your draft. Your text is still here. Copy it before closing.",
        );
    } finally {
      setSavingDraft(false);
    }
  };

  return (
    <>
      {canOfferInstall && (
        <button
          type="button"
          onClick={() => {
            dialogReturnFocusRef.current = document.activeElement as HTMLElement | null;
            void install();
          }}
          className="fixed right-4 top-[max(1rem,env(safe-area-inset-top))] z-[120] inline-flex min-h-11 items-center gap-2 rounded-[var(--admin-control-radius)] bg-[var(--admin-ink)] px-3.5 text-xs font-semibold text-[var(--admin-surface)] shadow-[var(--admin-shadow-hover)] transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin-action)]"
        >
          <Download className="size-3.5" aria-hidden="true" />
          Install app
        </button>
      )}

      {(!online || updateReady || drafts.length > 0) && (
        <div className="pointer-events-none fixed inset-x-4 bottom-[max(5.9rem,calc(5.9rem+env(safe-area-inset-bottom)))] z-[110] flex justify-center lg:bottom-5">
          <div className="pointer-events-auto flex w-full max-w-xl items-center gap-3 rounded-[var(--admin-surface-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-3 text-xs shadow-[var(--admin-shadow-hover)]">
            {!online ? (
              <WifiOff className="size-4 shrink-0 text-[var(--admin-muted)]" />
            ) : (
              <RefreshCw className="size-4 shrink-0 text-[var(--admin-muted)]" />
            )}
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-[var(--admin-ink)]">
                {online ? (updateReady ? "Update ready" : "Local drafts saved") : "You are offline"}
              </p>
              <p className="mt-0.5 truncate text-[var(--admin-muted)]">
                {online
                  ? updateReady
                    ? "Save unsaved work before refreshing."
                    : "These drafts stay on this device until you reuse or clear them."
                  : snapshot
                    ? `${snapshot.summary.total} items, ${snapshot.summary.urgent} urgent. Saved at ${new Date(snapshot.generatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.`
                    : "Drafts stay on this device. Reconnect to make live changes."}
              </p>
            </div>
            {(!online || drafts.length > 0) && (
              <button
                type="button"
                onClick={() => {
                  dialogReturnFocusRef.current = document.activeElement as HTMLElement | null;
                  setDraftOpen(true);
                }}
                className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-[var(--admin-control-radius)] bg-[var(--admin-surface-subtle)] px-2.5 font-semibold text-[var(--admin-ink)]"
              >
                <FilePenLine className="size-3.5" aria-hidden="true" /> Draft
              </button>
            )}
            {updateReady && online && (
              <button
                type="button"
                onClick={activateUpdate}
                className="inline-flex min-h-10 shrink-0 items-center rounded-[var(--admin-control-radius)] bg-[var(--admin-ink)] px-2.5 font-semibold text-[var(--admin-surface)]"
              >
                Refresh
              </button>
            )}
          </div>
        </div>
      )}

      {installHelpOpen && (
        <div
          className="fixed inset-0 z-[160] grid place-items-center bg-black/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-install-title"
          aria-describedby="pwa-install-description"
          data-command-center-dialog
        >
          <div className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-[var(--admin-surface-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-[var(--admin-shadow-hover)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--admin-muted)]">
                  Command Center
                </p>
                <h2
                  id="pwa-install-title"
                  className="mt-1 text-lg font-semibold text-[var(--admin-ink)]"
                >
                  Install your workspace
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setInstallHelpOpen(false)}
                className="grid size-10 place-items-center rounded-[var(--admin-control-radius)] text-[var(--admin-muted)] hover:text-[var(--admin-ink)]"
                aria-label="Close install instructions"
                data-dialog-initial-focus
              >
                <X className="size-4" />
              </button>
            </div>
            <p
              id="pwa-install-description"
              className="mt-4 text-sm leading-6 text-[var(--admin-muted)]"
            >
              {isIosSafari()
                ? "In Safari, tap Share, choose Add to Home Screen, then turn on Open as Web App."
                : "Use your browser’s install icon or choose Add to Dock / Install app from the browser menu."}
            </p>
            <button
              type="button"
              onClick={() => setInstallHelpOpen(false)}
              className="mt-5 min-h-11 w-full rounded-[var(--admin-control-radius)] bg-[var(--admin-ink)] px-4 text-sm font-semibold text-[var(--admin-surface)]"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {draftOpen && (
        <div
          className="fixed inset-0 z-[160] grid place-items-center bg-black/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-draft-title"
          aria-describedby="pwa-draft-description"
          data-command-center-dialog
        >
          <form
            className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-[var(--admin-surface-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-[var(--admin-shadow-hover)]"
            onSubmit={(event) => {
              event.preventDefault();
              void saveDraft();
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--admin-muted)]">
                  Stored on this device
                </p>
                <h2
                  id="pwa-draft-title"
                  className="mt-1 text-lg font-semibold text-[var(--admin-ink)]"
                >
                  Save a safe draft
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setDraftOpen(false)}
                className="grid size-10 place-items-center rounded-[var(--admin-control-radius)] text-[var(--admin-muted)] hover:text-[var(--admin-ink)]"
                aria-label="Close draft"
                data-dialog-initial-focus
              >
                <X className="size-4" />
              </button>
            </div>
            <label className="mt-5 block text-xs font-semibold text-[var(--admin-ink)]">
              Draft type
              <select
                value={draftKind}
                onChange={(event) => setDraftKind(event.target.value as OfflineDraft["kind"])}
                className="admin-field mt-1 w-full"
              >
                <option value="note">Note</option>
                <option value="task">Task</option>
                <option value="content">Content</option>
              </select>
            </label>
            <label className="mt-4 block text-xs font-semibold text-[var(--admin-ink)]">
              Draft text
              <textarea
                value={draftBody}
                onChange={(event) => setDraftBody(event.target.value)}
                maxLength={5000}
                rows={5}
                className="admin-field mt-1 w-full resize-y"
                placeholder="Keep this non-sensitive. It will not send automatically."
              />
            </label>
            <p id="pwa-draft-description" className="mt-2 text-xs text-[var(--admin-muted)]">
              {drafts.length} local draft{drafts.length === 1 ? "" : "s"} for this workspace.
            </p>
            {draftError && (
              <p role="alert" className="mt-3 text-sm text-[var(--admin-danger)]">
                {draftError}
              </p>
            )}
            <button
              type="submit"
              disabled={!draftBody.trim() || savingDraft}
              className="mt-5 min-h-11 w-full rounded-[var(--admin-control-radius)] bg-[var(--admin-ink)] px-4 text-sm font-semibold text-[var(--admin-surface)] disabled:cursor-not-allowed disabled:opacity-45"
            >
              {savingDraft ? "Saving…" : "Save draft"}
            </button>
            {drafts.length > 0 && (
              <section
                className="mt-5 border-t border-[var(--admin-border)] pt-4"
                aria-label="Saved local drafts"
              >
                <h3 className="text-sm font-semibold text-[var(--admin-ink)]">Saved drafts</h3>
                <ul className="mt-3 max-h-48 space-y-3 overflow-y-auto">
                  {drafts.map((draft) => (
                    <li
                      key={draft.id}
                      className="rounded-[var(--admin-control-radius)] bg-[var(--admin-surface-subtle)] p-3"
                    >
                      <p className="text-xs capitalize text-[var(--admin-muted)]">
                        {draft.kind} · {new Date(draft.updatedAt).toLocaleString()}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap break-words text-sm text-[var(--admin-ink)]">
                        {draft.body}
                      </p>
                      <button
                        type="button"
                        className="admin-button admin-button--secondary mt-2"
                        onClick={() => {
                          setDraftBody(draft.body);
                          setDraftKind(draft.kind);
                        }}
                      >
                        Reuse text
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </form>
        </div>
      )}
    </>
  );
}
