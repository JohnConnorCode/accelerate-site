"use client";

import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Calendar, Flag } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { toast } from "@/lib/admin/useToast";
import { Input } from "@/components/ui/Input";

interface TaskQuickAddProps {
  relatedType?: "lead" | "contact" | "partner" | "client";
  relatedId?: string;
  relatedName?: string;
  onTaskCreated?: () => void;
  compact?: boolean;
}

export function TaskQuickAdd({
  relatedType,
  relatedId,
  relatedName,
  onTaskCreated,
  compact,
}: TaskQuickAddProps) {
  const queryClient = useQueryClient();
  const inFlight = useRef(false);
  const [error, setError] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("medium");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim() || inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/admin/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          due_date: dueDate || null,
          priority,
          related_type: relatedType || null,
          related_id: relatedId || null,
          related_name: relatedName || null,
        }),
      });

      if (!res.ok) throw new Error("Failed to create task");

      setTitle("");
      setDueDate("");
      setPriority("medium");
      setIsOpen(false);
      toast.success("Follow-up added");
      void queryClient.invalidateQueries({ queryKey: ["work", "tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["today-workspace"] });
      onTaskCreated?.();
    } catch {
      setError("Could not add the follow-up. Your draft is still here; try again.");
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`inline-flex min-h-11 items-center gap-1.5 text-xs text-[var(--admin-muted)] hover:text-[var(--admin-ink)] transition-colors cursor-pointer ${compact ? "" : "mt-2"}`}
      >
        <Plus className="h-3.5 w-3.5" />
        Add follow-up
      </button>
    );
  }

  return (
    <form
      aria-label="Add follow-up"
      onSubmit={(event) => {
        event.preventDefault();
        void handleSubmit();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && !inFlight.current) setIsOpen(false);
      }}
      className={`rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-subtle)] p-3 ${compact ? "" : "mt-2"}`}
    >
      <fieldset disabled={saving} className="min-w-0" aria-busy={saving}>
        <Input
          aria-label="Follow-up title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g., Call back Thursday, Send proposal..."
          className="mb-2"
          autoFocus
          required
        />
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-[var(--admin-muted)]" />
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              aria-label="Due date"
              className="admin-field min-h-11 min-w-0 rounded-xl bg-[var(--admin-surface)] px-2 text-sm text-[var(--admin-ink)] shadow-[var(--admin-shadow-border)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-ink)]/25"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <Flag className="h-3.5 w-3.5 text-[var(--admin-muted)]" />
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              aria-label="Priority"
              className="admin-field min-h-11 min-w-0 rounded-xl bg-[var(--admin-surface)] px-2 text-sm text-[var(--admin-ink)] shadow-[var(--admin-shadow-border)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-ink)]/25"
            >
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div className="flex-1" />
          <Button type="button" variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" type="submit" disabled={saving || !title.trim()}>
            {saving ? "Adding..." : "Add"}
          </Button>
        </div>
      </fieldset>
      {error && (
        <p role="alert" className="mt-3 text-sm text-[var(--admin-ink)]">
          {error}
        </p>
      )}
    </form>
  );
}
