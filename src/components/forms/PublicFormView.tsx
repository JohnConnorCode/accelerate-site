"use client";

import { useState } from "react";
import { SurveyRunner } from "./SurveyRunner";
import type { StoredFormSchema } from "@/lib/revenue-os/form-builder";

export function PublicFormView({ token, schema }: { token: string; schema: StoredFormSchema }) {
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(false);
  const [website, setWebsite] = useState("");

  if (done) {
    return (
      <div className="rounded-2xl border border-[var(--admin-border)] p-8 text-center">
        <h2 className="text-lg font-semibold">Thanks, your response was recorded.</h2>
        <p className="mt-2 text-sm text-[var(--admin-muted)]">
          The team reviews every response and follows up when needed.
        </p>
      </div>
    );
  }

  return (
    <div>
      {failed && (
        <p className="mb-4 rounded-xl border border-red-300 p-3 text-sm" role="alert">
          Your response could not be recorded. Check your answers and try again.
        </p>
      )}
      <SurveyRunner
        schema={schema}
        onComplete={async (data) => {
          setFailed(false);
          try {
            const response = await fetch(`/api/public/forms/${encodeURIComponent(token)}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ response: data, requestId: crypto.randomUUID(), website: website || undefined }),
            });
            if (!response.ok) setFailed(true);
            else setDone(true);
          } catch {
            setFailed(true);
          }
        }}
      />
      {/* Honeypot: invisible to people, tempting to bots. A filled value
          makes the server accept quietly without recording anything. */}
      <div aria-hidden="true" style={{ position: "absolute", left: "-9999px" }}>
        <label>
          Website
          <input
            type="text"
            name="website"
            autoComplete="off"
            tabIndex={-1}
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
          />
        </label>
      </div>
    </div>
  );
}
