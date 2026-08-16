"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Calendar, Flag, X } from "lucide-react";
import { AdminSurface } from "./AdminSurface";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { fetchJson } from "@/lib/admin/fetchJson";
import { toast } from "@/lib/admin/useToast";
import { adminDialogTransition } from "@/lib/admin/motion";
import { useModalDismiss } from "@/lib/admin/useModalDismiss";

export function AdminCreateTaskModal() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("medium");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener("admin:add-task", show);
    return () => window.removeEventListener("admin:add-task", show);
  }, []);

  const close = () => {
    if (!saving) setOpen(false);
  };
  useModalDismiss(open, close);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      await fetchJson("/api/admin/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          due_date: dueDate || null,
          priority,
        }),
      });
      toast.success("Task added to the operator queue");
      setTitle("");
      setDueDate("");
      setPriority("medium");
      setOpen(false);
      window.dispatchEvent(new CustomEvent("admin:refresh-inbox"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't add task");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence initial={false}>
      {open && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center px-4">
          <motion.button
            type="button"
            aria-label="Close task dialog"
            className="absolute inset-0 bg-black/55"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={adminDialogTransition}
            onClick={close}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-task-title"
            className="relative w-full max-w-md"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={adminDialogTransition}
          >
            <AdminSurface padding="lg" className="admin-dialog-surface">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <p className="admin-eyebrow">Quick create</p>
                  <h2 id="admin-task-title" className="admin-dialog-title">Add a follow-up</h2>
                </div>
                <button
                  type="button"
                  onClick={close}
                  className="admin-icon-button"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <form className="space-y-4" onSubmit={submit}>
                <Input
                  label="What needs to happen?"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Call back, send proposal, review submission…"
                  autoFocus
                />
                <div className="grid grid-cols-2 gap-3">
                  <label className="admin-field-label">
                    <span><Calendar className="h-3.5 w-3.5" /> Due date</span>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(event) => setDueDate(event.target.value)}
                      className="admin-field"
                    />
                  </label>
                  <label className="admin-field-label">
                    <span><Flag className="h-3.5 w-3.5" /> Priority</span>
                    <select
                      value={priority}
                      onChange={(event) => setPriority(event.target.value)}
                      className="admin-field"
                    >
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </label>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <Button type="button" variant="ghost" size="sm" onClick={close}>Cancel</Button>
                  <Button type="submit" size="sm" disabled={saving || !title.trim()}>
                    {saving ? "Adding…" : "Add task"}
                  </Button>
                </div>
              </form>
            </AdminSurface>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
