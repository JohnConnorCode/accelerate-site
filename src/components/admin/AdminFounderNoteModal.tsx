"use client";

import { useEffect, useRef, useState } from "react";
import { Link2, Loader2, NotebookPen, Search, X } from "lucide-react";
import { AdminDialog } from "./AdminDialog";
import { AdminSurface } from "./AdminSurface";
import { fetchJson } from "@/lib/admin/fetchJson";
import { toast } from "@/lib/admin/useToast";
import { cn } from "@/lib/utils";

interface PersonResult {
  name: string;
  email: string;
  type: string;
}
interface OpenNoteDetail {
  contactEmail?: string;
  contactLabel?: string;
  companyId?: string;
  opportunityId?: string;
  initialNote?: string;
  captureSource?: "command_palette" | "keyboard_shortcut" | "ai_answer" | "record_context";
}

export function AdminFounderNoteModal() {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [requestId, setRequestId] = useState("");
  const [saving, setSaving] = useState(false);
  const [showAttachment, setShowAttachment] = useState(false);
  const [personQuery, setPersonQuery] = useState("");
  const [people, setPeople] = useState<PersonResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<PersonResult | null>(null);
  const [context, setContext] = useState<Pick<OpenNoteDetail, "companyId" | "opportunityId">>({});
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openedAt = useRef(0);
  const captureSource = useRef<OpenNoteDetail["captureSource"]>("command_palette");

  useEffect(() => {
    const show = (event: Event) => {
      const detail = (event as CustomEvent<OpenNoteDetail>).detail ?? {};
      openedAt.current = performance.now();
      captureSource.current = detail.captureSource ?? "command_palette";
      setRequestId(crypto.randomUUID());
      setNote(detail.initialNote?.slice(0, 5_000) ?? "");
      setPersonQuery("");
      setPeople([]);
      setSelectedPerson(
        detail.contactEmail
          ? {
              name: detail.contactLabel || detail.contactEmail,
              email: detail.contactEmail,
              type: "Canonical contact",
            }
          : null,
      );
      setShowAttachment(Boolean(detail.contactEmail));
      setContext({ companyId: detail.companyId, opportunityId: detail.opportunityId });
      setOpen(true);
    };
    window.addEventListener("admin:add-note", show);
    return () => window.removeEventListener("admin:add-note", show);
  }, []);

  useEffect(
    () => () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    },
    [],
  );

  const close = () => {
    if (!saving) setOpen(false);
  };

  const searchPeople = (value: string) => {
    setPersonQuery(value);
    setSelectedPerson(null);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (value.trim().length < 3) {
      setPeople([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const result = await fetchJson<{ results: PersonResult[] }>(
          `/api/admin/search?q=${encodeURIComponent(value.trim())}`,
        );
        setPeople(
          result.results.filter((person) => person.type === "Canonical contact").slice(0, 5),
        );
      } catch {
        setPeople([]);
      } finally {
        setSearching(false);
      }
    }, 220);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!note.trim() || saving) return;
    setSaving(true);
    try {
      const result = await fetchJson<{ receipt: { duplicate: boolean } }>(
        "/api/admin/revenue-os/notes",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requestId,
            note: note.trim(),
            contactEmail: selectedPerson?.email ?? null,
            captureDurationMs: Math.max(0, Math.round(performance.now() - openedAt.current)),
            captureSource: captureSource.current,
            ...context,
          }),
        },
      );
      toast.success(
        result.receipt.duplicate
          ? "Note was already captured"
          : "Note added to the operating memory",
      );
      setOpen(false);
      window.dispatchEvent(new CustomEvent("admin:refresh-activity"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The note could not be saved");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminDialog
      open={open}
      onClose={close}
      title="Capture a note"
      labelledBy="founder-note-title"
      maxWidth="md"
    >
      <AdminSurface padding="lg" className="admin-dialog-surface">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-black/[0.045] text-[var(--admin-ink)] dark:bg-white/[0.065]">
              <NotebookPen className="size-[18px]" />
            </span>
            <div>
              <p className="admin-eyebrow">Operating memory</p>
              <h2 id="founder-note-title" className="admin-dialog-title">
                Capture what you know
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            className="admin-icon-button"
            aria-label="Close note"
          >
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={submit} className="mt-5 space-y-4">
          <label className="block">
            <span className="sr-only">Note</span>
            <textarea
              autoFocus
              value={note}
              onChange={(event) => setNote(event.target.value.slice(0, 5_000))}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder="What happened, what was decided, or what should not be forgotten?"
              rows={7}
              className="w-full resize-none rounded-xl bg-black/[0.035] px-4 py-3 text-sm leading-6 text-[var(--admin-ink)] outline-none shadow-[var(--admin-shadow-border)] transition-[box-shadow] duration-150 placeholder:text-[var(--admin-muted)] focus-visible:shadow-[var(--admin-shadow-border-hover)] focus-visible:ring-2 focus-visible:ring-[var(--admin-action)] focus-visible:ring-offset-2 dark:bg-white/[0.045]"
            />
          </label>

          <div>
            <button
              type="button"
              onClick={() => setShowAttachment((current) => !current)}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-xs font-semibold text-[var(--admin-muted)] transition-[color,transform] duration-150 hover:text-[var(--admin-ink)] active:scale-[0.96]"
            >
              <Link2 className="size-3.5" />{" "}
              {selectedPerson ? `Attached to ${selectedPerson.name}` : "Attach to a person"}
            </button>
            {showAttachment && (
              <div className="relative mt-2 rounded-xl bg-black/[0.025] p-2 dark:bg-white/[0.03]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[var(--admin-muted)]" />
                  <input
                    value={personQuery}
                    onChange={(event) => searchPeople(event.target.value)}
                    placeholder="Search canonical contacts"
                    className="min-h-11 w-full rounded-lg bg-[var(--admin-surface)] pl-9 pr-9 text-sm text-[var(--admin-ink)] outline-none shadow-[var(--admin-shadow-border)] focus-visible:shadow-[var(--admin-shadow-border-hover)] focus-visible:ring-2 focus-visible:ring-[var(--admin-action)] focus-visible:ring-offset-2"
                  />
                  {searching && (
                    <Loader2 className="absolute right-3 top-1/2 size-3.5 -translate-y-1/2 animate-spin text-[var(--admin-muted)]" />
                  )}
                </div>
                {selectedPerson && (
                  <div className="mt-2 flex min-h-11 items-center justify-between rounded-lg bg-[var(--admin-surface)] px-3 shadow-[var(--admin-shadow-border)]">
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-semibold text-[var(--admin-ink)]">
                        {selectedPerson.name}
                      </span>
                      <span className="block truncate text-[10px] text-[var(--admin-muted)]">
                        {selectedPerson.email}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPerson(null);
                        setPersonQuery("");
                      }}
                      className="grid size-10 place-items-center rounded-lg text-[var(--admin-muted)] hover:text-[var(--admin-ink)]"
                      aria-label="Remove attachment"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                )}
                {!selectedPerson && people.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {people.map((person) => (
                      <button
                        key={person.email}
                        type="button"
                        onClick={() => {
                          setSelectedPerson(person);
                          setPersonQuery("");
                          setPeople([]);
                        }}
                        className="flex min-h-11 w-full items-center rounded-lg px-3 text-left transition-[background-color,transform] duration-150 hover:bg-[var(--admin-surface)] active:scale-[0.96]"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-semibold text-[var(--admin-ink)]">
                            {person.name}
                          </span>
                          <span className="block truncate text-[10px] text-[var(--admin-muted)]">
                            {person.email}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {!selectedPerson &&
                  !searching &&
                  personQuery.trim().length >= 3 &&
                  people.length === 0 && (
                    <p className="px-3 py-3 text-xs text-[var(--admin-muted)]">
                      No canonical contact matches this search.
                    </p>
                  )}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-[var(--admin-border)] pt-4">
            <p className="font-mono text-[9px] tabular-nums text-[var(--admin-muted)]">
              {note.length.toLocaleString()} / 5,000 · ⌘⇧M anywhere · ⌘↵ save
            </p>
            <button
              type="submit"
              disabled={!note.trim() || saving}
              className={cn(
                "inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--admin-ink)] px-4 text-xs font-semibold text-[var(--admin-surface)] transition-[opacity,transform] duration-150 hover:opacity-85 active:scale-[0.96]",
                (!note.trim() || saving) && "cursor-not-allowed opacity-45",
              )}
            >
              {saving && <Loader2 className="size-3.5 animate-spin" />}{" "}
              {saving ? "Saving…" : "Save note"}
            </button>
          </div>
        </form>
      </AdminSurface>
    </AdminDialog>
  );
}
