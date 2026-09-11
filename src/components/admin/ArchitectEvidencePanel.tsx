"use client";

import { FormEvent, useState } from "react";
import { FolderLock, NotebookPen, Paperclip } from "lucide-react";
import { useAdminAI } from "./AdminAIProvider";
import { cn } from "@/lib/utils";

export function ArchitectEvidencePanel() {
  const ai = useAdminAI();
  const [source, setSource] = useState("drive");
  const [scope, setScope] = useState("folder");
  const [resourceId, setResourceId] = useState("");
  const [assumption, setAssumption] = useState("");
  const [dragging, setDragging] = useState(false);

  const addScope = (event: FormEvent) => {
    event.preventDefault();
    const id = resourceId.trim();
    if (!id) return;
    void ai.addConnectedSource({ source, scope, resourceId: id }).then(() => setResourceId(""));
  };

  const addNote = (event: FormEvent) => {
    event.preventDefault();
    const text = assumption.trim();
    if (!text) return;
    void ai.addAssumption(text).then(() => setAssumption(""));
  };

  return (
    <div
      className={cn(
        "border-b border-[var(--admin-border)] px-3 py-3 sm:px-4",
        dragging && "bg-[var(--admin-ink)]/[0.04]",
      )}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        const files = [...event.dataTransfer.files];
        if (files.length) void ai.attachSources(files);
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="admin-eyebrow">Evidence, not instructions</p>
        <label className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-[var(--admin-ink)] hover:bg-black/[0.04] dark:hover:bg-white/[0.05]">
          <Paperclip className="size-3.5" />
          Attach files
          <input
            type="file"
            multiple
            className="sr-only"
            disabled={ai.schemaReady === false}
            onChange={(event) => {
              const files = [...(event.target.files ?? [])];
              event.currentTarget.value = "";
              if (files.length) void ai.attachSources(files);
            }}
          />
        </label>
      </div>
      <p className="mt-1 text-[11px] text-[var(--admin-muted)]">
        Drop notes here or add a named folder, label, or document. Excerpts stay inspectable and are
        never run as commands.
      </p>
      {(ai.sources.length > 0 || ai.connectedContext.length > 0 || ai.assumptions.length > 0) && (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {ai.sources.map((item) => (
            <li
              key={item.id}
              className="rounded-xl bg-black/[0.035] px-3 py-2 text-xs dark:bg-white/[0.05]"
            >
              <p className="font-semibold text-[var(--admin-ink)]">{item.filename}</p>
              <p className="mt-0.5 text-[var(--admin-muted)]">
                {item.provenance.scope} · read · evidence
              </p>
              {item.excerpt && (
                <p className="mt-1 max-h-16 overflow-y-auto whitespace-pre-wrap text-[var(--admin-ink)]">
                  {item.excerpt}
                </p>
              )}
            </li>
          ))}
          {ai.connectedContext.map((item) => (
            <li
              key={`${item.source}-${item.resourceId}`}
              className="flex items-start gap-2 rounded-xl bg-black/[0.035] px-3 py-2 text-xs dark:bg-white/[0.05]"
            >
              <FolderLock className="mt-0.5 size-3.5 shrink-0 text-[var(--admin-muted)]" />
              <span>
                <span className="font-semibold text-[var(--admin-ink)]">{item.source}</span>
                <span className="ml-1 text-[var(--admin-muted)]">
                  {item.scope}/{item.resourceId} · {item.permission}
                </span>
              </span>
            </li>
          ))}
          {ai.assumptions.map((item) => (
            <li
              key={item}
              className="flex items-start gap-2 rounded-xl bg-black/[0.035] px-3 py-2 text-xs dark:bg-white/[0.05]"
            >
              <NotebookPen className="mt-0.5 size-3.5 shrink-0 text-[var(--admin-muted)]" />
              <span className="text-[var(--admin-ink)]">{item}</span>
            </li>
          ))}
        </ul>
      )}
      <form
        onSubmit={addScope}
        className="mt-3 grid gap-2 sm:grid-cols-[7rem_7rem_minmax(0,1fr)_auto]"
      >
        <label className="sr-only" htmlFor="architect-source">
          Source system
        </label>
        <select
          id="architect-source"
          value={source}
          onChange={(event) => setSource(event.target.value)}
          className="min-h-11 rounded-xl bg-[var(--admin-surface)] px-3 text-xs shadow-[var(--admin-shadow-border)]"
        >
          <option value="drive">Drive</option>
          <option value="gmail">Gmail</option>
          <option value="notes">Notes</option>
        </select>
        <label className="sr-only" htmlFor="architect-scope">
          Scope
        </label>
        <select
          id="architect-scope"
          value={scope}
          onChange={(event) => setScope(event.target.value)}
          className="min-h-11 rounded-xl bg-[var(--admin-surface)] px-3 text-xs shadow-[var(--admin-shadow-border)]"
        >
          <option value="folder">Folder</option>
          <option value="label">Label</option>
          <option value="document">Document</option>
        </select>
        <label className="sr-only" htmlFor="architect-resource">
          Resource id
        </label>
        <input
          id="architect-resource"
          value={resourceId}
          onChange={(event) => setResourceId(event.target.value)}
          placeholder="Named folder, label, or document"
          className="min-h-11 rounded-xl bg-[var(--admin-surface)] px-3 text-xs shadow-[var(--admin-shadow-border)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-action)]"
        />
        <button
          type="submit"
          className="min-h-11 rounded-xl px-3 text-xs font-semibold shadow-[var(--admin-shadow-border)]"
        >
          Add scope
        </button>
      </form>
      <form onSubmit={addNote} className="mt-2 flex gap-2">
        <label className="sr-only" htmlFor="architect-assumption">
          Assumption
        </label>
        <input
          id="architect-assumption"
          value={assumption}
          onChange={(event) => setAssumption(event.target.value.slice(0, 280))}
          placeholder="Record an assumption this session should keep"
          className="min-h-11 flex-1 rounded-xl bg-[var(--admin-surface)] px-3 text-xs shadow-[var(--admin-shadow-border)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-action)]"
        />
        <button
          type="submit"
          className="min-h-11 rounded-xl px-3 text-xs font-semibold shadow-[var(--admin-shadow-border)]"
        >
          Note it
        </button>
      </form>
    </div>
  );
}
