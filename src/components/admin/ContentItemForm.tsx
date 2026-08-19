"use client";

import { useState } from "react";
import { X, Sparkles, Trash2, Loader2 } from "lucide-react";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { AdminSurface } from "@/components/admin/AdminSurface";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Toast } from "@/components/ui/Toast";
import type { ContentCalendarItem, ContentStatus, ArticleCategory, ArticlePillar } from "@/lib/types";

interface ContentItemFormProps {
  item?: ContentCalendarItem | null;
  onSave: (data: Partial<ContentCalendarItem>) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
}

const statusOptions = [
  { value: "idea", label: "Idea" },
  { value: "outline", label: "Outline" },
  { value: "draft", label: "Draft" },
  { value: "review", label: "Review" },
  { value: "published", label: "Published" },
];

const categoryOptions = [
  { value: "lead-generation", label: "Lead Generation" },
  { value: "automation", label: "Automation" },
  { value: "ai-tools", label: "AI Tools" },
  { value: "industry", label: "Industry" },
  { value: "foundational", label: "Foundational" },
  { value: "local-seo", label: "Local SEO" },
];

const pillarOptions = [
  { value: "Lead Gen", label: "Lead Gen" },
  { value: "Automation", label: "Automation" },
  { value: "AI Tools", label: "AI Tools" },
  { value: "Industry", label: "Industry" },
  { value: "Foundational", label: "Foundational" },
  { value: "Local SEO", label: "Local SEO" },
];

const funnelOptions = [
  { value: "awareness", label: "Awareness" },
  { value: "consideration", label: "Consideration" },
  { value: "decision", label: "Decision" },
];

