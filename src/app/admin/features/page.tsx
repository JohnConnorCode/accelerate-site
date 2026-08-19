"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Archive,
  CalendarDays,
  CheckCircle2,
  CircleDot,
  Filter,
  GripVertical,
  KanbanSquare,
  Loader2,
  Lock,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Tag,
  TriangleAlert,
  UserRound,
  X,
} from "lucide-react";
import { AdminSurface } from "@/components/admin/AdminSurface";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { PageHeader } from "@/components/admin/PageHeader";
import { RevenueSetupGate } from "@/components/admin/RevenueSetupGate";
import { fetchJson } from "@/lib/admin/fetchJson";
import { toast } from "@/lib/admin/useToast";
import {
  FEATURE_PRIORITIES,
  FEATURE_STATUSES,
  FEATURE_STATUS_META,
  type FeaturePriority,
  type FeatureRequest,
  type FeatureStatus,
} from "@/lib/feature-board";
import { cn } from "@/lib/utils";

interface BoardResponse { schemaReady: boolean; features: FeatureRequest[] }

const priorityMeta: Record<FeaturePriority, { label: string; tone: string; dot: string }> = {
  urgent: { label: "Urgent", tone: "bg-rose-500/10 text-rose-700 dark:text-rose-300", dot: "bg-rose-500" },
  high: { label: "High", tone: "bg-orange-500/10 text-orange-700 dark:text-orange-300", dot: "bg-orange-500" },
  medium: { label: "Medium", tone: "bg-blue-500/10 text-blue-700 dark:text-blue-300", dot: "bg-blue-500" },
  low: { label: "Low", tone: "bg-slate-500/10 text-slate-700 dark:text-slate-300", dot: "bg-slate-400" },
};

const emptyForm = {
  title: "",
  description: "",
  status: "backlog" as FeatureStatus,
  priority: "medium" as FeaturePriority,
  labels: "",
  owner: "",
  target_date: "",
  acceptance_criteria: "",
  notes: "",
};

function sortFeatures(features: FeatureRequest[]) {
  return [...features].sort((a, b) => Number(a.sort_order) - Number(b.sort_order) || a.created_at.localeCompare(b.created_at));
}

function featureForm(feature?: FeatureRequest | null) {
  if (!feature) return emptyForm;
  return {
    title: feature.title,
    description: feature.description ?? "",
    status: feature.status,
    priority: feature.priority,
    labels: feature.labels.join(", "),
    owner: feature.owner ?? "",
    target_date: feature.target_date ?? "",
    acceptance_criteria: feature.acceptance_criteria ?? "",
    notes: feature.notes ?? "",
  };
}

function dueLabel(date: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
}

