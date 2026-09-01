"use client";

import type { WorkDiagram as WorkDiagramData } from "@/content/work";

type DiagramSpec = {
  label: string;
  nodes: { title: string; detail?: string; emphasis?: boolean }[];
  footer?: string;
};

const specs: Record<WorkDiagramData["variant"], DiagramSpec> = {
  "work-shelter-routing": {
    label: "Client message is classified and routed by the judgment it requires",
    nodes: [
      { title: "Client message", detail: "Brief · approval · question", emphasis: true },
      { title: "Classify", detail: "Intent and next action" },
      { title: "Routine", detail: "System prepares" },
      { title: "Production", detail: "Delhi team" },
      { title: "High judgment", detail: "Founder", emphasis: true },
      { title: "Shared record", detail: "Follow-up · reporting" },
    ],
    footer: "The system moves information. People retain judgment and accountability.",
  },
  "healthcare-object-map": {
    label:
      "Healthcare real estate deal object connected to the people and information required to close",
    nodes: [
      { title: "Advisor", detail: "Manages opportunity" },
      { title: "Facility", detail: "Single asset or portfolio" },
      { title: "Deal", detail: "The operating center", emphasis: true },
      { title: "Buyer", detail: "Vetted access" },
      { title: "Documents", detail: "Files · photography" },
      { title: "Permissions", detail: "Who can see what" },
    ],
    footer:
      "The model organizes the transaction, rather than treating it as notes attached to a contact.",
  },
  "healthcare-deal-flow": {
    label: "Deal flow from healthcare facility opportunity to closed transaction",
    nodes: [
      { title: "Opportunity", detail: "Facility or portfolio", emphasis: true },
      { title: "Vetted access", detail: "Buyer permissions" },
      { title: "Diligence", detail: "Documents · photography" },
      { title: "Inquiry", detail: "Visible next action" },
      { title: "Decision", detail: "Advisor and buyer" },
      { title: "Close", detail: "One shared record", emphasis: true },
    ],
  },
  "superdebate-operating-loop": {
    label: "SuperDebate operating loop from expert discovery through the next debate",
    nodes: [
      { title: "Research", detail: "Experts · questions" },
      { title: "Invite", detail: "Personal outreach" },
      { title: "Prepare", detail: "Schedule · brief" },
      { title: "Debate", detail: "Live production", emphasis: true },
      { title: "Publish", detail: "Clips · scoring · context" },
      { title: "Learn", detail: "Relationship and system history" },
    ],
    footer:
      "Each debate creates a public experience and a better operating foundation for the next one.",
  },
  "superdebate-product-system": {
    label: "Five connected SuperDebate product surfaces",
    nodes: [
      { title: "Featured Debates", detail: "Watch serious public exchange", emphasis: true },
      { title: "Clubs", detail: "Organize a debate community" },
      { title: "Online", detail: "Compete live from anywhere" },
      { title: "Scoring", detail: "Judge with a clear framework" },
      { title: "Aurelius", detail: "Practice privately with AI", emphasis: true },
    ],
    footer: "Different entry points, all organized around the practice and experience of debate.",
  },
  "sparkblox-product-stack": {
    label: "Sparkblox product stack separating creator decisions from blockchain infrastructure",
    nodes: [
      { title: "Creator decisions", detail: "Collection · supply · experience", emphasis: true },
      { title: "Guided product", detail: "Create · configure · manage" },
      { title: "Launch surface", detail: "Embedded mint · campaign" },
      { title: "Smart contracts", detail: "Deploy · update · control" },
      { title: "Networks", detail: "Blockchain infrastructure" },
    ],
    footer: "Complexity remains available to the product without becoming the user's job.",
  },
  "thrive-builder-loop": {
    label: "Builder acquisition path from ecosystem program to application",
    nodes: [
      { title: "Program", detail: "Goal · funding · proof", emphasis: true },
      { title: "Target profile", detail: "Who can create value" },
      { title: "Research", detail: "Signals across ecosystems" },
      { title: "Qualify", detail: "Fit · seriousness · timing" },
      { title: "Conversation", detail: "Personalized outreach" },
      { title: "Application", detail: "A clear next step", emphasis: true },
    ],
    footer:
      "Capital becomes useful when the right builder can find and understand the route to it.",
  },
  "green-goods-proof-flow": {
    label: "Green Goods evidence flow from field work through funder review",
    nodes: [
      { title: "Field task", detail: "Real conservation work", emphasis: true },
      { title: "Capture", detail: "Before · after · context" },
      { title: "Operator review", detail: "Quality and meaning" },
      { title: "Attestation", detail: "Verifiable record" },
      { title: "Evidence", detail: "A funder can understand", emphasis: true },
    ],
    footer: "The infrastructure supports trust while the field workflow stays simple.",
  },
};

