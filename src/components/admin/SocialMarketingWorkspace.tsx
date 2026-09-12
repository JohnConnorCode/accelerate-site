"use client";
import Image from "next/image";
import { useState } from "react";
import {
  CalendarDays,
  FileText,
  Globe2,
  Plus,
  RefreshCw,
  Settings,
  BarChart3,
  X,
} from "lucide-react";
import { PageHeader } from "./PageHeader";
import { AdminSurface } from "./AdminSurface";
import { AdminDialog } from "./AdminDialog";
import AdminLink from "./AdminLink";
import { useAdminQuery } from "@/lib/admin/useAdminQuery";
import { fetchJson } from "@/lib/admin/fetchJson";
import type { z } from "zod";
import type { socialDraftSchema } from "@/lib/revenue-os/social-marketing-contract";
type Draft = z.infer<typeof socialDraftSchema>;
type Post = { id: string; revision: number; state: string; draft: Draft; scheduled_at: string };
type Attempt = {
  id: string;
  post_id: string;
  state: string;
  provider_post_id: string | null;
  release_url: string | null;
  reason: string | null;
  metrics: {
    available?: boolean;
    values?: { label: string; value: number; date: string }[];
  } | null;
};
type Workspace = {
  demo?: boolean;
  mediaPreviewUrls?: Record<string, string>;
  enabled: boolean;
  posts: Post[];
  attempts: Attempt[];
  channels: { id: string; name: string; disabled: boolean }[];
  connection: { organizationId: string; version: number } | null;
  setupError: string | null;
  settings: { brandGuidance?: string; timeZone?: string };
  truncated: boolean;
};
type Preview = {
  operationId: string;
  change: unknown;
  digest: string;
  consequences: string;
  before: Post[];
};
const button = "admin-secondary-control min-h-10 px-3 py-2 text-sm disabled:opacity-50";
const primary = "admin-action-control min-h-10 px-4 py-2 text-sm disabled:opacity-50";
const field = "admin-field w-full min-h-10 px-3 py-2 text-sm";
const command = <T,>(kind: string, input: unknown) =>
  fetchJson<T>("/api/admin/social", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, input }),
  });
