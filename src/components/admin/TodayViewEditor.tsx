"use client";
import { useState } from "react";
import { ArrowDown, ArrowUp, Check, GripVertical, Plus, Trash2, X } from "lucide-react";
import { AdminDialog } from "./AdminDialog";
import {
  TODAY_MODULES,
  newTodayModule,
  todayViewSchema,
  type TodayView,
  type TodayModule,
  type TodayScope,
} from "@/lib/admin/today-workspace";
import styles from "./TodayWorkspace.module.css";

export function TodayViewEditor({
  open,
  onClose,
  initial,
  scope,
  canManageWorkspace,
  onSave,
  sources,
  userId,
}: {
  open: boolean;
  onClose: () => void;
  initial: TodayView;
  scope: TodayScope;
  canManageWorkspace: boolean;
  sources: string[];
  userId: string;
  onSave: (view: TodayView, scope: TodayScope, makeDefault: boolean) => Promise<void>;
}) {
  const [draft, setDraft] = useState(initial);
  const [target, setTarget] = useState(scope);
  const [makeDefault, setMakeDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [dragged, setDragged] = useState<string | null>(null);
  function patch(id: string, change: Partial<TodayModule>) {
    setDraft((value) => ({
      ...value,
      modules: value.modules.map((m) => (m.id === id ? { ...m, ...change } : m)),
    }));
  }
  function move(id: string, destination: number) {
    setDraft((value) => {
      const modules = [...value.modules],
        index = modules.findIndex((m) => m.id === id);
      if (index < 0 || destination < 0 || destination >= modules.length) return value;
      modules.splice(destination, 0, modules.splice(index, 1)[0]!);
      return { ...value, modules };
    });
  }
  async function save() {
    setError("");
    const valid = todayViewSchema.safeParse(draft);
    if (!valid.success) {
      setError(valid.error.issues[0]?.message || "Check the view settings.");
      return;
    }
    setSaving(true);
    try {
      await onSave(valid.data, target, makeDefault);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save your view.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <AdminDialog
      open={open}
      onClose={() => {
        if (!saving) onClose();
      }}
      title="Customize Today"
      align="right"
      maxWidth="lg"
    >
      <div className={styles.editor}>
        <header className={styles.editorHeader}>
          <div>
            <p className={styles.eyebrow}>MAKE IT YOURS</p>
            <h2>Customize Today</h2>
            <p>Choose what belongs in your day.</p>
          </div>
          <button
            className={styles.iconButton}
            aria-label="Close customization"
            onClick={onClose}
            disabled={saving}
          >
            <X size={19} />
          </button>
        </header>
        <div className={styles.editorBody}>
          {error && (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          )}
          <div className={styles.fieldGrid}>
            <label className={styles.field}>
              View name
              <input
                data-admin-autofocus="true"
                value={draft.name}
                maxLength={60}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </label>
            <label className={styles.field}>
              Save for
              <select
                aria-label="Save for"
                value={target}
                onChange={(e) => setTarget(e.target.value as TodayScope)}
              >
                <option value="personal">Just me</option>
                {canManageWorkspace && (
                  <option value="workspace">Everyone in this workspace</option>
                )}
              </select>
            </label>
            <label className={styles.field}>
              Spacing
              <select
                value={draft.density}
                onChange={(e) =>
                  setDraft({ ...draft, density: e.target.value as TodayView["density"] })
                }
              >
                <option value="comfortable">Comfortable</option>
                <option value="compact">Compact</option>
              </select>
            </label>
            <label className={styles.checkField}>
              <input
                type="checkbox"
                checked={makeDefault}
                onChange={(e) => setMakeDefault(e.target.checked)}
              />{" "}
              Open this view by default
            </label>
          </div>
          <div className={styles.sectionLabel}>
            <h3>Your modules</h3>
            <span>{draft.modules.length} of 16</span>
          </div>
          <details className={styles.arrangementPreview}>
            <summary>Preview arrangement</summary>
            <div className={styles.previewGrid}>
              {draft.modules.map((module) => (
                <div
                  key={module.id}
                  style={{
                    gridColumn:
                      "span " + (module.width === "full" ? 3 : module.width === "primary" ? 2 : 1),
                  }}
                >
                  {TODAY_MODULES.find((m) => m.id === module.type)?.name}
                </div>
              ))}
            </div>
            <p className={styles.preview}>
              Desktop arrangement. Modules stack in this order on a phone.
            </p>
          </details>
          <p className={styles.muted}>
            Drag to arrange, or use the arrows. Your layout stays in place as content changes.
          </p>
          <div className={styles.editorModules}>
            {draft.modules.map((module, index) => (
              <section
                key={module.id}
                className={styles.editorModule}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragged) move(dragged, index);
                  setDragged(null);
                }}
              >
                <div className={styles.moduleControls}>
                  <span
                    draggable
                    onDragStart={() => setDragged(module.id)}
                    onDragEnd={() => setDragged(null)}
                    className={styles.dragHandle}
                    title="Drag to arrange"
                  >
                    <GripVertical size={17} />
                  </span>
                  <strong>{TODAY_MODULES.find((m) => m.id === module.type)?.name}</strong>
                  <button
                    className={styles.iconButton}
                    aria-label={`Move ${module.type} up`}
                    disabled={index === 0}
                    onClick={() => move(module.id, index - 1)}
                  >
                    <ArrowUp size={16} />
                  </button>
                  <button
                    className={styles.iconButton}
                    aria-label={`Move ${module.type} down`}
                    disabled={index === draft.modules.length - 1}
                    onClick={() => move(module.id, index + 1)}
                  >
                    <ArrowDown size={16} />
                  </button>
                  <button
                    className={styles.iconButton}
                    aria-label={`Remove ${module.type}`}
                    disabled={draft.modules.length === 1}
                    onClick={() =>
                      setDraft({
                        ...draft,
                        modules: draft.modules.filter((m) => m.id !== module.id),
                      })
                    }
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className={styles.fieldGrid}>
                  <label className={styles.field}>
                    Width
                    <select
                      value={module.width}
                      onChange={(e) =>
                        patch(module.id, { width: e.target.value as TodayModule["width"] })
                      }
                    >
                      <option value="full">Full width</option>
                      <option value="primary">Wide</option>
                      <option value="support">Narrow</option>
                    </select>
                  </label>
                  <label className={styles.field}>
                    Show up to
                    <select
                      value={module.limit}
                      onChange={(e) => patch(module.id, { limit: Number(e.target.value) })}
                    >
                      {[3, 5, 8, 12, 20].map((n) => (
                        <option key={n} value={n}>
                          {n} items
                        </option>
                      ))}
                    </select>
                  </label>
                  {["attention", "upcoming", "changes"].includes(module.type) && (
                    <>
                      <label className={styles.field}>
                        Attention
                        <select
                          value={module.filter}
                          onChange={(e) =>
                            patch(module.id, { filter: e.target.value as TodayModule["filter"] })
                          }
                        >
                          {["all", "decision", "work", "watch", "upcoming"].map((value) => (
                            <option key={value} value={value}>
                              {value === "all" ? "All types" : value}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className={styles.field}>
                        Source
                        <select
                          value={module.source}
                          onChange={(e) => patch(module.id, { source: e.target.value })}
                        >
                          <option value="all">All sources</option>
                          {Array.from(new Set([...sources, module.source]))
                            .filter((s) => s !== "all")
                            .map((source) => (
                              <option key={source} value={source}>
                                {source.replaceAll("_", " ")}
                              </option>
                            ))}
                        </select>
                      </label>
                      <label className={styles.field}>
                        Time horizon
                        <select
                          value={module.horizon}
                          onChange={(e) =>
                            patch(module.id, { horizon: e.target.value as TodayModule["horizon"] })
                          }
                        >
                          <option value="all">Any time</option>
                          <option value="today">Through today</option>
                          <option value="week">Next seven days</option>
                        </select>
                      </label>
                      <label className={styles.field}>
                        Task owner
                        <select
                          value={module.owner}
                          onChange={(e) => patch(module.id, { owner: e.target.value })}
                        >
                          <option value="">Any owner</option>
                          {userId && <option value={userId}>Assigned to me</option>}
                          <option value="unassigned">Unassigned tasks</option>
                          {module.owner &&
                            module.owner !== userId &&
                            module.owner !== "unassigned" && (
                              <option value={module.owner}>Selected member</option>
                            )}
                        </select>
                      </label>
                    </>
                  )}
                </div>
                <p className={styles.preview}>
                  Preview ·{" "}
                  {module.width === "full"
                    ? "Full row"
                    : module.width === "primary"
                      ? "Two columns"
                      : "One column"}{" "}
                  on desktop, full width on mobile · up to {module.limit} items
                </p>
              </section>
            ))}
          </div>
          <div className={styles.sectionLabel}>
            <h3>Add a module</h3>
            <Plus size={16} />
          </div>
          <div className={styles.catalog}>
            {TODAY_MODULES.map((module) => (
              <button
                key={module.id}
                disabled={draft.modules.length >= 16}
                onClick={() =>
                  setDraft({
                    ...draft,
                    modules: [...draft.modules, newTodayModule(module.id, crypto.randomUUID())],
                  })
                }
              >
                <strong>{module.name}</strong>
                <span>{module.description}</span>
                <Plus size={16} />
              </button>
            ))}
          </div>
        </div>
        <footer className={styles.editorFooter}>
          <button className={styles.button} onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className={styles.primaryButton} onClick={() => void save()} disabled={saving}>
            <Check size={16} /> {saving ? "Saving…" : "Save view"}
          </button>
        </footer>
      </div>
    </AdminDialog>
  );
}
