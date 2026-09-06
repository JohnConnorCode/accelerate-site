"use client";
import type { Dispatch, SetStateAction } from "react";
import { Sparkles, X } from "lucide-react";
import { AdminDialog } from "./AdminDialog";
import { button, primary, field, label, words } from "./RadarUI";
import { RADAR_FACTORS, type RadarAssessment } from "@/lib/revenue-os/radar-ranking-contract";
import type { RadarStoreChange } from "@/lib/revenue-os/radar-store-contract";
import type {
  RadarSourceView,
  RadarWorkspaceData,
} from "@/lib/revenue-os/radar-workspace-contract";
export type RadarEditorKind =
  "source" | "create" | "opportunity" | "draft" | "assessment" | "citations" | null;
export type RadarEditorFields = {
  title: string;
  summary: string;
  nextAction: string;
  body: string;
  url: string;
  opportunityKind: string;
  draftKind: Extract<RadarStoreChange, { operation: "add_asset" }>["kind"];
  selectedSources: string[];
  observations: Record<string, string>;
  assessment: RadarAssessment | null;
};
export const EMPTY_RADAR_EDITOR: RadarEditorFields = {
  title: "",
  summary: "",
  nextAction: "",
  body: "",
  url: "",
  opportunityKind: "partnership",
  draftKind: "brief",
  selectedSources: [],
  observations: {},
  assessment: null,
};
function Text({
  title,
  value,
  onChange,
  max = 1000,
  rows = 0,
  type = "text",
}: {
  title: string;
  value: string;
  onChange: (value: string) => void;
  max?: number;
  rows?: number;
  type?: string;
}) {
  return (
    <label className={label}>
      {title}
      {rows ? (
        <textarea
          className={field + " font-normal leading-7"}
          rows={rows}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          maxLength={max}
        />
      ) : (
        <input
          className={field}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          maxLength={max}
        />
      )}
    </label>
  );
}
export function RadarEditorDialog({
  kind,
  open,
  values,
  onChange,
  sources,
  model,
  busy,
  error,
  onClose,
  onPreview,
  onGenerate,
}: {
  kind: RadarEditorKind;
  open: boolean;
  values: RadarEditorFields;
  onChange: Dispatch<SetStateAction<RadarEditorFields>>;
  sources: RadarSourceView[];
  model: RadarWorkspaceData["model"] | undefined;
  busy: boolean;
  error: string;
  onClose: () => void;
  onPreview: () => void;
  onGenerate: () => void;
}) {
  const heading =
    kind === "source"
      ? "Add a supplied source"
      : kind === "create"
        ? "Develop an opportunity"
        : kind === "citations"
          ? "Correct source citations"
          : kind === "draft"
            ? "Prepare a draft"
            : kind === "assessment"
              ? "Review opportunity estimates"
              : "Edit opportunity";
  const update = <K extends keyof RadarEditorFields>(key: K, value: RadarEditorFields[K]) =>
    onChange((old) => ({ ...old, [key]: value }));
  const a = values.assessment;
  const setAssessment = (value: RadarAssessment) => update("assessment", value);
  const chooseSource = (id: string, checked: boolean) =>
    onChange((old) => ({
      ...old,
      selectedSources: checked
        ? [...old.selectedSources, id]
        : old.selectedSources.filter((value) => value !== id),
    }));
  return (
    <AdminDialog open={open} onClose={onClose} title={heading} maxWidth="xl">
      <div className="max-h-[85dvh] overflow-y-auto rounded-2xl bg-[var(--admin-surface)] p-5 sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="text-base font-semibold">{heading}</h2>
          <button className={button} aria-label="Close editor" onClick={onClose}>
            <X size={16} aria-hidden />
          </button>
        </div>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            onPreview();
          }}
        >
          {!["assessment", "citations"].includes(kind ?? "") && (
            <Text
              title="Title"
              value={values.title}
              onChange={(v) => update("title", v)}
              max={kind === "source" ? 300 : 200}
            />
          )}
          {kind === "source" && (
            <>
              <Text
                title="Public HTTPS source URL"
                type="url"
                value={values.url}
                onChange={(v) => update("url", v)}
                max={2000}
              />
              <p className="text-xs leading-6 text-[var(--admin-muted)]">
                Paste the source text below. This does not fetch the website or verify its claims.
              </p>
            </>
          )}
          {(kind === "create" || kind === "opportunity") && (
            <>
              <Text
                title="Why this matters"
                value={values.summary}
                onChange={(v) => update("summary", v)}
                max={2000}
                rows={4}
              />
              <Text
                title="Next useful action"
                value={values.nextAction}
                onChange={(v) => update("nextAction", v)}
                rows={2}
              />
              {kind === "create" && (
                <Text
                  title="Opportunity type (lowercase key)"
                  value={values.opportunityKind}
                  onChange={(v) => update("opportunityKind", v)}
                  max={60}
                />
              )}
            </>
          )}
          {(kind === "create" || kind === "citations" || kind === "draft") && (
            <fieldset>
              <legend className={label}>Supporting source versions</legend>
              <div className="mt-2 space-y-3">
                {sources
                  .filter((s) => s.verification !== "retracted")
                  .map((source) => (
                    <div
                      key={source.id}
                      className="rounded-xl bg-[var(--admin-surface-subtle)] p-3"
                    >
                      <label className="flex min-h-11 items-center gap-3 text-sm">
                        <input
                          type="checkbox"
                          checked={values.selectedSources.includes(source.id)}
                          onChange={(e) => chooseSource(source.id, e.target.checked)}
                        />
                        {source.title} · version {source.version}
                      </label>
                      {kind !== "draft" && values.selectedSources.includes(source.id) && (
                        <Text
                          title="Observation from this source"
                          value={values.observations[source.id] ?? ""}
                          onChange={(v) =>
                            update("observations", { ...values.observations, [source.id]: v })
                          }
                          rows={2}
                        />
                      )}
                    </div>
                  ))}
              </div>
              {!sources.some((s) => s.verification !== "retracted") && (
                <p className="mt-3 text-sm">Add a current source before continuing.</p>
              )}
            </fieldset>
          )}
          {kind === "draft" && (
            <>
              <label className={label}>
                Draft type
                <select
                  className={field}
                  value={values.draftKind}
                  onChange={(e) =>
                    update("draftKind", e.target.value as RadarEditorFields["draftKind"])
                  }
                >
                  {["brief", "outreach_draft", "content_draft", "research_note"].map((k) => (
                    <option key={k} value={k}>
                      {words(k)}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className={button}
                disabled={
                  busy ||
                  !model?.available ||
                  !values.selectedSources.length ||
                  values.selectedSources.length > 5
                }
                onClick={onGenerate}
              >
                <Sparkles size={15} aria-hidden />
                Generate a source brief
              </button>
              <p className="text-xs leading-6 text-[var(--admin-muted)]">
                {model?.reason} Briefing reads up to 3,000 characters from each of at most five
                sources. Manual drafts remain available.
              </p>
            </>
          )}
          {(kind === "source" || kind === "draft") && (
            <Text
              title={kind === "source" ? "Supplied source text" : "Draft text"}
              value={values.body}
              onChange={(v) => update("body", v)}
              max={kind === "source" ? 20000 : 10000}
              rows={8}
            />
          )}
          {kind === "assessment" && a && (
            <>
              <p className="text-sm leading-6 text-[var(--admin-muted)]">
                These are operator judgments, not probabilities or verified facts. Leave unknown
                values blank. Public-affairs and ambiguous subjects remain unranked.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className={label}>
                  Subject classification
                  <select
                    className={field}
                    value={a.classification}
                    onChange={(e) =>
                      setAssessment({
                        ...a,
                        classification: e.target.value as RadarAssessment["classification"],
                      })
                    }
                  >
                    <option value="unknown">Unknown / needs review</option>
                    <option value="business">Ordinary business</option>
                    <option value="public_affairs">Public affairs — unranked</option>
                  </select>
                </label>
                <Text
                  title="Topic key"
                  value={a.topicKey}
                  onChange={(v) => setAssessment({ ...a, topicKey: v })}
                  max={80}
                />
              </div>
              <Text
                title="Why this classification fits"
                value={a.classificationReason}
                onChange={(v) => setAssessment({ ...a, classificationReason: v })}
                max={500}
              />
              {RADAR_FACTORS.map((key) => (
                <fieldset key={key} className="rounded-xl bg-[var(--admin-surface-subtle)] p-4">
                  <legend className="px-1 text-sm font-semibold capitalize">{key}</legend>
                  <div className="grid gap-3 sm:grid-cols-[110px_130px_1fr]">
                    <label className={label}>
                      Estimate (0–100)
                      <input
                        className={field + " tabular-nums"}
                        type="number"
                        min={0}
                        max={100}
                        step="any"
                        placeholder="Unknown"
                        value={a.estimates[key].value ?? ""}
                        onChange={(e) =>
                          setAssessment({
                            ...a,
                            estimates: {
                              ...a.estimates,
                              [key]: {
                                ...a.estimates[key],
                                value: e.target.value === "" ? null : Number(e.target.value),
                              },
                            },
                          })
                        }
                      />
                    </label>
                    <label className={label}>
                      Confidence
                      <select
                        className={field}
                        value={a.estimates[key].confidence}
                        onChange={(e) =>
                          setAssessment({
                            ...a,
                            estimates: {
                              ...a.estimates,
                              [key]: { ...a.estimates[key], confidence: e.target.value as "low" },
                            },
                          })
                        }
                      >
                        {["low", "medium", "high"].map((v) => (
                          <option key={v}>{v}</option>
                        ))}
                      </select>
                    </label>
                    <Text
                      title="Reason from cited sources"
                      value={a.estimates[key].rationale}
                      onChange={(v) =>
                        setAssessment({
                          ...a,
                          estimates: {
                            ...a.estimates,
                            [key]: { ...a.estimates[key], rationale: v },
                          },
                        })
                      }
                      max={500}
                    />
                  </div>
                  <details className="mt-3 text-xs">
                    <summary className="min-h-10 cursor-pointer py-3 font-semibold">
                      Cited sources ({a.estimates[key].sourceVersionIds.length})
                    </summary>
                    {sources.map((source) => (
                      <label key={source.id} className="flex min-h-11 items-center gap-3">
                        <input
                          type="checkbox"
                          checked={a.estimates[key].sourceVersionIds.includes(source.id)}
                          onChange={(e) =>
                            setAssessment({
                              ...a,
                              estimates: {
                                ...a.estimates,
                                [key]: {
                                  ...a.estimates[key],
                                  sourceVersionIds: e.target.checked
                                    ? [...a.estimates[key].sourceVersionIds, source.id]
                                    : a.estimates[key].sourceVersionIds.filter(
                                        (id) => id !== source.id,
                                      ),
                                },
                              },
                            })
                          }
                        />
                        {source.title} · v{source.version}
                      </label>
                    ))}
                  </details>
                </fieldset>
              ))}
              <div className="grid gap-4 sm:grid-cols-3">
                <label className={label}>
                  Effort (1–5)
                  <input
                    className={field}
                    type="number"
                    min={1}
                    max={5}
                    value={a.effort}
                    onChange={(e) => setAssessment({ ...a, effort: Number(e.target.value) })}
                  />
                </label>
                <label className={label}>
                  Time to value
                  <select
                    className={field}
                    value={a.timeToValue}
                    onChange={(e) =>
                      setAssessment({
                        ...a,
                        timeToValue: e.target.value as RadarAssessment["timeToValue"],
                      })
                    }
                  >
                    {["immediate", "day", "week", "month", "long_term"].map((v) => (
                      <option key={v} value={v}>
                        {words(v)}
                      </option>
                    ))}
                  </select>
                </label>
                <Text
                  title="Review expiry (UTC)"
                  type="date"
                  value={a.expiresAt.slice(0, 10)}
                  onChange={(v) =>
                    v &&
                    setAssessment({ ...a, expiresAt: new Date(v + "T23:59:00Z").toISOString() })
                  }
                />
              </div>
              <Text
                title="One concrete next action"
                value={a.nextAction}
                onChange={(v) => setAssessment({ ...a, nextAction: v })}
                rows={2}
              />
              {a.alternatives.map((alternative, index) => (
                <Text
                  key={index}
                  title={`Fallback action ${index + 1}`}
                  value={alternative}
                  onChange={(v) =>
                    setAssessment({
                      ...a,
                      alternatives: a.alternatives.map((item, i) => (i === index ? v : item)),
                    })
                  }
                  max={500}
                />
              ))}
              <p className="text-xs leading-6 text-[var(--admin-muted)]">
                Source references are reviewed with each estimate. A changed or missing source
                requires a fresh judgment.
              </p>
            </>
          )}
          {error && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-300">
              {error}
            </p>
          )}
          <button className={primary} disabled={busy} type="submit">
            Preview exact change
          </button>
        </form>
      </div>
    </AdminDialog>
  );
}