const localValue = (iso: string) => {
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
export function SocialMarketingWorkspace({ historyOnly = false }: { historyOnly?: boolean }) {
  const query = useAdminQuery<Workspace>(
    ["admin", "social", historyOnly ? "history" : "workspace"],
    historyOnly ? "/api/admin/social-history" : "/api/admin/social",
  );
  const [tab, setTab] = useState(historyOnly ? "Results" : "Drafts");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null),
    [review, setReview] = useState<Preview | null>(null);
  const [receiptIds, setReceiptIds] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<string[]>([]),
    [key, setKey] = useState("");
  const [weekly, setWeekly] = useState(false),
    [sourceTitle, setSourceTitle] = useState(""),
    [sourceUrl, setSourceUrl] = useState(""),
    [sourceText, setSourceText] = useState("");
  const [weeklyChannel, setWeeklyChannel] = useState("");
  const [weekStart, setWeekStart] = useState(() =>
    localValue(new Date(Date.now() + 86400000).toISOString()),
  );
  const data = query.data;
  const writable = Boolean(data?.enabled && !historyOnly);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
      await query.refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The operation failed. Refresh and retry.");
    } finally {
      setBusy(false);
    }
  };
  const emptyDraft = (): Draft => ({
    id: crypto.randomUUID(),
    revision: 0,
    title: "",
    content: "",
    channelId: data?.channels.find((c) => !c.disabled)?.id ?? "",
    scheduledAt: new Date(Date.now() + 86400000).toISOString(),
    timeZone,
    sources: [{ title: "", url: "", excerpt: "" }],
    mediaId: null,
  });
  const preview = async (operation: "schedule" | "cancel", posts: Post[]) => {
    const value = await command<Preview>("preview", {
      operationId: crypto.randomUUID(),
      change: { operation, posts: posts.map((p) => ({ id: p.id, revision: p.revision })) },
    });
    setReview(value);
  };
  const saveDrafts = async (drafts: Draft[]) => {
    const value = await command<Preview>("preview", {
      operationId: crypto.randomUUID(),
      change: { operation: "save", drafts },
    });
    await command("save", value);
    setDraft(null);
    setWeekly(false);
    setNotice(
      `${drafts.length} draft${drafts.length === 1 ? "" : "s"} saved. Publication requires fresh approval.`,
    );
  };
  return (
    <div className="space-y-5">
      <PageHeader
        title="Social Marketing"
        subtitle="Turn reviewed source material into approved LinkedIn posts, then track what actually publishes."
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1" aria-label="Social Marketing views">
          {[
            ["Drafts", FileText],
            ["Calendar", CalendarDays],
            ["Results", BarChart3],
            ["Setup", Settings],
          ].map(([name, Icon]) => {
            const LabelIcon = Icon as typeof FileText;
            return (
              <button
                key={String(name)}
                className={tab === name ? primary : button}
                aria-pressed={tab === name}
                onClick={() => setTab(String(name))}
              >
                <LabelIcon className="mr-2 inline size-4" aria-hidden />
                {String(name)}
              </button>
            );
          })}
        </div>
        <button
          className={button}
          disabled={busy}
          onClick={() =>
            void run(async () => {
              await query.refetch();
            })
          }
        >
          <RefreshCw className="mr-2 inline size-4" aria-hidden />
          Refresh
        </button>
      </div>
      {error || query.error ? (
        <AdminSurface role="alert" tone="attention">
          {error || "Social Marketing could not be loaded. Verify setup and retry."}
        </AdminSurface>
      ) : null}
      {notice ? (
        <p role="status" className="text-sm">
          {notice}
        </p>
      ) : null}
      {!data && !query.error ? (
        <AdminSurface role="status">Loading your social workspace…</AdminSurface>
      ) : null}
      {data ? (
        <>
          {data.demo ? (
            <AdminSurface tone="attention">
              Fictional demo: approvals and schedules are simulated. No social account is contacted.
            </AdminSurface>
          ) : null}
          {!data.enabled ? (
            <AdminSurface tone="attention">
              Social Marketing is disabled. History remains available.{" "}
              <AdminLink href="/admin/integrations">Manage plugins</AdminLink>
            </AdminSurface>
          ) : null}
          {data.setupError && tab !== "Setup" ? (
            <AdminSurface tone="attention">
              <p>{data.setupError}</p>
              <button className={`${button} mt-3`} onClick={() => setTab("Setup")}>
                Open setup
              </button>
            </AdminSurface>
          ) : null}
          {tab === "Drafts" || tab === "Calendar" ? (
            <>
              <div className="flex flex-wrap gap-2">
                {writable ? (
                  <>
                    <button className={primary} onClick={() => setDraft(emptyDraft())}>
                      <Plus className="mr-2 inline size-4" aria-hidden />
                      New draft
                    </button>
                    <button className={button} onClick={() => setWeekly(true)}>
                      Prepare three-post week
                    </button>
                    <button
                      className={button}
                      disabled={busy || !selected.length}
                      onClick={() =>
                        void run(() =>
                          preview(
                            "schedule",
                            data.posts.filter((p) => selected.includes(p.id)),
                          ),
                        )
                      }
                    >
                      Review selected ({selected.length})
                    </button>
                  </>
                ) : null}
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                {data.posts
                  .filter((p) =>
                    tab === "Drafts"
                      ? ["draft", "needs_review", "cancelled"].includes(p.state)
                      : true,
                  )
                  .sort((a, b) => Date.parse(a.scheduled_at) - Date.parse(b.scheduled_at))
                  .map((post) => (
                    <AdminSurface key={post.id}>
                      <div className="flex items-start justify-between gap-3">
                        <h2 className="font-semibold">{post.draft.title}</h2>
                        <span className="admin-badge text-xs">
                          {post.state.replaceAll("_", " ")}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-[var(--admin-muted)] tabular-nums">
                        {new Date(post.scheduled_at).toLocaleString(undefined, {
                          timeZone: post.draft.timeZone,
                        })}{" "}
                        · {post.draft.timeZone}
                      </p>
                      <p className="mt-3 whitespace-pre-wrap text-sm">{post.draft.content}</p>
                      {post.draft.mediaId ? (
                        <Image
                          unoptimized
                          width={960}
                          height={640}
                          src={
                            data?.mediaPreviewUrls?.[post.draft.mediaId] ??
                            `/api/admin/media-assets?id=${post.draft.mediaId}`
                          }
                          alt="Post attachment"
                          className="mt-3 max-h-56 rounded-lg object-contain"
                        />
                      ) : null}
                      <p className="mt-3 text-xs text-[var(--admin-muted)]">
                        {data.channels.find((c) => c.id === post.draft.channelId)?.name ??
                          "LinkedIn company page"}{" "}
                        · revision {post.revision}
                      </p>
                      {writable &&
                      ["draft", "needs_review", "cancelled", "scheduled"].includes(post.state) ? (
                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          <label className="flex min-h-10 items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={selected.includes(post.id)}
                              onChange={(e) =>
                                setSelected(
                                  e.target.checked
                                    ? [...selected, post.id]
                                    : selected.filter((id) => id !== post.id),
                                )
                              }
                            />
                            Select
                          </label>
                          <button
                            className={button}
                            disabled={busy}
                            onClick={() =>
                              setDraft({ ...post.draft, id: post.id, revision: post.revision })
                            }
                          >
                            Edit draft
                          </button>
                          {post.state === "scheduled" ? (
                            <button
                              className={button}
                              disabled={busy}
                              onClick={() => void run(() => preview("cancel", [post]))}
                            >
                              Cancel schedule
                            </button>
                          ) : (
                            <button
                              className={button}
                              disabled={busy}
                              onClick={() => void run(() => preview("schedule", [post]))}
                            >
                              Review schedule
                            </button>
                          )}
                        </div>
                      ) : null}
                    </AdminSurface>
                  ))}
              </div>
              {!data.posts.length ? (
                <AdminSurface>
                  <Globe2 className="mb-3 size-6" aria-hidden />
                  <h2 className="font-semibold">Your first reviewed post starts here</h2>
                  <p className="mt-2 text-sm text-[var(--admin-muted)]">
                    Connect a LinkedIn company page, add source material and save a draft. Nothing
                    publishes until you approve its content and time.
                  </p>
                </AdminSurface>
              ) : null}
            </>
          ) : null}
          {tab === "Results" ? (
            <div className="space-y-3">
              {data.attempts.length ? (
                data.attempts.map((a) => (
                  <AdminSurface key={a.id}>
                    <h2 className="font-semibold">
                      {data.posts.find((p) => p.id === a.post_id)?.draft.title ??
                        "Publication attempt"}
                    </h2>
                    <p className="mt-2 text-sm">
                      {a.state === "submitted"
                        ? "Accepted by Postiz; publication not yet verified"
                        : a.state.replaceAll("_", " ")}
                    </p>
                    {a.release_url ? (
                      <a
                        className="mt-2 inline-block underline"
                        href={a.release_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        View published LinkedIn post
                      </a>
                    ) : null}
                    {a.reason ? (
                      <p className="mt-2 text-sm text-[var(--admin-muted)]">{a.reason}</p>
                    ) : null}
                    {writable &&
                    ["unknown", "submitting"].includes(a.state) &&
                    !a.provider_post_id ? (
                      <div className="mt-4 space-y-2">
                        <label className="block text-sm">
                          Exact Postiz post ID
                          <input
                            className={field}
                            value={receiptIds[a.id] ?? ""}
                            onChange={(e) =>
                              setReceiptIds({ ...receiptIds, [a.id]: e.target.value })
                            }
                          />
                        </label>
                        <button
                          className={button}
                          disabled={busy || !receiptIds[a.id]}
                          onClick={() =>
                            void run(async () => {
                              setReview(
                                await command<Preview>("preview", {
                                  operationId: crypto.randomUUID(),
                                  change: {
                                    operation: "reconcile",
                                    attemptId: a.id,
                                    providerPostId: receiptIds[a.id],
                                  },
                                }),
                              );
                            })
                          }
                        >
                          Review provider receipt
                        </button>
                      </div>
                    ) : null}
                    <p className="mt-2 text-xs text-[var(--admin-muted)]">
                      {a.metrics?.available
                        ? "Provider metrics received"
                        : "Metrics unavailable; no engagement estimate shown"}
                    </p>
                    {a.metrics?.available ? (
                      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {a.metrics.values?.map((metric) => (
                          <div key={metric.label}>
                            <dt className="text-xs text-[var(--admin-muted)]">{metric.label}</dt>
                            <dd className="mt-1 text-lg font-semibold tabular-nums">
                              {metric.label === "Engagement"
                                ? new Intl.NumberFormat(undefined, {
                                    style: "percent",
                                    maximumFractionDigits: 2,
                                  }).format(metric.value)
                                : metric.value.toLocaleString()}
                            </dd>
                            <p className="text-xs text-[var(--admin-muted)]">
                              Provider snapshot: {metric.date}
                            </p>
                          </div>
                        ))}
                      </dl>
                    ) : null}
                  </AdminSurface>
                ))
              ) : (
                <AdminSurface>
                  No publication attempts yet. Approved schedules will appear here after dispatch.
                </AdminSurface>
              )}
            </div>
          ) : null}
          {tab === "Setup" ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <AdminSurface>
                <h2 className="font-semibold">Postiz connection</h2>
                <p className="mt-2 text-sm text-[var(--admin-muted)]">
                  Each workspace needs its own Postiz organization. The server address is controlled
                  by the operator.
                </p>
                <p className="mt-3 text-sm">
                  {data.connection
                    ? `Connected organization: ${data.connection.organizationId}`
                    : "Not connected"}
                </p>
                {writable ? (
                  <form
                    className="mt-4 space-y-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void run(async () => {
                        await fetchJson("/api/admin/tenant/providers", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ action: "configure_postiz", apiKey: key }),
                        });
                        setKey("");
                        setNotice("Postiz organization verified and connected.");
                      });
                    }}
                  >
                    <label className="block text-sm">
                      Organization API key
                      <input
                        className={`${field} mt-1`}
                        type="password"
                        autoComplete="off"
                        value={key}
                        onChange={(e) => setKey(e.target.value)}
                        required
                      />
                    </label>
                    <button className={primary} disabled={busy || !key}>
                      Verify and connect
                    </button>
                    {data.connection ? (
                      <button
                        type="button"
                        className={`${button} ml-2`}
                        disabled={busy}
                        onClick={() =>
                          void run(async () => {
                            await fetchJson("/api/admin/tenant/providers", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ action: "disconnect", provider: "postiz" }),
                            });
                            setNotice("Postiz disconnected. New publication is stopped.");
                          })
                        }
                      >
                        Disconnect
                      </button>
                    ) : null}
                  </form>
                ) : null}
              </AdminSurface>
              <AdminSurface>
                <h2 className="font-semibold">LinkedIn pages and editorial guidance</h2>
                <ul className="mt-3 space-y-2 text-sm">
                  {data.channels.map((c) => (
                    <li key={c.id}>
                      {c.name} · {c.disabled ? "Reconnect in Postiz" : "Available"}
                      <span className="block text-xs text-[var(--admin-muted)]">
                        Page ID: {c.id}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 whitespace-pre-wrap text-sm text-[var(--admin-muted)]">
                  {data.settings.brandGuidance ||
                    "Add your audience, voice and approved claims in plugin settings."}
                </p>
                <AdminLink href="/admin/integrations" className="mt-4 inline-block underline">
                  Edit plugin settings
                </AdminLink>
                <p className="mt-3 text-sm">
                  <a
                    href="/docs/plugins/social-marketing"
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    Setup, scheduling and recovery guide
                  </a>
                </p>
              </AdminSurface>
            </div>
          ) : null}
          {data.truncated ? (
            <p className="text-sm text-[var(--admin-muted)]">
              Showing the latest 50 records. Older history remains retained.
            </p>
          ) : null}
        </>
      ) : null}
      <AdminDialog
        open={Boolean(draft)}
        onClose={() => !busy && setDraft(null)}
        title="Edit social draft"
        maxWidth="lg"
        className="rounded-2xl bg-[var(--admin-surface)] p-5 text-[var(--admin-ink)] shadow-[var(--admin-shadow-hover)] sm:p-6"
      >
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">Edit social draft</h2>
          <button
            type="button"
            className="admin-icon-button"
            aria-label="Close edit social draft"
            disabled={busy}
            onClick={() => setDraft(null)}
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>
        {error ? (
          <p role="alert" className="mb-3 text-sm text-[var(--admin-danger)]">
            {error}
          </p>
        ) : null}
        {draft ? (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void run(() => saveDrafts([draft]));
            }}
          >
            <label className="block text-sm">
              Title
              <input
                className={`${field} mt-1`}
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                required
                maxLength={200}
              />
            </label>
            <label className="block text-sm">
              LinkedIn company page
              <select
                aria-label="LinkedIn company page"
                className={`${field} mt-1`}
                value={draft.channelId}
                onChange={(e) => setDraft({ ...draft, channelId: e.target.value })}
                required
              >
                <option value="">Select a page</option>
                {data?.channels
                  .filter((c) => !c.disabled)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="block text-sm">
              Post text
              <textarea
                aria-label="Post text"
                className={`${field} mt-1 min-h-36`}
                value={draft.content}
                onChange={(e) => setDraft({ ...draft, content: e.target.value })}
                required
                maxLength={3000}
              />
            </label>
            <label className="block text-sm">
              Publication time ({timeZone})
              <input
                className={`${field} mt-1`}
                type="datetime-local"
                value={localValue(draft.scheduledAt)}
                onChange={(e) => {
                  if (e.target.value)
                    setDraft({
                      ...draft,
                      scheduledAt: new Date(e.target.value).toISOString(),
                      timeZone,
                    });
                }}
                required
              />
            </label>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Source supporting this post</legend>
              {(["title", "url", "excerpt"] as const).map((name) => (
                <label key={name} className="block text-sm capitalize">
                  {name}
                  {name === "excerpt" ? (
                    <textarea
                      aria-label={name}
                      className={`${field} mt-1 min-h-24`}
                      value={draft.sources[0]![name]}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          sources: [{ ...draft.sources[0]!, [name]: e.target.value }],
                        })
                      }
                      required
                    />
                  ) : (
                    <input
                      className={`${field} mt-1`}
                      type={name === "url" ? "url" : "text"}
                      value={draft.sources[0]![name]}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          sources: [{ ...draft.sources[0]!, [name]: e.target.value }],
                        })
                      }
                      required
                    />
                  )}
                </label>
              ))}
            </fieldset>
            <label className="block text-sm">
              Optional image (PNG or JPEG, up to 3 MB)
              <input
                className="mt-2 block min-h-10 w-full text-sm"
                type="file"
                accept="image/png,image/jpeg"
                disabled={busy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  void run(async () => {
                    if (file.size > 3000000) throw new Error("Image exceeds 3 MB");
                    const bytes = new Uint8Array(await file.arrayBuffer());
                    let raw = "";
                    for (let i = 0; i < bytes.length; i += 8192)
                      raw += String.fromCharCode(...bytes.subarray(i, i + 8192));
                    const result = await fetchJson<{ id: string }>("/api/admin/social/media", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ mime: file.type, data: btoa(raw) }),
                    });
                    setDraft({ ...draft, mediaId: result.id });
                  });
                }}
              />
            </label>
            {draft.mediaId ? (
              <>
                <Image
                  unoptimized
                  width={960}
                  height={640}
                  src={
                    data?.mediaPreviewUrls?.[draft.mediaId] ??
                    `/api/admin/media-assets?id=${draft.mediaId}`
                  }
                  alt="Draft attachment"
                  className="max-h-48 rounded-lg object-contain"
                />
                <button
                  type="button"
                  className={button}
                  onClick={() => setDraft({ ...draft, mediaId: null })}
                >
                  Remove image
                </button>
              </>
            ) : null}
            <p className="text-xs text-[var(--admin-muted)]">
              Saving invalidates any earlier publication approval.
            </p>
            <button className={primary} disabled={busy}>
              Save draft
            </button>
          </form>
        ) : null}
      </AdminDialog>
      <AdminDialog
        open={weekly}
        onClose={() => !busy && setWeekly(false)}
        title="Prepare a three-post week"
        maxWidth="lg"
        className="rounded-2xl bg-[var(--admin-surface)] p-5 text-[var(--admin-ink)] shadow-[var(--admin-shadow-hover)] sm:p-6"
      >
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">Prepare a three-post week</h2>
          <button
            type="button"
            className="admin-icon-button"
            aria-label="Close prepare a three-post week"
            disabled={busy}
            onClick={() => setWeekly(false)}
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>
        {error ? (
          <p role="alert" className="mb-3 text-sm text-[var(--admin-danger)]">
            {error}
          </p>
        ) : null}
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              const result = await command<{ drafts: Draft[] }>("week", {
                source: { title: sourceTitle, url: sourceUrl, excerpt: sourceText },
                channelId: weeklyChannel,
                weekStart: new Date(weekStart).toISOString(),
                timeZone,
              });
              await saveDrafts(result.drafts);
            });
          }}
        >
          <p className="text-sm text-[var(--admin-muted)]">
            Supply three reviewed paragraphs separated by blank lines. Each becomes one editable
            post with its source link, spaced two days apart. Review the copy and times before
            approving.
          </p>
          <label className="block text-sm">
            LinkedIn company page
            <select
              className={field}
              value={weeklyChannel}
              onChange={(e) => setWeeklyChannel(e.target.value)}
              required
            >
              <option value="">Select a page</option>
              {data?.channels
                .filter((c) => !c.disabled)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="block text-sm">
            Source title
            <input
              className={field}
              value={sourceTitle}
              onChange={(e) => setSourceTitle(e.target.value)}
              required
            />
          </label>
          <label className="block text-sm">
            Source URL
            <input
              className={field}
              type="url"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              required
            />
          </label>
          <label className="block text-sm">
            Three source paragraphs
            <textarea
              aria-label="Three source paragraphs"
              className={`${field} min-h-40`}
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
              required
            />
          </label>
          <label className="block text-sm">
            First post ({timeZone})
            <input
              className={field}
              type="datetime-local"
              value={weekStart}
              onChange={(e) => setWeekStart(e.target.value)}
              required
            />
          </label>
          <button className={primary} disabled={busy}>
            Prepare and save drafts
          </button>
        </form>
      </AdminDialog>
      <AdminDialog
        open={Boolean(review)}
        onClose={() => !busy && setReview(null)}
        title="Review exact social changes"
        maxWidth="lg"
        className="rounded-2xl bg-[var(--admin-surface)] p-5 text-[var(--admin-ink)] shadow-[var(--admin-shadow-hover)] sm:p-6"
      >
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">Review exact social changes</h2>
          <button
            type="button"
            className="admin-icon-button"
            aria-label="Close review exact social changes"
            disabled={busy}
            onClick={() => setReview(null)}
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>
        {error ? (
          <p role="alert" className="mb-3 text-sm text-[var(--admin-danger)]">
            {error}
          </p>
        ) : null}
        {review ? (
          <div className="space-y-4">
            <p className="text-sm">{review.consequences}</p>
            {review.before.map((post) => (
              <AdminSurface key={post.id} tone="subtle">
                <h3 className="font-semibold">{post.draft.title}</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm">{post.draft.content}</p>
                {post.draft.mediaId ? (
                  <Image
                    unoptimized
                    width={960}
                    height={640}
                    src={
                      data?.mediaPreviewUrls?.[post.draft.mediaId] ??
                      `/api/admin/media-assets?id=${post.draft.mediaId}`
                    }
                    alt="Exact image to publish"
                    className="mt-3 max-h-52 rounded-lg object-contain"
                  />
                ) : null}
                <p className="mt-3 text-sm">
                  {data?.channels.find((c) => c.id === post.draft.channelId)?.name} ·{" "}
                  {new Date(post.scheduled_at).toLocaleString(undefined, {
                    timeZone: post.draft.timeZone,
                  })}{" "}
                  · {post.draft.timeZone}
                </p>
              </AdminSurface>
            ))}
            <button
              className={primary}
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const action = await command<{ id: string }>("propose", {
                    operationId: review.operationId,
                    change: review.change,
                    digest: review.digest,
                  });
                  await fetchJson("/api/admin/revenue-os/actions", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: action.id, decision: "approve" }),
                  });
                  setReview(null);
                  setSelected([]);
                  setNotice(
                    "Approved change recorded. Scheduled posts will be submitted when due.",
                  );
                })
              }
            >
              Approve these exact changes
            </button>
          </div>
        ) : null}
      </AdminDialog>
    </div>
  );
}
