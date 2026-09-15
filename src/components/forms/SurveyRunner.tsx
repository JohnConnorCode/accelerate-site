"use client";

import { useMemo } from "react";
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
  onComplete?: (data: Record<string, unknown>) => void;
}) {
  const model = useMemo(() => {
    const survey = new Model(toSurveyJson(schema));
    if (onComplete) {
      survey.onComplete.add((sender) => onComplete(sender.data as Record<string, unknown>));
    }
    return survey;
    // Rebuild only when the definition identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(schema)]);
  return <SurveyComponent model={model} />;
}
