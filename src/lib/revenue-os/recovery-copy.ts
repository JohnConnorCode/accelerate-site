export type RecoveryCopyMotion =
  "stale_lead" | "unsold_estimate" | "no_show" | "dormant_customer" | "lapsed_client";

export type RecoveryCopyTemplate = { subject: string; body: string };

/** Founder-editable starting points for the bounded recovery motions.
 * They deliberately use only values the campaign executor resolves. */
export function recoveryCopyTemplate(motion: RecoveryCopyMotion): RecoveryCopyTemplate {
  const close =
    "\n\n{{offer_label}}: {{booking_url}}\n\nIf the timing has changed, just reply and let us know.\n\n— The team";
  switch (motion) {
    case "unsold_estimate":
      return {
        subject: "A simple next step for your estimate",
        body: `Hello,\n\nYou previously asked us for an estimate. If you are still weighing options, we can answer the open questions and help you decide with confidence.${close}`,
      };
    case "no_show":
      return {
        subject: "Want to find a better time?",
        body: `Hello,\n\nWe missed connecting earlier. If this is still a priority, we can make the next conversation focused and useful.${close}`,
      };
    case "dormant_customer":
      return {
        subject: "A useful check-in",
        body: `Hello,\n\nIt has been a little while since we worked together. We wanted to see whether there is anything we can help you improve, simplify, or get moving again.${close}`,
      };
    case "lapsed_client":
      return {
        subject: "Would a fresh look be useful?",
        body: `Hello,\n\nWe appreciated working with you before. If your priorities have changed, we would be glad to take a fresh look and recommend the most useful next step.${close}`,
      };
    case "stale_lead":
    default:
      return {
        subject: "Still looking for a clear next step?",
        body: `Hello,\n\nYou reached out before, and we wanted to make sure you have a simple path forward. We can take a fresh look at what matters most and help you decide what to do next.${close}`,
      };
  }
}