export function ContentItemForm({ item, onSave, onDelete, onClose }: ContentItemFormProps) {
  const [title, setTitle] = useState(item?.title || "");
  const [slug, setSlug] = useState(item?.slug || "");
  const [status, setStatus] = useState<ContentStatus>(item?.status || "idea");
  const [category, setCategory] = useState<ArticleCategory | "">(
    (item?.category as ArticleCategory) || ""
  );
  const [pillar, setPillar] = useState<ArticlePillar | "">(
    (item?.pillar as ArticlePillar) || ""
  );
  const [funnelStage, setFunnelStage] = useState(item?.funnel_stage || "");
  const [targetPublishDate, setTargetPublishDate] = useState(
    item?.target_publish_date?.split("T")[0] || ""
  );
  const [actualPublishDate, setActualPublishDate] = useState(
    item?.actual_publish_date?.split("T")[0] || ""
  );
  const [author, setAuthor] = useState(item?.author || "");
  const [keywords, setKeywords] = useState(
    item?.target_keywords?.join(", ") || ""
  );
  const [notes, setNotes] = useState(item?.notes || "");
  const [seoTitle, setSeoTitle] = useState(item?.seo_title || "");
  const [seoDescription, setSeoDescription] = useState(
    item?.seo_description || ""
  );
  const [wordCountTarget, setWordCountTarget] = useState(
    item?.word_count_target?.toString() || "1500"
  );
  const [saving, setSaving] = useState(false);
  const [generatingBrief, setGeneratingBrief] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await onSave({
      ...(item?.id ? { id: item.id } : {}),
      title,
      slug: slug || title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      status,
      category: category || undefined,
      pillar: (pillar as ArticlePillar) || undefined,
      funnel_stage: (funnelStage as "awareness" | "consideration" | "decision") || undefined,
      target_publish_date: targetPublishDate || undefined,
      actual_publish_date: actualPublishDate || undefined,
      author: author || undefined,
      target_keywords: keywords
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean),
      notes: notes || undefined,
      seo_title: seoTitle || undefined,
      seo_description: seoDescription || undefined,
      word_count_target: parseInt(wordCountTarget) || undefined,
    });
    setSaving(false);
    onClose();
  };

  const handleGenerateBrief = async () => {
    if (!title) {
      setToast({ message: "Enter a title first", type: "error" });
      return;
    }
    setGeneratingBrief(true);
    try {
      const res = await fetch("/api/admin/ai-content-brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, keywords, category }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const brief = data.brief;
      if (brief.seoTitle) setSeoTitle(brief.seoTitle);
      if (brief.seoDescription) setSeoDescription(brief.seoDescription);
      if (brief.wordCount) setWordCountTarget(String(brief.wordCount));
      if (brief.outline) {
        setNotes((prev) =>
          prev
            ? `${prev}\n\n--- AI Brief ---\n${brief.outline.join("\n")}`
            : `--- AI Brief ---\n${brief.outline.join("\n")}`
        );
      }
      setToast({ message: "AI brief generated", type: "success" });
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : "Failed to generate brief",
        type: "error",
      });
    } finally {
      setGeneratingBrief(false);
    }
  };

  const handleDelete = () => {
    if (item?.id && onDelete) {
      onDelete(item.id);
      onClose();
    }
  };

  return (
    <AdminDialog open onClose={onClose} title={item ? "Edit content" : "New content"} align="right" maxWidth="md" className="h-full">
      <div className="h-full w-full overflow-y-auto bg-[var(--admin-surface)] p-5 shadow-[-24px_0_70px_-34px_rgba(0,0,0,0.6)] sm:p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-display text-lg font-semibold text-white-primary">
            {item ? "Edit Content" : "New Content"}
          </h3>
          <div className="flex items-center gap-2">
            {item?.id && onDelete && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="text-white-muted hover:text-[var(--error)] cursor-pointer"
                title="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="text-white-muted hover:text-white-primary cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="px-3 py-2 text-sm"
          />

          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleGenerateBrief}
            disabled={generatingBrief || !title}
            className="w-full text-gold-light"
          >
            {generatingBrief ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            {generatingBrief ? "Generating Brief..." : "Generate AI Brief"}
          </Button>

          <Input
            label="Slug"
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="auto-generated from title"
            className="px-3 py-2 text-sm"
          />

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Status"
              value={status}
              onChange={(e) => setStatus(e.target.value as ContentStatus)}
              options={statusOptions}
              className="px-3 py-2 text-sm"
            />
            <Select
              label="Category"
              value={category}
              onChange={(e) => setCategory(e.target.value as ArticleCategory)}
              options={categoryOptions}
              placeholder="Select..."
              className="px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Pillar"
              value={pillar}
              onChange={(e) => setPillar(e.target.value as ArticlePillar)}
              options={pillarOptions}
              placeholder="Select..."
              className="px-3 py-2 text-sm"
            />
            <Select
              label="Funnel Stage"
              value={funnelStage}
              onChange={(e) => setFunnelStage(e.target.value)}
              options={funnelOptions}
              placeholder="Select..."
              className="px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Target Publish"
              type="date"
              value={targetPublishDate}
              onChange={(e) => setTargetPublishDate(e.target.value)}
              className="px-3 py-2 text-sm"
            />
            <Input
              label="Actual Publish"
              type="date"
              value={actualPublishDate}
              onChange={(e) => setActualPublishDate(e.target.value)}
              className="px-3 py-2 text-sm"
            />
          </div>

          <Input
            label="Author"
            type="text"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="Author name"
            className="px-3 py-2 text-sm"
          />

          <Input
            label="Target Keywords (comma-separated)"
            type="text"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            className="px-3 py-2 text-sm"
          />

          <Input
            label="Word Count Target"
            type="number"
            value={wordCountTarget}
            onChange={(e) => setWordCountTarget(e.target.value)}
            className="px-3 py-2 text-sm"
          />

          <Input
            label="SEO Title"
            type="text"
            value={seoTitle}
            onChange={(e) => setSeoTitle(e.target.value)}
            className="px-3 py-2 text-sm"
          />

          <Textarea
            label="SEO Description"
            value={seoDescription}
            onChange={(e) => setSeoDescription(e.target.value)}
            rows={2}
            className="px-3 py-2 text-sm min-h-[60px]"
          />

          <Textarea
            label="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            className="px-3 py-2 text-sm min-h-[100px]"
          />

          <Button type="submit" variant="primary" size="sm" disabled={saving} className="w-full">
            {saving ? "Saving..." : item ? "Update" : "Create"}
          </Button>
        </form>

        {/* Delete confirmation */}
        <AdminDialog open={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="Delete content?" maxWidth="sm">
                <AdminSurface padding="lg" className="admin-dialog-surface">
                  <h4 className="font-display text-white-primary font-semibold mb-2">Delete Content?</h4>
                  <p className="text-sm text-white-muted mb-4">
                    This action cannot be undone. The content item will be permanently deleted.
                  </p>
                  <div className="flex gap-3">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setShowDeleteConfirm(false)}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleDelete}
                      className="flex-1 text-red-300 hover:bg-red-500/20"
                    >
                      Delete
                    </Button>
                  </div>
                </AdminSurface>
        </AdminDialog>

        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            isVisible={true}
            onClose={() => setToast(null)}
          />
        )}
      </div>
    </AdminDialog>
  );
}
