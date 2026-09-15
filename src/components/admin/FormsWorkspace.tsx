"use client";

import { useState } from "react";
import { AdminSurface } from "./AdminSurface";
import { useAdminQuery } from "@/lib/admin/useAdminQuery";
import { fetchJson } from "@/lib/admin/fetchJson";
import { SurveyRunner } from "@/components/forms/SurveyRunner";
import type { FormDefinition, FormSubmission } from "@/lib/revenue-os/form-builder";

type BuilderElement = {
  name: string;
  title?: string;
  type: "text" | "comment" | "dropdown" | "radiogroup" | "checkbox" | "boolean" | "rating";
  inputType?: "text" | "email" | "tel" | "number" | "date";
  isRequired?: boolean;
  choices?: string[];
};

const FIELD_TYPES: BuilderElement["type"][] = [
  "text",
  "comment",
  "dropdown",
  "radiogroup",
  "checkbox",
  "boolean",
  "rating",
];

const button =
  "inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold shadow-[var(--admin-shadow-border)] hover:bg-[var(--admin-surface-subtle)] disabled:opacity-50";
const field =
  "mt-1 min-h-11 w-full rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-sm";
const smallButton =
  "inline-flex min-h-9 items-center justify-center rounded-lg px-3 text-xs font-semibold shadow-[var(--admin-shadow-border)] hover:bg-[var(--admin-surface-subtle)] disabled:opacity-50";

