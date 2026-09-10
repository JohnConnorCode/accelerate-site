"use client";

import { useState } from "react";
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
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("medium");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim() || saving) return;
    setSaving(true);

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
      onTaskCreated?.();
    } catch {
      toast.error("Could not add the follow-up. Your draft is still here; try again.");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className={`inline-flex min-h-11 items-center gap-1.5 text-xs text-[var(--admin-muted)] hover:text-[var(--admin-ink)] transition-colors cursor-pointer ${compact ? "" : "mt-2"}`}
      >
        <Plus className="h-3.5 w-3.5" />
        Add follow-up
      </button>
    );
  }

  return (
    <div
      className={`rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-subtle)] p-3 ${compact ? "" : "mt-2"}`}
    >
      <Input
        aria-label="Follow-up title"
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="e.g., Call back Thursday, Send proposal..."
        className="mb-2"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSubmit();
          if (e.key === "Escape") setIsOpen(false);
        }}
      />
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 text-[var(--admin-muted)]" />
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            aria-label="Due date"
            className="bg-transparent text-xs text-[var(--admin-ink)] border border-[var(--admin-border)] rounded px-2 py-1 focus-visible:outline-none focus-visible:border-[var(--admin-ink)] focus-visible:ring-1 focus-visible:ring-[var(--admin-ink)]/30"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Flag className="h-3.5 w-3.5 text-[var(--admin-muted)]" />
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            aria-label="Priority"
            className="bg-transparent text-xs text-[var(--admin-ink)] border border-[var(--admin-border)] rounded px-2 py-1 focus-visible:outline-none focus-visible:border-[var(--admin-ink)] focus-visible:ring-1 focus-visible:ring-[var(--admin-ink)]/30"
          >
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
        <div className="flex-1" />
        <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={handleSubmit}
          disabled={saving || !title.trim()}
        >
          {saving ? "Adding..." : "Add"}
        </Button>
      </div>
    </div>
  );
}
