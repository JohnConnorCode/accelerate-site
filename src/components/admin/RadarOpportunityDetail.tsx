"use client";
import { AdminSurface } from "./AdminSurface";
import { FilePlus2 } from "lucide-react";
import { button, words, Pill } from "./RadarUI";
import type {
  RadarWorkspaceData,
  RadarSourceView,
} from "@/lib/revenue-os/radar-workspace-contract";
import { RADAR_TRANSITIONS } from "@/lib/revenue-os/radar-store-contract";
import { RADAR_FACTORS } from "@/lib/revenue-os/radar-ranking-contract";
export function RadarOpportunityDetail({
  data,
  canWrite,
  busy,
  openEditor,
  onTransition,
  onReadAsset,
  sourceCard,
}: {
  data: RadarWorkspaceData;
  canWrite: boolean;
  busy: boolean;
  openEditor: (kind: "opportunity" | "assessment" | "draft" | "citations") => void;
  onTransition: (state: keyof typeof RADAR_TRANSITIONS) => void;
  onReadAsset: (id: string) => void;
  sourceCard: (source: RadarSourceView) => React.ReactNode;
}) {
  const packet = data.packet;
  if (!packet) return null;
  const opp = packet.opportunity;
  const transitions = RADAR_TRANSITIONS[opp.state as keyof typeof RADAR_TRANSITIONS] ?? [];
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Pill>{words(opp.state)}</Pill>
        <Pill>{words(opp.kind)}</Pill>
        <Pill>Revision {opp.revision}</Pill>
        {packet.contact && (
          <Pill>
            {packet.contact.name} · {packet.contact.communicationStatus}
          </Pill>
        )}
      </div>
      {packet.contact &&
        ["unsubscribed", "suppressed"].includes(packet.contact.communicationStatus) && (
          <AdminSurface tone="attention">
            <p className="text-sm font-semibold">Do not contact {packet.contact.name}</p>
            <p className="mt-1 text-sm">
              The canonical contact is {packet.contact.communicationStatus}. This workspace does not
              send outreach.
            </p>
          </AdminSurface>
        )}
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <AdminSurface>
            <h2 className="text-sm font-semibold">Why this opportunity matters</h2>
            <p className="mt-3 text-pretty text-sm leading-7">{opp.summary}</p>
            <div className="mt-5 rounded-xl bg-[var(--admin-surface-subtle)] p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--admin-muted)]">
                Next useful action
              </p>
              <p className="mt-2 text-sm font-medium leading-6">{opp.recommended_action}</p>
            </div>
            {canWrite && (
              <div className="mt-4 flex flex-wrap gap-2">
                <button className={button} onClick={() => openEditor("opportunity")}>
                  Edit opportunity
                </button>
                <button className={button} onClick={() => openEditor("assessment")}>
                  Review estimates
                </button>
                <button className={button} onClick={() => openEditor("draft")}>
                  <FilePlus2 size={15} aria-hidden />
                  Prepare a draft
                </button>
              </div>
            )}
          </AdminSurface>
          <AdminSurface>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-semibold">Source evidence</h2>
              {canWrite && (
                <button className={button} onClick={() => openEditor("citations")}>
                  Correct citations
                </button>
              )}
            </div>
            <div className="space-y-3">{packet.sources.map(sourceCard)}</div>
          </AdminSurface>
          <AdminSurface>
            <h2 className="mb-4 text-base font-semibold">Drafts &amp; reported outcomes</h2>
            {packet.assets.map((asset) => (
              <button
                key={asset.id}
                className="flex min-h-12 w-full items-center justify-between gap-3 py-2 text-left"
                onClick={() => onReadAsset(asset.id)}
              >
                <span className="text-sm font-semibold">{asset.title}</span>
                <Pill>{words(asset.kind)} · Draft</Pill>
              </button>
            ))}
            {packet.outcomes.map((outcome) => (
              <div
                key={outcome.id}
                className="mt-3 rounded-xl bg-[var(--admin-surface-subtle)] p-4"
              >
                <Pill>Reported · {outcome.kind}</Pill>
                <p className="mt-2 text-sm leading-6">{outcome.description}</p>
              </div>
            ))}
            {!packet.assets.length && !packet.outcomes.length && (
              <p className="text-sm text-[var(--admin-muted)]">
                No drafts or outcomes have been saved. Nothing here is published or sent.
              </p>
            )}
          </AdminSurface>
        </div>
        <div className="space-y-5">
          <AdminSurface>
            <h2 className="text-sm font-semibold">Reviewed judgment</h2>
            {packet.assessment ? (
              <>
                <p className="mt-2 text-xs leading-6 text-[var(--admin-muted)]">
                  {packet.assessment.classificationReason}
                </p>
                {packet.assessmentCurrent && packet.assessment.classification === "business" ? (
                  <dl className="mt-4 space-y-3">
                    {RADAR_FACTORS.map((key) => (
                      <div key={key} className="flex justify-between gap-3 text-xs">
                        <dt className="capitalize">{key}</dt>
                        <dd className="font-semibold tabular-nums">
                          {packet.assessment!.estimates[key].value ?? "Unknown"}
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="mt-3 text-xs leading-6">
                    {packet.assessmentReason ?? "This subject remains in neutral review."}
                  </p>
                )}
                {packet.assessmentCurrent && packet.assessment.classification === "business" && (
                  <details className="mt-4 text-xs">
                    <summary className="min-h-11 cursor-pointer py-3 font-semibold">
                      Estimate rationale and evidence
                    </summary>
                    <dl className="space-y-4">
                      {RADAR_FACTORS.map((key) => {
                        const estimate = packet.assessment!.estimates[key];
                        return (
                          <div key={key}>
                            <dt className="font-semibold capitalize">
                              {key} · {estimate.confidence} confidence
                            </dt>
                            <dd className="mt-1 leading-6 text-[var(--admin-muted)]">
                              {estimate.rationale}
                              <p className="mt-1">
                                Sources:{" "}
                                {estimate.sourceVersionIds
                                  .map(
                                    (id) =>
                                      packet.sources.find((s) => s.id === id)?.title ??
                                      "Unavailable source",
                                  )
                                  .join("; ") || "None cited"}
                              </p>
                            </dd>
                          </div>
                        );
                      })}
                    </dl>
                  </details>
                )}
                <p className="mt-4 text-xs text-[var(--admin-muted)]">
                  Expires {new Date(packet.assessment.expiresAt).toLocaleDateString()}. Changes to
                  the opportunity or evidence require review.
                </p>
              </>
            ) : (
              <p className="mt-3 text-xs leading-6 text-[var(--admin-muted)]">
                No reviewed assessment. This opportunity remains unranked.
              </p>
            )}
          </AdminSurface>
          {canWrite && (
            <AdminSurface>
              <h2 className="mb-3 text-sm font-semibold">Move the work forward</h2>
              <div className="flex flex-col gap-2">
                {transitions.map((state) => (
                  <button
                    key={state}
                    className={button}
                    disabled={busy}
                    onClick={() => onTransition(state)}
                  >
                    {state === "dismissed" ? "Dismiss opportunity" : `Move to ${words(state)}`}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-xs leading-6 text-[var(--admin-muted)]">
                Every change is reviewed. Approval here never authorizes outreach or publication.
              </p>
            </AdminSurface>
          )}
          <AdminSurface>
            <h2 className="mb-3 text-sm font-semibold">Recorded history</h2>
            {packet.history.map((item) => (
              <div
                key={item.id}
                className="border-b border-[var(--admin-border)] py-3 last:border-0"
              >
                <p className="text-xs font-semibold">{words(item.operation)}</p>
                <p className="mt-1 text-[11px] text-[var(--admin-muted)]">
                  {new Date(item.created_at).toLocaleString()}
                </p>
              </div>
            ))}
            {!packet.history.length && (
              <p className="text-xs text-[var(--admin-muted)]">
                No operation receipts in this window.
              </p>
            )}
          </AdminSurface>
        </div>
      </div>
    </>
  );
}