function FeatureCard({ feature, disabled, onOpen, overlay = false }: { feature: FeatureRequest; disabled: boolean; onOpen?: () => void; overlay?: boolean }) {
  const sortable = useSortable({ id: feature.id, disabled: disabled || overlay, data: { type: "feature", status: feature.status } });
  const style = overlay ? undefined : { transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition };
  return (
    <article
      ref={overlay ? undefined : sortable.setNodeRef}
      style={style}
      className={cn(
        "group rounded-2xl bg-[var(--admin-surface)] p-3.5 shadow-[var(--admin-shadow-border)] transition-[box-shadow,opacity,scale] duration-150",
        !overlay && "hover:-translate-y-px hover:shadow-[var(--admin-shadow-border-hover)]",
        sortable.isDragging && "opacity-20 shadow-none ring-1 ring-dashed ring-[var(--admin-ink)]/20",
        overlay && "w-[286px] scale-[1.015] cursor-grabbing shadow-[0_24px_60px_-22px_rgba(0,0,0,0.42)] ring-1 ring-black/8",
      )}
    >
      <div className="flex items-start gap-2.5">
        <button
          type="button"
          aria-label={disabled ? "Reordering is unavailable while filters are active" : `Drag ${feature.title}`}
          disabled={disabled || overlay}
          className="grid size-10 shrink-0 touch-none cursor-grab place-items-center rounded-xl text-[var(--admin-muted)] transition-[background-color,color,transform] duration-150 hover:bg-black/[0.04] hover:text-[var(--admin-ink)] active:cursor-grabbing active:scale-[0.96] disabled:cursor-default disabled:opacity-30 dark:hover:bg-white/[0.05]"
          {...(!overlay ? sortable.attributes : {})}
          {...(!overlay ? sortable.listeners : {})}
        >
          <GripVertical className="size-4" />
        </button>
        <button type="button" onClick={onOpen} disabled={overlay} className="min-w-0 flex-1 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-ink)]/30">
          <h3 className="text-pretty text-sm font-semibold leading-5 text-[var(--admin-ink)]">{feature.title}</h3>
          {feature.description && <p className="admin-copy mt-1.5 line-clamp-2 text-xs leading-5">{feature.description}</p>}
        </button>
        {!overlay && <button type="button" onClick={onOpen} aria-label={`Edit ${feature.title}`} className="grid size-10 shrink-0 place-items-center rounded-xl text-[var(--admin-muted)] opacity-70 transition-[background-color,color,opacity,transform] duration-150 hover:bg-black/[0.04] hover:text-[var(--admin-ink)] active:scale-[0.96] group-hover:opacity-100 dark:hover:bg-white/[0.05]"><Pencil className="size-3.5" /></button>}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5 pl-[50px]">
        <span className={cn("inline-flex min-h-6 items-center gap-1.5 rounded-full px-2 text-[10px] font-semibold", priorityMeta[feature.priority].tone)}>
          <span className={cn("size-1.5 rounded-full", priorityMeta[feature.priority].dot)} />{priorityMeta[feature.priority].label}
        </span>
        {feature.seed_key && <span title="Managed by scripts/feature-backlog-data.mjs" className="inline-flex min-h-6 items-center gap-1 rounded-full bg-black/[0.045] px-2 text-[10px] font-medium text-[var(--admin-muted)] dark:bg-white/[0.06]"><Lock className="size-2.5" />Managed</span>}
        {feature.labels.slice(0, 3).map((label) => <span key={label} className="inline-flex min-h-6 items-center rounded-full bg-black/[0.045] px-2 text-[10px] font-medium text-[var(--admin-muted)] dark:bg-white/[0.06]">{label}</span>)}
        {feature.labels.length > 3 && <span className="font-mono text-[10px] tabular-nums text-[var(--admin-muted)]">+{feature.labels.length - 3}</span>}
      </div>
      {(feature.owner || feature.target_date) && <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[var(--admin-border)] pt-2.5 pl-[50px] text-[10px] text-[var(--admin-muted)]">
        {feature.owner && <span className="inline-flex items-center gap-1.5"><UserRound className="size-3" />{feature.owner}</span>}
        {feature.target_date && <span className="inline-flex items-center gap-1.5 font-mono tabular-nums"><CalendarDays className="size-3" />{dueLabel(feature.target_date)}</span>}
      </div>}
    </article>
  );
}

function BoardColumn({ status, features, dragDisabled, onOpen }: { status: FeatureStatus; features: FeatureRequest[]; dragDisabled: boolean; onOpen: (feature: FeatureRequest) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: `column:${status}`, data: { type: "column", status } });
  const meta = FEATURE_STATUS_META[status];
  return (
    <section className="w-[310px] shrink-0 snap-start lg:snap-none" aria-labelledby={`column-${status}`}>
      <div className="mb-2.5 flex items-start justify-between gap-3 px-1">
        <div>
          <div className="flex items-center gap-2"><span className={cn("size-2 rounded-full", meta.accent)} /><h2 id={`column-${status}`} className="text-sm font-semibold text-[var(--admin-ink)]">{meta.label}</h2></div>
          <p className="admin-copy mt-1 text-[10px]">{meta.description}</p>
        </div>
        <span className="rounded-full bg-black/[0.045] px-2 py-1 font-mono text-[10px] tabular-nums text-[var(--admin-muted)] dark:bg-white/[0.06]">{features.length}</span>
      </div>
      <div ref={setNodeRef} className={cn("min-h-[360px] space-y-2.5 rounded-2xl bg-black/[0.018] p-2.5 shadow-[inset_0_0_0_1px_var(--admin-border)] transition-[background-color,box-shadow] duration-150 dark:bg-white/[0.018]", isOver && !dragDisabled && "bg-amber-500/[0.055] shadow-[inset_0_0_0_1px_rgba(184,134,11,0.38),0_12px_30px_-24px_rgba(90,60,0,0.5)] dark:bg-amber-300/[0.045]")}>
        <SortableContext items={features.map((feature) => feature.id)} strategy={verticalListSortingStrategy}>
          {features.map((feature) => <FeatureCard key={feature.id} feature={feature} disabled={dragDisabled} onOpen={() => onOpen(feature)} />)}
        </SortableContext>
        {!features.length && <div className="grid min-h-40 place-items-center rounded-xl"><div className="text-center"><CircleDot className="mx-auto size-4 text-[var(--admin-muted)]/55" /><p className="admin-copy mt-2 text-xs">Drop a card here</p></div></div>}
      </div>
    </section>
  );
}