async function postAction<T>(body: unknown): Promise<T> {
  return fetchJson<T>("/api/admin/forms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function slugify(label: string, index: number) {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
  return slug || `field_${index + 1}`;
}

function StarterTemplates({ onPick }: { onPick: (elements: BuilderElement[]) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        className={smallButton}
        onClick={() =>
          onPick([
            { name: "name", title: "Full name", type: "text", isRequired: true },
            {
              name: "email",
              title: "Work email",
              type: "text",
              inputType: "email",
              isRequired: true,
            },
            { name: "company", title: "Company", type: "text" },
            { name: "message", title: "What do you need?", type: "comment", isRequired: true },
          ])
        }
      >
        Lead capture template
      </button>
      <button
        type="button"
        className={smallButton}
        onClick={() =>
          onPick([
            { name: "name", title: "Full name", type: "text", isRequired: true },
            { name: "email", title: "Email", type: "text", inputType: "email", isRequired: true },
            {
              name: "topic",
              title: "What is this about?",
              type: "dropdown",
              isRequired: true,
              choices: ["Support request", "Feedback", "Sales question", "Other"],
            },
            { name: "details", title: "Details", type: "comment", isRequired: true },
            { name: "rating", title: "How are we doing?", type: "rating" },
          ])
        }
      >
        Client intake template
      </button>
    </div>
  );
}

function ElementEditor({
  element,
  onChange,
  onRemove,
  onMove,
  isFirst,
  isLast,
}: {
  element: BuilderElement;
  onChange: (next: BuilderElement) => void;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  return (
    <div className="rounded-xl border border-[var(--admin-border)] p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted)]">
          {element.type} · {element.name}
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            className={smallButton}
            disabled={isFirst}
            onClick={() => onMove(-1)}
            aria-label="Move field up"
          >
            ↑
          </button>
          <button
            type="button"
            className={smallButton}
            disabled={isLast}
            onClick={() => onMove(1)}
            aria-label="Move field down"
          >
            ↓
          </button>
          <button
            type="button"
            className={smallButton}
            onClick={onRemove}
            aria-label="Remove field"
          >
            Remove
          </button>
        </div>
      </div>
      <label className="mt-2 block text-xs font-semibold">
        Label
        <input
          className={field}
          value={element.title ?? ""}
          onChange={(event) => onChange({ ...element, title: event.target.value })}
          maxLength={200}
        />
      </label>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs font-semibold">
          <input
            type="checkbox"
            checked={element.isRequired ?? false}
            onChange={(event) => onChange({ ...element, isRequired: event.target.checked })}
          />
          Required
        </label>
        {element.type === "text" && (
          <label className="text-xs font-semibold">
            Input
            <select
              className={`${field} ml-2 inline-block w-auto`}
              value={element.inputType ?? "text"}
              onChange={(event) =>
                onChange({
                  ...element,
                  inputType: event.target.value as BuilderElement["inputType"],
                })
              }
            >
              <option value="text">Text</option>
              <option value="email">Email</option>
              <option value="tel">Phone</option>
              <option value="number">Number</option>
              <option value="date">Date</option>
            </select>
          </label>
        )}
      </div>
      {(element.type === "dropdown" ||
        element.type === "radiogroup" ||
        element.type === "checkbox") && (
        <label className="mt-2 block text-xs font-semibold">
          Options, one per line
          <textarea
            className={`${field} min-h-20`}
            value={(element.choices ?? []).join("\n")}
            onChange={(event) =>
              onChange({
                ...element,
                choices: event.target.value
                  .split("\n")
                  .map((line) => line.trim())
                  .filter(Boolean),
              })
            }
          />
        </label>
      )}
    </div>
  );
}

export function FormsWorkspace() {
  const [tab, setTab] = useState<"forms" | "responses">("forms");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | FormDefinition["status"]>("all");
  const [showReviewed, setShowReviewed] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [elements, setElements] = useState<BuilderElement[]>([]);
  const [dirty, setDirty] = useState(false);

  const formsQuery = useAdminQuery<{ forms: FormDefinition[] }>(
    ["admin", "forms"],
    "/api/admin/forms",
  );
  const submissionsQuery = useAdminQuery<{ submissions: FormSubmission[] }>(
    ["admin", "form-submissions"],
    "/api/admin/forms?view=submissions",
    { enabled: tab === "responses" },
  );

  const forms = formsQuery.data?.forms ?? [];
  const selected = forms.find((form) => form.id === selectedId) ?? null;

  const openEditor = (form: FormDefinition) => {
    setSelectedId(form.id);
    setTitle(form.schema.title ?? "");
    setDescription(form.description ?? "");
    setElements(structuredClone(form.schema.elements) as BuilderElement[]);
    setDirty(false);
    setNotice(null);
  };

  const refresh = () => {
    formsQuery.refetch();
    submissionsQuery.refetch();
  };

  const copyLink = async (form: FormDefinition) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/f/${form.share_token}`);
      setCopied(form.id);
      window.setTimeout(() => setCopied((current) => (current === form.id ? null : current)), 2000);
    } catch {
      setNotice("Copy failed. Select the link text manually.");
    }
  };

  const createForm = async () => {
    setNotice(null);
    try {
      const created = await postAction<{ form: FormDefinition }>({
        action: "create",
        form: { name: newName.trim(), description: "" },
      });
      setNewName("");
      await formsQuery.refetch();
      openEditor(created.form);
    } catch {
      setNotice("Could not create the form. Use a name of 1 to 120 characters.");
    }
  };

  const saveForm = async () => {
    if (!selected) return;
    setNotice(null);
    try {
      const saved = await postAction<{ form: FormDefinition }>({
        action: "save",
        form: {
          id: selected.id,
          description,
          schema: { title: title.trim() || undefined, elements },
        },
      });
      setDirty(false);
      await formsQuery.refetch();
      openEditor(saved.form);
      setNotice("Saved.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not save the form.");
    }
  };

  const changeStatus = async (form: FormDefinition, status: FormDefinition["status"]) => {
    setNotice(null);
    try {
      await postAction({ action: "status", form: { id: form.id, status } });
      refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Status change failed.");
    }
  };

  const review = async (id: string, decision: "accepted" | "rejected") => {
    setNotice(null);
    try {
      await postAction({
        action: "review",
        id,
        decision,
        requestId: crypto.randomUUID(),
      });
      submissionsQuery.refetch();
      setNotice(
        decision === "accepted" ? "Response accepted into the pipeline." : "Response rejected.",
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Review failed.");
    }
  };

  const addField = (type: BuilderElement["type"]) => {
    const label = `${type.charAt(0).toUpperCase()}${type.slice(1)} ${elements.length + 1}`;
    const element: BuilderElement = { name: slugify(label, elements.length), title: label, type };
    if (type === "dropdown" || type === "radiogroup" || type === "checkbox") {
      element.choices = ["Option 1", "Option 2"];
    }
    setElements([...elements, element]);
    setDirty(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        {(["forms", "responses"] as const).map((value) => (
          <button
            key={value}
            type="button"
            className={button}
            aria-pressed={tab === value}
            onClick={() => setTab(value)}
          >
            {value === "forms" ? "Forms" : "Responses"}
          </button>
        ))}
      </div>
      {notice && (
        <AdminSurface>
          <p className="text-sm text-[var(--admin-ink)]" role="status">
            {notice}
          </p>
        </AdminSurface>
      )}

      {tab === "forms" && !selected && (
        <AdminSurface padding="lg">
          <p className="admin-eyebrow">New form</p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              className={field}
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder="e.g. Website lead capture"
              maxLength={120}
              aria-label="Form name"
            />
            <button
              type="button"
              className={button}
              disabled={!newName.trim()}
              onClick={createForm}
            >
              Create draft
            </button>
          </div>
          <ul className="mt-6 space-y-3">
            <div className="flex flex-wrap gap-1" role="group" aria-label="Filter by status">
              {(["all", "draft", "published", "archived"] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  className={smallButton}
                  aria-pressed={statusFilter === status}
                  onClick={() => setStatusFilter(status)}
                >
                  {status}
                </button>
              ))}
            </div>
            {forms
              .filter((form) => statusFilter === "all" || form.status === statusFilter)
              .map((form) => (
                <li
                  key={form.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--admin-border)] p-3"
                >
                  <div>
                    <p className="text-sm font-semibold">{form.name}</p>
                    <p className="text-xs text-[var(--admin-muted)]">
                      {form.status}
                      {form.status === "published" ? ` · /f/${form.share_token}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {form.status === "published" && (
                      <button type="button" className={smallButton} onClick={() => copyLink(form)}>
                        {copied === form.id ? "Copied" : "Copy link"}
                      </button>
                    )}
                    {form.status === "draft" && (
                      <button
                        type="button"
                        className={smallButton}
                        onClick={() => openEditor(form)}
                      >
                        Edit
                      </button>
                    )}
                    {form.status === "draft" && (
                      <button
                        type="button"
                        className={smallButton}
                        onClick={() => changeStatus(form, "published")}
                      >
                        Publish
                      </button>
                    )}
                    {form.status === "published" && (
                      <button
                        type="button"
                        className={smallButton}
                        onClick={() => changeStatus(form, "draft")}
                      >
                        Unpublish
                      </button>
                    )}
                    {form.status !== "archived" && (
                      <button
                        type="button"
                        className={smallButton}
                        onClick={() => changeStatus(form, "archived")}
                      >
                        Archive
                      </button>
                    )}
                  </div>
                </li>
              ))}
          </ul>
          {forms.filter((form) => statusFilter === "all" || form.status === statusFilter).length ===
            0 &&
            !formsQuery.isLoading && (
              <p className="admin-copy mt-4 text-sm">
                {forms.length === 0
                  ? "No forms yet. Create a draft above, or ask the assistant to build one."
                  : `No ${statusFilter} forms.`}
              </p>
            )}
          {formsQuery.isLoading && <p className="admin-copy mt-4 text-sm">Loading forms…</p>}
        </AdminSurface>
      )}

      {tab === "forms" && selected && (
        <div className="grid gap-6 lg:grid-cols-2">
          <AdminSurface padding="lg">
            <div className="flex items-center justify-between gap-2">
              <p className="admin-eyebrow">Editing draft · {selected.name}</p>
              <button type="button" className={smallButton} onClick={() => setSelectedId(null)}>
                Back to list
              </button>
            </div>
            <label className="mt-3 block text-xs font-semibold">
              Form title shown to respondents
              <input
                className={field}
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value);
                  setDirty(true);
                }}
                maxLength={200}
              />
            </label>
            <label className="mt-3 block text-xs font-semibold">
              Description
              <textarea
                className={`${field} min-h-20`}
                value={description}
                onChange={(event) => {
                  setDescription(event.target.value);
                  setDirty(true);
                }}
                maxLength={2000}
              />
            </label>
            <div className="mt-4">
              <p className="text-xs font-semibold">Start from a template</p>
              <div className="mt-2">
                <StarterTemplates
                  onPick={(template) => {
                    setElements(template);
                    setDirty(true);
                  }}
                />
              </div>
            </div>
            <div className="mt-4">
              <p className="text-xs font-semibold">Add a field</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {FIELD_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    className={smallButton}
                    onClick={() => addField(type)}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {elements.map((element, index) => (
                <ElementEditor
                  key={`${element.name}-${index}`}
                  element={element}
                  isFirst={index === 0}
                  isLast={index === elements.length - 1}
                  onChange={(next) => {
                    const copy = [...elements];
                    copy[index] = next;
                    setElements(copy);
                    setDirty(true);
                  }}
                  onRemove={() => {
                    setElements(elements.filter((_, position) => position !== index));
                    setDirty(true);
                  }}
                  onMove={(direction) => {
                    const target = index + direction;
                    if (target < 0 || target >= elements.length) return;
                    const copy = [...elements];
                    [copy[index], copy[target]] = [copy[target]!, copy[index]!];
                    setElements(copy);
                    setDirty(true);
                  }}
                />
              ))}
            </div>
            {elements.length === 0 && (
              <p className="admin-copy mt-4 text-sm">Add at least one field before publishing.</p>
            )}
            <div className="mt-4">
              <button
                type="button"
                className={button}
                disabled={!dirty || elements.length === 0}
                onClick={saveForm}
              >
                Save draft
              </button>
            </div>
          </AdminSurface>
          <AdminSurface padding="lg">
            <p className="admin-eyebrow">Live preview</p>
            <div className="mt-3">
              {elements.length > 0 ? (
                <SurveyRunner schema={{ title: title || undefined, elements }} />
              ) : (
                <p className="admin-copy text-sm">The preview appears once the form has fields.</p>
              )}
            </div>
          </AdminSurface>
        </div>
      )}

      {tab === "responses" && (
        <AdminSurface padding="lg">
          <div className="flex items-center justify-between gap-2">
            <p className="admin-eyebrow">Pending review</p>
            <label className="flex items-center gap-2 text-xs font-semibold">
              <input
                type="checkbox"
                checked={showReviewed}
                onChange={(event) => setShowReviewed(event.target.checked)}
              />
              Show reviewed
            </label>
          </div>
          <ul className="mt-3 space-y-3">
            {(submissionsQuery.data?.submissions ?? [])
              .filter((submission) => showReviewed || submission.status === "pending_review")
              .map((submission) => (
                <li
                  key={submission.id}
                  className="rounded-xl border border-[var(--admin-border)] p-3"
                >
                  <p className="text-sm font-semibold">
                    {submission.contact_name ?? "Unknown respondent"}
                    {submission.contact_email ? ` · ${submission.contact_email}` : " · no email"}
                    {submission.status !== "pending_review" ? ` · ${submission.status}` : ""}
                  </p>
                  <dl className="mt-2 space-y-1">
                    {Object.entries(submission.response).map(([key, value]) => (
                      <div key={key} className="text-xs">
                        <dt className="font-semibold">{key}</dt>
                        <dd className="text-[var(--admin-muted)]">
                          {String(Array.isArray(value) ? value.join(", ") : value)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <div className="mt-3 flex gap-1">
                    {submission.status === "pending_review" ? (
                      <>
                        <button
                          type="button"
                          className={smallButton}
                          onClick={() => review(submission.id, "accepted")}
                        >
                          Accept into pipeline
                        </button>
                        <button
                          type="button"
                          className={smallButton}
                          onClick={() => review(submission.id, "rejected")}
                        >
                          Reject
                        </button>
                      </>
                    ) : (
                      <p className="text-xs text-[var(--admin-muted)]">
                        Reviewed. Accepted responses live in the pipeline.
                      </p>
                    )}
                  </div>
                </li>
              ))}
          </ul>
          {submissionsQuery.isLoading && (
            <p className="admin-copy mt-4 text-sm">Loading responses…</p>
          )}
          {!submissionsQuery.isLoading &&
            (submissionsQuery.data?.submissions ?? []).filter(
              (submission) => showReviewed || submission.status === "pending_review",
            ).length === 0 && (
              <p className="admin-copy mt-4 text-sm">
                {(submissionsQuery.data?.submissions ?? []).length === 0
                  ? "No responses yet. Publish a form and share its link."
                  : "No responses waiting for review."}
              </p>
            )}
        </AdminSurface>
      )}
    </div>
  );
}
