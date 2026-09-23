export type AIReadinessEvent = {
  visitor_id: string;
  event_name: string;
  properties: Record<string, string | number | boolean> | null;
};

export const AI_READINESS_EVENT_NAMES = [
  "ai_readiness_began",
  "ai_readiness_step_viewed",
  "ai_readiness_previewed",
  "ai_readiness_unlocked",
  "ai_readiness_pdf_downloaded",
  "ai_readiness_site_scan_completed",
  "ai_readiness_site_scan_partial",
  "ai_readiness_site_scan_failed",
] as const;

export function summarizeAIReadinessEvents(events: AIReadinessEvent[]) {
  const visitorsFor = (name: string) =>
    new Set(events.filter((event) => event.event_name === name).map((event) => event.visitor_id))
      .size;
  const stepViews = new Map<string, Set<string>>();
  const questionViews = new Map<number, Set<string>>();
  for (const event of events) {
    if (event.event_name !== "ai_readiness_step_viewed") continue;
    const questionNumber = event.properties?.question_number;
    if (typeof questionNumber === "number" && questionNumber >= 1 && questionNumber <= 15) {
      const visitors = questionViews.get(questionNumber) || new Set<string>();
      visitors.add(event.visitor_id);
      questionViews.set(questionNumber, visitors);
    }
    const step =
      typeof event.properties?.step === "string" &&
      ["profile", "assessment", "preview", "unlock"].includes(event.properties.step)
        ? event.properties.step
        : "assessment";
    const visitors = stepViews.get(step) || new Set<string>();
    visitors.add(event.visitor_id);
    stepViews.set(step, visitors);
  }
  const stepOrder = ["profile", "assessment", "preview", "unlock"];
  return {
    starts: visitorsFor("ai_readiness_began"),
    previews: visitorsFor("ai_readiness_previewed"),
    unlocks: visitorsFor("ai_readiness_unlocked"),
    pdfDownloads: visitorsFor("ai_readiness_pdf_downloaded"),
    scanCompletions: visitorsFor("ai_readiness_site_scan_completed"),
    scanPartials: visitorsFor("ai_readiness_site_scan_partial"),
    scanFailures: visitorsFor("ai_readiness_site_scan_failed"),
    stepViews: [...stepViews]
      .map(([label, visitors]) => ({ label, value: visitors.size }))
      .sort((a, b) => stepOrder.indexOf(a.label) - stepOrder.indexOf(b.label)),
    questionViews: [...questionViews]
      .sort(([a], [b]) => a - b)
      .map(([questionNumber, visitors]) => ({
        label: `Question ${questionNumber}`,
        value: visitors.size,
      })),
  };
}