function FeatureDialog({ feature, defaultStatus, saving, onClose, onSave, onArchive }: { feature: FeatureRequest | null; defaultStatus: FeatureStatus; saving: boolean; onClose: () => void; onSave: (payload: Record<string, unknown>) => Promise<void>; onArchive: (feature: FeatureRequest) => Promise<void> }) {
  const [form, setForm] = useState(() => ({ ...featureForm(feature), status: feature?.status ?? defaultStatus }));
  const inputClass = "mt-1.5 min-h-11 w-full rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-subtle)] px-3.5 text-sm font-normal text-[var(--admin-ink)] outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-[var(--admin-muted)]/65 focus:border-[var(--admin-ink)] focus:ring-2 focus:ring-[var(--admin-ink)]/10";
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSave({ ...form, id: feature?.id, labels: form.labels.split(",").map((label) => label.trim()).filter(Boolean) });
  };
  return <AdminDialog open onClose={onClose} title={feature ? "Edit feature" : "Add feature"} labelledBy="feature-dialog-title" maxWidth="lg">
    <form onSubmit={(event) => void submit(event)} className="max-h-[92dvh] w-full overflow-y-auto rounded-t-[24px] bg-[var(--admin-surface)] shadow-2xl sm:rounded-[24px]">
      <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[var(--admin-border)] bg-[var(--admin-surface)]/95 px-5 py-4 backdrop-blur-xl sm:px-6">
        <div><p className="admin-eyebrow">Feature board</p><h2 id="feature-dialog-title" className="mt-1 text-balance text-xl font-semibold tracking-[-0.03em] text-[var(--admin-ink)]">{feature ? "Feature details" : "Add feature"}</h2></div>
        <button type="button" onClick={onClose} aria-label="Close feature details" className="grid size-10 place-items-center rounded-xl text-[var(--admin-muted)] transition-[background-color,color,transform] duration-150 hover:bg-black/[0.04] hover:text-[var(--admin-ink)] active:scale-[0.96] dark:hover:bg-white/[0.05]"><X className="size-4" /></button>
      </div>
      {feature?.seed_key && <div className="mx-5 mt-5 flex items-start gap-2.5 rounded-xl border border-amber-500/25 bg-amber-500/[0.07] px-3.5 py-3 sm:mx-6">
        <TriangleAlert className="mt-px size-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <p className="admin-copy text-[11px] leading-5">
          <span className="font-semibold text-[var(--admin-ink)]">Managed card ({feature.seed_key}).</span>{" "}
          Edits saved here are overwritten the next time the backlog is reconciled. Change it in <span className="font-mono">scripts/feature-backlog-data.mjs</span>, then run <span className="font-mono">npm run seed:features -- --apply</span>. Status and Owner are the exception only while a card is actively claimed.
        </p>
      </div>}
      {!feature && <div className="mx-5 mt-5 flex items-start gap-2.5 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-subtle)] px-3.5 py-3 sm:mx-6">
        <TriangleAlert className="mt-px size-4 shrink-0 text-[var(--admin-muted)]" />
        <p className="admin-copy text-[11px] leading-5">Cards added here are not in the managed manifest and are archived the next time the backlog is reconciled. For work that should persist, add it to <span className="font-mono">scripts/feature-backlog-data.mjs</span> with a stable key.</p>
      </div>}
      <div className="grid gap-5 px-5 py-5 sm:grid-cols-2 sm:px-6 sm:py-6">
        <label className="text-xs font-semibold text-[var(--admin-ink)] sm:col-span-2">Title<input autoFocus required maxLength={180} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className={inputClass} placeholder="What should we build?" /></label>
        <label className="text-xs font-semibold text-[var(--admin-ink)] sm:col-span-2">Description<textarea rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className={cn(inputClass, "min-h-24 py-3 leading-6")} placeholder="Why it matters and what should change" /></label>
        <label className="text-xs font-semibold text-[var(--admin-ink)]">Status<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as FeatureStatus })} className={inputClass}>{FEATURE_STATUSES.map((status) => <option key={status} value={status}>{FEATURE_STATUS_META[status].label}</option>)}</select></label>
        <label className="text-xs font-semibold text-[var(--admin-ink)]">Priority<select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value as FeaturePriority })} className={inputClass}>{FEATURE_PRIORITIES.map((priority) => <option key={priority} value={priority}>{priorityMeta[priority].label}</option>)}</select></label>
        <label className="text-xs font-semibold text-[var(--admin-ink)]">Owner<input value={form.owner} onChange={(event) => setForm({ ...form, owner: event.target.value })} className={inputClass} placeholder="John" /></label>
        <label className="text-xs font-semibold text-[var(--admin-ink)]">Target date<input type="date" value={form.target_date} onChange={(event) => setForm({ ...form, target_date: event.target.value })} className={inputClass} /></label>
        <label className="text-xs font-semibold text-[var(--admin-ink)] sm:col-span-2">Labels<input value={form.labels} onChange={(event) => setForm({ ...form, labels: event.target.value })} className={inputClass} placeholder="admin, revenue, integration" /><span className="admin-copy mt-1.5 block text-[10px]">Separate labels with commas. They are normalized when saved.</span></label>
        <label className="text-xs font-semibold text-[var(--admin-ink)] sm:col-span-2">Definition of done<textarea rows={3} value={form.acceptance_criteria} onChange={(event) => setForm({ ...form, acceptance_criteria: event.target.value })} className={cn(inputClass, "min-h-24 py-3 leading-6")} placeholder="The observable result that proves this is shipped" /></label>
        <label className="text-xs font-semibold text-[var(--admin-ink)] sm:col-span-2">Internal notes<textarea rows={3} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} className={cn(inputClass, "min-h-24 py-3 leading-6")} placeholder="Dependencies, decisions, links, or implementation notes" /></label>
      </div>
      <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface)]/95 px-5 py-4 backdrop-blur-xl sm:px-6">
        <div>{feature && <button type="button" disabled={saving} onClick={() => void onArchive(feature)} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-xs font-semibold text-rose-700 transition-[background-color,transform] duration-150 hover:bg-rose-500/10 active:scale-[0.96] disabled:opacity-50 dark:text-rose-300"><Archive className="size-3.5" /> Archive</button>}</div>
        <div className="flex gap-2"><button type="button" onClick={onClose} className="min-h-11 rounded-xl px-4 text-xs font-semibold text-[var(--admin-muted)] transition-[color,transform] duration-150 hover:text-[var(--admin-ink)] active:scale-[0.96]">Cancel</button><button type="submit" disabled={saving} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--admin-ink)] px-4 text-xs font-semibold text-[var(--admin-surface)] transition-[opacity,transform] duration-150 hover:opacity-85 active:scale-[0.96] disabled:opacity-50">{saving && <Loader2 className="size-3.5 animate-spin" />}{feature ? "Save changes" : "Add to board"}</button></div>
      </div>
    </form>
  </AdminDialog>;
}

