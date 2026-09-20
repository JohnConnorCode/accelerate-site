"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
export function DraftLearning({
  before,
  after,
  conversationId,
}: {
  before: string;
  after: string;
  conversationId: string;
}) {
  const [rule, setRule] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setSaved(false);
    setRule("");
    if (!before.trim() || before === after || !after.trim()) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void fetch("/api/admin/corrections/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ before, after, context: { conversationId } }),
        signal: controller.signal,
      })
        .then(async (response) => {
          const data = await response.json();
          if (!response.ok) throw new Error(data.error);
          setRule(data.candidate?.suggestedRule ?? "");
        })
        .catch((e) => {
          if (!controller.signal.aborted)
            setError(e instanceof Error ? e.message : "Correction detection unavailable");
        });
    }, 700);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [before, after, conversationId]);
  if (!rule && !error && !saved) return null;
  return (
    <div className="mt-3 rounded-xl bg-[var(--admin-surface-subtle)] p-3 text-sm">
      {saved ? (
        <p role="status">
          Correction saved to Learning Inbox for review. It will affect future work only after
          approval.
        </p>
      ) : (
        <>
          <label htmlFor="draft-learning-rule" className="font-medium">
            Reuse this correction?
          </label>
          <p className="my-2 text-[var(--admin-muted)]">
            Describe the general rule to remember. Leave client-specific facts in the conversation.
          </p>
          <textarea
            id="draft-learning-rule"
            value={rule}
            onChange={(e) => setRule(e.target.value)}
            maxLength={10000}
            rows={3}
            className="admin-composer-field w-full"
          />
          <Button
            className="mt-2"
            disabled={busy || !rule.trim()}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                const response = await fetch("/api/admin/learning/signals", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    kind: "draft_edit",
                    rule,
                    details: "Human-reviewed correction from an edited suggested reply",
                    sourceKind: "conversation",
                    sourceId: conversationId,
                  }),
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.error);
                setSaved(true);
              } catch (e) {
                setError(e instanceof Error ? e.message : "Correction could not be saved");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Saving…" : "Save correction for review"}
          </Button>
        </>
      )}
      {error && (
        <p role="alert" className="mt-2">
          {error}
        </p>
      )}
    </div>
  );
}
