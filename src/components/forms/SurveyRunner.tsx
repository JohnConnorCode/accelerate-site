"use client";

import { useEffect, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import "survey-core/survey-core.min.css";
import { Model } from "survey-core";
import type { StoredFormSchema } from "@/lib/revenue-os/form-builder";

const SurveyComponent = dynamic(async () => (await import("survey-react-ui")).Survey, {
  ssr: false,
  loading: () => <p className="admin-copy text-sm">Loading form…</p>,
});

function toSurveyJson(schema: StoredFormSchema) {
  return {
    title: schema.title,
    description: schema.description,
    pages: [{ name: "page1", elements: schema.elements }],
  };
}

export function SurveyRunner({
  schema,
  onComplete,
}: {
  schema: StoredFormSchema;
  onComplete?: (data: Record<string, unknown>) => void | boolean | Promise<void | boolean>;
}) {
  const definition = JSON.stringify(toSurveyJson(schema));
  const model = useMemo(() => {
    const survey = new Model(JSON.parse(definition));
    survey.applyTheme({
      cssVariables: {
        "--sjs-font-family": "var(--admin-font, inherit)",
        "--sjs-general-backcolor": "var(--admin-surface, var(--site-paper, var(--paper)))",
        "--sjs-general-backcolor-dark":
          "var(--admin-surface-subtle, var(--site-paper, var(--paper)))",
        "--sjs-general-backcolor-dim": "var(--admin-canvas, var(--site-surface, var(--bg)))",
        "--sjs-general-backcolor-dim-light":
          "var(--admin-surface, var(--site-paper, var(--paper)))",
        "--sjs-general-forecolor": "var(--admin-ink, var(--site-ink, var(--fg)))",
        "--sjs-general-forecolor-light": "var(--admin-muted, var(--site-muted, var(--fg)))",
        "--sjs-primary-backcolor": "var(--admin-action, var(--site-accent, var(--accent)))",
        "--sjs-primary-backcolor-dark": "var(--admin-action, var(--site-accent, var(--accent)))",
        "--sjs-primary-backcolor-light":
          "var(--admin-accent-soft, var(--site-paper, var(--paper)))",
        "--sjs-primary-forecolor": "var(--admin-action-ink, var(--site-on-accent, var(--fg)))",
        "--sjs-border-default": "var(--admin-border, currentColor)",
        "--sjs-border-light":
          "var(--admin-border, color-mix(in srgb, currentColor 15%, transparent))",
        "--sjs-border-inside":
          "var(--admin-border, color-mix(in srgb, currentColor 15%, transparent))",
        "--sjs-corner-radius": "var(--admin-control-radius, var(--site-radius, 8px))",
        "--sjs-base-unit": "calc(var(--admin-row-padding, 16px) / 2)",
        "--sjs-shadow-small": "var(--admin-control-shadow, none)",
        "--sjs-shadow-medium": "var(--admin-shadow, none)",
        "--sjs-shadow-inner": "var(--admin-card-flat-shadow, none)",
        "--sjs-special-red": "var(--admin-danger, var(--error))",
      },
    });
    return survey;
  }, [definition]);
  const submitting = useRef(false);
  useEffect(() => {
    const submit = async (sender: Model, options: { allow: boolean; message?: string }) => {
      if (!onComplete) return;
      if (submitting.current) {
        options.allow = false;
        return;
      }
      submitting.current = true;
      try {
        options.allow = (await onComplete(sender.data as Record<string, unknown>)) !== false;
      } catch {
        options.allow = false;
      } finally {
        submitting.current = false;
      }
      if (!options.allow) options.message = "Your answers are preserved. Please try again.";
    };
    model.onCompleting.add(submit);
    return () => model.onCompleting.remove(submit);
  }, [model, onComplete]);
  return <SurveyComponent model={model} />;
}