function previewMove(features: FeatureRequest[], activeId: string, overId: string): FeatureRequest[] {
  const active = features.find((feature) => feature.id === activeId);
  if (!active) return features;
  const overFeature = features.find((feature) => feature.id === overId);
  const targetStatus = overId.startsWith("column:")
    ? overId.slice(7) as FeatureStatus
    : overFeature?.status;
  if (!targetStatus) return features;
  const sourceStatus = active.status;
  const source = sortFeatures(features.filter((feature) => feature.status === sourceStatus));
  const target = sourceStatus === targetStatus ? source : sortFeatures(features.filter((feature) => feature.status === targetStatus));
  let moved: FeatureRequest[];
  if (sourceStatus === targetStatus) {
    const from = source.findIndex((feature) => feature.id === activeId);
    const to = overFeature ? source.findIndex((feature) => feature.id === overFeature.id) : source.length - 1;
    if (from < 0 || to < 0 || from === to) return features;
    moved = arrayMove(source, from, to);
  } else {
    const insertion = overFeature ? target.findIndex((feature) => feature.id === overFeature.id) : target.length;
    const cleanSource = source.filter((feature) => feature.id !== activeId);
    const cleanTarget = [...target];
    cleanTarget.splice(Math.max(0, insertion), 0, { ...active, status: targetStatus });
    moved = [...cleanSource, ...cleanTarget];
  }
  const affected = new Set([sourceStatus, targetStatus]);
  const normalized = FEATURE_STATUSES.flatMap((status) => affected.has(status)
    ? moved.filter((feature) => feature.status === status).map((feature, index) => ({ ...feature, sort_order: (index + 1) * 1000 }))
    : []);
  const map = new Map(normalized.map((feature) => [feature.id, feature]));
  return features.map((feature) => map.get(feature.id) ?? feature);
}

