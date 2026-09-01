"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  GripVertical,
  Loader2,
  Monitor,
  Plus,
  Smartphone,
  Trash2,
} from "lucide-react";
import { AdminSurface } from "./AdminSurface";
import { cn } from "@/lib/utils";
import { EMAIL_BLOCK_TYPES, createEmailBlock, type EmailBlock } from "@/lib/email/blocks";

interface EmailBlockComposerProps {
  templateId: string;
  subject: string;
  previewText: string;
  blocks: EmailBlock[];
  onChange: (blocks: EmailBlock[]) => void;
}

export function EmailBlockComposer({
  templateId,
  subject,
  previewText,
  blocks,
  onChange,
}: EmailBlockComposerProps) {
  const [width, setWidth] = useState<"desktop" | "mobile">("desktop");
  const [html, setHtml] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const request = useRef<AbortController | null>(null);
  const blockKey = useMemo(() => JSON.stringify(blocks), [blocks]);

  useEffect(() => {
    if (!subject.trim() || !blocks.length) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      request.current?.abort();
      const controller = new AbortController();
      request.current = controller;
      setPending(true);
      try {
        const response = await fetch("/api/admin/emails/preview", {
          method: "POST",
          signal: controller.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: templateId,
            action: "render",
            subjectTemplate: subject,
            previewText,
            blocks,
          }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Preview could not be rendered.");
        setHtml(result.html);
        setError(null);
      } catch (reason) {
        if ((reason as Error).name !== "AbortError")
          setError(reason instanceof Error ? reason.message : "Preview could not be rendered.");
      } finally {
        if (!controller.signal.aborted) setPending(false);
      }
    }, 280);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [blockKey, blocks, previewText, subject, templateId]);

  const update = (index: number, next: EmailBlock) =>
    onChange(blocks.map((block, blockIndex) => (blockIndex === index ? next : block)));
  const remove = (index: number) =>
    onChange(blocks.filter((_, blockIndex) => blockIndex !== index));
  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    const current = next[index];
    const destination = next[target];
    if (!current || !destination) return;
    [next[index], next[target]] = [destination, current];
    onChange(next);
  };

  return (
    <div className="grid min-h-[610px] min-w-0 xl:grid-cols-[minmax(0,.92fr)_minmax(390px,1.08fr)]">
      <section className="min-w-0 space-y-4 border-b border-[var(--admin-border)] p-4 sm:p-6 xl:border-b-0 xl:border-r">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="admin-eyebrow">Email sections</p>
            <p className="admin-copy mt-1 text-xs">
              One renderer produces the preview, test email, and published email.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {EMAIL_BLOCK_TYPES.map((entry) => (
              <button
                key={entry.type}
                type="button"
                onClick={() => onChange([...blocks, createEmailBlock(entry.type)])}
                className="inline-flex min-h-9 items-center gap-1 rounded-[var(--admin-control-radius)] px-2 text-[10px] font-semibold text-[var(--admin-muted)] shadow-[var(--admin-shadow-border)] transition-[color,box-shadow,transform] duration-150 hover:text-[var(--admin-ink)] hover:shadow-[var(--admin-shadow-border-hover)] active:scale-[0.96]"
              >
                <Plus className="size-3" />
                {entry.label}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          {blocks.map((block, index) => (
            <BlockRow
              key={block.id}
              block={block}
              onChange={(next) => update(index, next)}
              onDelete={() => remove(index)}
              onUp={() => move(index, -1)}
              onDown={() => move(index, 1)}
              disableUp={index === 0}
              disableDown={index === blocks.length - 1}
            />
          ))}
        </div>
      </section>
      <section className="min-w-0 bg-black/[0.018] p-3 dark:bg-white/[0.018] sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <p className="admin-eyebrow mb-0">Exact rendered preview</p>
            {pending && <Loader2 className="size-3 animate-spin text-[var(--admin-muted)]" />}
          </div>
          <div className="inline-flex rounded-[var(--admin-control-radius)] bg-[var(--admin-surface)] p-1 shadow-[var(--admin-shadow-border)]">
            <button
              type="button"
              onClick={() => setWidth("desktop")}
              className={cn(
                "grid size-9 place-items-center rounded-[calc(var(--admin-control-radius)-3px)] transition-[background-color,color,transform] active:scale-[0.96]",
                width === "desktop"
                  ? "bg-[var(--admin-ink)] text-[var(--admin-surface)]"
                  : "text-[var(--admin-muted)]",
              )}
              aria-label="Desktop preview"
            >
              <Monitor className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setWidth("mobile")}
              className={cn(
                "grid size-9 place-items-center rounded-[calc(var(--admin-control-radius)-3px)] transition-[background-color,color,transform] active:scale-[0.96]",
                width === "mobile"
                  ? "bg-[var(--admin-ink)] text-[var(--admin-surface)]"
                  : "text-[var(--admin-muted)]",
              )}
              aria-label="Mobile preview"
            >
              <Smartphone className="size-3.5" />
            </button>
          </div>
        </div>
        <AdminSurface
          elevation="flat"
          padding="sm"
          className="min-h-[520px] overflow-auto bg-[var(--admin-surface-subtle)]"
        >
          <div
            className={cn(
              "mx-auto overflow-hidden rounded-[calc(var(--admin-surface-radius)-4px)] bg-white shadow-[var(--admin-shadow)] transition-[max-width] duration-200",
              width === "mobile" ? "max-w-[390px]" : "max-w-[600px]",
            )}
          >
            {html ? (
              <iframe
                srcDoc={html}
                sandbox=""
                title="Exact email preview"
                className="h-[620px] w-full border-0 bg-white"
              />
            ) : (
              <div className="grid min-h-[460px] place-items-center px-6 text-center text-xs text-[var(--admin-muted)]">
                {error || "Rendering the email preview…"}
              </div>
            )}
          </div>
        </AdminSurface>
        {error && html && (
          <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
            Preview needs attention. The last valid render remains visible.
          </p>
        )}
      </section>
    </div>
  );
}

function BlockRow({
  block,
  onChange,
  onDelete,
  onUp,
  onDown,
  disableUp,
  disableDown,
}: {
  block: EmailBlock;
  onChange: (block: EmailBlock) => void;
  onDelete: () => void;
  onUp: () => void;
  onDown: () => void;
  disableUp: boolean;
  disableDown: boolean;
}) {
  const field = (label: string, value: string, set: (value: string) => void, multiline = false) => (
    <label className="admin-field-label">
      <span>{label}</span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(event) => set(event.target.value)}
          rows={4}
          className="admin-field resize-y py-2.5 text-sm leading-6"
        />
      ) : (
        <input
          value={value}
          onChange={(event) => set(event.target.value)}
          className="admin-field"
        />
      )}
    </label>
  );
  return (
    <AdminSurface elevation="outlined" padding="sm" className="group">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--admin-ink)]">
          <GripVertical className="size-3.5 text-[var(--admin-muted)]" />
          {EMAIL_BLOCK_TYPES.find((entry) => entry.type === block.type)?.label}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onUp}
            disabled={disableUp}
            className="admin-icon-button size-8 disabled:opacity-30"
            aria-label="Move section up"
          >
            <ArrowUp className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={onDown}
            disabled={disableDown}
            className="admin-icon-button size-8 disabled:opacity-30"
            aria-label="Move section down"
          >
            <ArrowDown className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="admin-icon-button size-8 text-rose-700 dark:text-rose-300"
            aria-label="Delete section"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>
      {block.type === "heading" &&
        field("Heading", block.text, (text) => onChange({ ...block, text }))}
      {block.type === "paragraph" &&
        field("Copy", block.text, (text) => onChange({ ...block, text }), true)}
      {block.type === "button" && (
        <div className="grid gap-2 sm:grid-cols-2">
          {field("Button label", block.text, (text) => onChange({ ...block, text }))}
          {field("Destination", block.url, (url) => onChange({ ...block, url }))}
        </div>
      )}
      {block.type === "spacer" && (
        <label className="admin-field-label">
          <span>Space (px)</span>
          <input
            type="number"
            min="8"
            max="96"
            value={block.height}
            onChange={(event) => onChange({ ...block, height: Number(event.target.value) || 24 })}
            className="admin-field"
          />
        </label>
      )}
      {block.type === "divider" && (
        <p className="admin-copy text-xs">Creates a quiet visual break in the reader’s inbox.</p>
      )}
    </AdminSurface>
  );
}