export function WorkDiagram({
  media,
  compact = false,
  inverted = false,
}: {
  media: WorkDiagramData;
  compact?: boolean;
  inverted?: boolean;
}) {
  const spec = specs[media.variant];
  const fiveAcross = spec.nodes.length === 5 && !compact;
  return (
    <div
      className={`${inverted ? "bg-[#111] text-[#fbfbfa]" : "bg-[var(--paper)] text-[var(--fg)]"} relative overflow-hidden p-5 sm:p-8 lg:p-10`}
      role="img"
      aria-label={spec.label}
      data-work-diagram={media.variant}
    >
      <div
        aria-hidden="true"
        className={`${inverted ? "opacity-[0.09]" : "opacity-[0.055]"} absolute inset-0 [background-image:linear-gradient(currentColor_1px,transparent_1px),linear-gradient(90deg,currentColor_1px,transparent_1px)] [background-size:2.5rem_2.5rem]`}
      />
      <div className="relative">
        {!compact ? (
          <div
            className={`${inverted ? "border-white/20" : "border-[var(--rule)]"} mb-9 flex items-baseline justify-between gap-5 border-b pb-4`}
          >
            <p
              className={`${inverted ? "text-white/65" : "text-[var(--mid)]"} font-mono text-[10px] uppercase tracking-[0.15em]`}
            >
              System model
            </p>
            <p
              className={`${inverted ? "text-white/65" : "text-[var(--mid)]"} text-right font-mono text-[9px] uppercase tracking-[0.12em]`}
            >
              Conceptual · not product UI
            </p>
          </div>
        ) : null}
        <div
          className={`${inverted ? "bg-white/20" : "bg-[var(--rule)]"} grid gap-px border ${inverted ? "border-white/20" : "border-[var(--rule)]"} ${compact ? "grid-cols-2 sm:grid-cols-3" : fiveAcross ? "sm:grid-cols-2 lg:grid-cols-5" : "sm:grid-cols-2 lg:grid-cols-3"}`}
        >
          {spec.nodes.map((node, index) => (
            <div
              key={`${node.title}-${index}`}
              className={`${inverted ? (node.emphasis ? "bg-[#fbfbfa] text-[#0b0b0b]" : "bg-[#111] text-[#fbfbfa]") : node.emphasis ? "bg-[var(--case-accent)] text-[var(--case-accent-ink)]" : "bg-[var(--bg)] text-[var(--fg)]"} relative min-w-0 ${compact ? "p-3" : "p-5 sm:min-h-40"}`}
              data-diagram-node="true"
            >
              <span
                className={`font-mono text-[9px] tabular-nums tracking-[0.14em] ${node.emphasis ? "opacity-100" : inverted ? "text-white/65" : "text-[var(--mid)]"}`}
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              <p
                className={`${compact ? "mt-3 text-[0.82rem]" : "mt-8 text-[clamp(1rem,1.7vw,1.35rem)]"} text-balance font-display font-medium leading-tight tracking-[-0.025em]`}
              >
                {node.title}
              </p>
              {!compact && node.detail ? (
                <p
                  className={`mt-2 text-xs leading-5 ${node.emphasis ? "opacity-100" : inverted ? "text-white/55" : "text-[var(--mid)]"}`}
                >
                  {node.detail}
                </p>
              ) : null}
              {index < spec.nodes.length - 1 ? (
                <span
                  aria-hidden="true"
                  className={`${compact ? "hidden" : ""} absolute right-4 top-4 font-mono text-sm ${node.emphasis ? "opacity-35" : inverted ? "text-white/30" : "text-[var(--soft)]"}`}
                >
                  →
                </span>
              ) : null}
            </div>
          ))}
        </div>
        {!compact && spec.footer ? (
          <p
            className={`${inverted ? "text-white/70" : "text-[var(--mid)]"} mt-7 max-w-[68ch] text-pretty text-sm leading-6`}
          >
            {spec.footer}
          </p>
        ) : null}
      </div>
    </div>
  );
}