export default function FeaturesPage() {
  const [data, setData] = useState<BoardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState<"all" | FeaturePriority>("all");
  const [label, setLabel] = useState("all");
  const [openFeature, setOpenFeature] = useState<FeatureRequest | null | undefined>(undefined);
  const [newStatus, setNewStatus] = useState<FeatureStatus>("backlog");
  const [activeId, setActiveId] = useState<string | null>(null);
  const dragSnapshotRef = useRef<FeatureRequest[] | null>(null);
  const lastOverRef = useRef<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const load = useCallback(async () => {
    setError("");
    try { setData(await fetchJson<BoardResponse>("/api/admin/features")); }
    catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Could not load the feature board."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const features = useMemo(() => data?.features ?? [], [data?.features]);
  const labels = useMemo(() => [...new Set(features.flatMap((feature) => feature.labels))].sort(), [features]);
  const filtered = useMemo(() => features.filter((feature) => {
    if (priority !== "all" && feature.priority !== priority) return false;
    if (label !== "all" && !feature.labels.includes(label)) return false;
    const term = search.trim().toLowerCase();
    return !term || [feature.title, feature.description, feature.owner, ...feature.labels].filter(Boolean).join(" ").toLowerCase().includes(term);
  }), [features, label, priority, search]);
  const filtersActive = Boolean(search.trim() || priority !== "all" || label !== "all");
  const activeFeature = activeId ? features.find((feature) => feature.id === activeId) ?? null : null;

  const byStatus = (status: FeatureStatus) => sortFeatures(filtered.filter((feature) => feature.status === status));

  const saveFeature = async (payload: Record<string, unknown>) => {
    setSaving(true);
    try {
      const updated = await fetchJson<FeatureRequest>("/api/admin/features", { method: payload.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      setData((current) => current ? { ...current, features: payload.id ? current.features.map((feature) => feature.id === updated.id ? updated : feature) : [...current.features, updated] } : current);
      setOpenFeature(undefined);
      toast.success(payload.id ? "Feature updated" : "Feature added to the board");
    } catch (saveError) { toast.error(saveError instanceof Error ? saveError.message : "Could not save feature."); }
    finally { setSaving(false); }
  };

  const archiveFeature = async (feature: FeatureRequest) => {
    if (!window.confirm(`Archive “${feature.title}”? It will leave the active board but remain in the audit history.`)) return;
    setSaving(true);
    try {
      await fetchJson(`/api/admin/features?id=${encodeURIComponent(feature.id)}`, { method: "DELETE" });
      setData((current) => current ? { ...current, features: current.features.filter((item) => item.id !== feature.id) } : current);
      setOpenFeature(undefined);
      toast.success("Feature archived");
    } catch (archiveError) { toast.error(archiveError instanceof Error ? archiveError.message : "Could not archive feature."); }
    finally { setSaving(false); }
  };

  const handleDragStart = ({ active }: DragStartEvent) => {
    if (!data) return;
    dragSnapshotRef.current = data.features;
    lastOverRef.current = null;
    setActiveId(String(active.id));
  };

  const handleDragOver = ({ active, over }: DragOverEvent) => {
    if (!over || !data || filtersActive || saving) return;
    const overId = String(over.id);
    if (lastOverRef.current === overId) return;
    lastOverRef.current = overId;
    setData((current) => current ? { ...current, features: previewMove(current.features, String(active.id), overId) } : current);
  };

  const cancelDrag = () => {
    const snapshot = dragSnapshotRef.current;
    if (snapshot) setData((current) => current ? { ...current, features: snapshot } : current);
    dragSnapshotRef.current = null;
    lastOverRef.current = null;
    setActiveId(null);
  };

  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    const snapshot = dragSnapshotRef.current;
    dragSnapshotRef.current = null;
    lastOverRef.current = null;
    if (!over || filtersActive || !data || !snapshot) {
      if (snapshot) setData((current) => current ? { ...current, features: snapshot } : current);
      return;
    }
    const beforeFeature = snapshot.find((feature) => feature.id === String(active.id));
    const afterFeature = data.features.find((feature) => feature.id === String(active.id));
    if (!beforeFeature || !afterFeature) return;
    const affectedStatuses = new Set([beforeFeature.status, afterFeature.status]);
    const normalized = FEATURE_STATUSES.flatMap((status) => affectedStatuses.has(status)
      ? sortFeatures(data.features.filter((feature) => feature.status === status)).map((feature, index) => ({ ...feature, sort_order: (index + 1) * 1000 }))
      : []);
    const unchanged = normalized.every((feature) => {
      const original = snapshot.find((item) => item.id === feature.id);
      return original?.status === feature.status && Number(original.sort_order) === Number(feature.sort_order);
    });
    if (unchanged) return;
    try {
      await fetchJson("/api/admin/features", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reorder: normalized.map((feature) => ({ id: feature.id, status: feature.status, sortOrder: feature.sort_order })) }) });
      toast.success(beforeFeature.status === afterFeature.status ? "Feature order saved" : `Moved to ${FEATURE_STATUS_META[afterFeature.status].label}`);
    } catch (moveError) {
      setData({ ...data, features: snapshot });
      toast.error(moveError instanceof Error ? moveError.message : "Could not save the new order.");
    }
  };

  if (loading && !data) return <div className="grid min-h-[55vh] place-items-center"><Loader2 className="size-6 animate-spin text-[var(--admin-muted)]" /></div>;
  return <div className="space-y-6 pb-10">
    <PageHeader title="Feature Board" subtitle="The working roadmap for what we build next. Prioritize, label, document, and drag work from backlog through verified delivery." actions={<><button type="button" onClick={() => void load()} disabled={loading} aria-label="Refresh feature board" className="grid size-11 place-items-center rounded-xl text-[var(--admin-ink)] shadow-[var(--admin-shadow-border)] transition-[box-shadow,transform] duration-150 hover:shadow-[var(--admin-shadow-border-hover)] active:scale-[0.96]"><RefreshCw className={cn("size-4", loading && "animate-spin")} /></button><button type="button" onClick={() => { setNewStatus("backlog"); setOpenFeature(null); }} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--admin-ink)] px-4 text-xs font-semibold text-[var(--admin-surface)] transition-[opacity,transform] duration-150 hover:opacity-85 active:scale-[0.96]"><Plus className="size-3.5" /> New feature</button></>} />
    {error && <AdminSurface tone="attention" className="flex items-center gap-3"><TriangleAlert className="size-5 shrink-0 text-rose-600" /><p className="text-sm text-[var(--admin-ink)]">{error}</p></AdminSurface>}
    {data && !data.schemaReady ? <RevenueSetupGate title="Activate the Feature Board" migration="migrations/20260816-feature-board.sql" detail="The migration seeds the known Revenue OS roadmap without overwriting future edits." /> : data && <>
      <section className="grid gap-3 sm:grid-cols-3">
        {[{ label: "Open work", value: features.filter((feature) => feature.status !== "shipped").length, note: "Across the active roadmap", icon: KanbanSquare }, { label: "Urgent", value: features.filter((feature) => feature.priority === "urgent" && feature.status !== "shipped").length, note: "Requires the next decision", icon: TriangleAlert }, { label: "Shipped", value: features.filter((feature) => feature.status === "shipped").length, note: "Delivered and verified", icon: CheckCircle2 }].map(({ label: metricLabel, value, note, icon: Icon }) => <AdminSurface key={metricLabel} padding="lg"><div className="flex items-start justify-between gap-3"><div><p className="admin-eyebrow">{metricLabel}</p><p className="mt-3 text-3xl font-semibold tabular-nums tracking-[-0.045em] text-[var(--admin-ink)]">{value}</p><p className="admin-copy mt-1 text-xs">{note}</p></div><span className="grid size-9 place-items-center rounded-xl bg-black/[0.045] text-[var(--admin-ink)] dark:bg-white/[0.06]"><Icon className="size-4" /></span></div></AdminSurface>)}
      </section>
      <AdminSurface padding="sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[var(--admin-muted)]" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title, details, owner, or label" className="min-h-11 w-full rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-subtle)] pl-10 pr-3.5 text-sm text-[var(--admin-ink)] outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-[var(--admin-muted)]/70 focus:border-[var(--admin-ink)] focus:ring-2 focus:ring-[var(--admin-ink)]/10" /></div>
          <div className="flex flex-wrap items-center gap-2"><Filter className="size-4 text-[var(--admin-muted)]" /><select value={priority} onChange={(event) => setPriority(event.target.value as "all" | FeaturePriority)} aria-label="Filter by priority" className="min-h-11 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-xs font-semibold text-[var(--admin-ink)] outline-none focus:border-[var(--admin-ink)]"><option value="all">All priorities</option>{FEATURE_PRIORITIES.map((value) => <option key={value} value={value}>{priorityMeta[value].label}</option>)}</select><select value={label} onChange={(event) => setLabel(event.target.value)} aria-label="Filter by label" className="min-h-11 max-w-48 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-xs font-semibold text-[var(--admin-ink)] outline-none focus:border-[var(--admin-ink)]"><option value="all">All labels</option>{labels.map((value) => <option key={value} value={value}>{value}</option>)}</select><span className="rounded-full bg-black/[0.045] px-2.5 py-1 font-mono text-[10px] tabular-nums text-[var(--admin-muted)] dark:bg-white/[0.06]">{filtered.length}</span></div>
        </div>
        {filtersActive && <p className="admin-copy mt-2 flex items-center gap-1.5 px-1 text-[10px]"><Tag className="size-3" />Reordering is paused while filters are active so hidden cards keep their exact priority.</p>}
      </AdminSurface>
      <DndContext sensors={sensors} collisionDetection={closestCorners} measuring={{ droppable: { strategy: MeasuringStrategy.Always } }} autoScroll onDragStart={handleDragStart} onDragOver={handleDragOver} onDragCancel={cancelDrag} onDragEnd={(event) => void handleDragEnd(event)}>
        <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-5 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 xl:-mx-10 xl:px-10">
          {FEATURE_STATUSES.map((status) => <BoardColumn key={status} status={status} features={byStatus(status)} dragDisabled={filtersActive} onOpen={(feature) => setOpenFeature(feature)} />)}
        </div>
        <DragOverlay adjustScale={false} dropAnimation={null}>{activeFeature ? <FeatureCard feature={activeFeature} disabled overlay /> : null}</DragOverlay>
      </DndContext>
      <div className="flex flex-col gap-2 rounded-2xl bg-black/[0.025] px-4 py-3 text-xs text-[var(--admin-muted)] dark:bg-white/[0.025] sm:flex-row sm:items-center sm:justify-between"><p>Drag by the grip to reprioritize or move work. Open a card for its definition of done and implementation notes.</p><p className="shrink-0 font-mono text-[10px] tabular-nums">Order saves automatically</p></div>
    </>}
    {openFeature !== undefined && <FeatureDialog key={openFeature?.id ?? `new-${newStatus}`} feature={openFeature} defaultStatus={newStatus} saving={saving} onClose={() => setOpenFeature(undefined)} onSave={saveFeature} onArchive={archiveFeature} />}
  </div>;
}
