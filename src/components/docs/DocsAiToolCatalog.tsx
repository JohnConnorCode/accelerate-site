import { getRevenueAiTools, listRevenueAiCapabilities } from "@/lib/revenue-os/ai-tools";

/**
 * Renders the registered AI tool list from the live registry.
 * Docs must not copy that list into MDX.
 */
export function DocsAiToolCatalog() {
  const tools = listRevenueAiCapabilities();
  const schemas = new Map(getRevenueAiTools().map((tool) => [tool.name, tool.inputSchema]));
  return (
    <div className="not-prose mt-8">
      <dl className="divide-y divide-[var(--rule)] border-y border-[var(--rule)]">
        {tools.map((tool) => (
          <div key={tool.name} id={tool.name} className="scroll-mt-28 py-4">
            <dt className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <code className="text-sm text-heading">{tool.name}</code>
              <span className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-white-muted">
                {tool.impact.replace("_", " ")}
                {tool.confirmationRequired ? " · confirmation required" : ""}
              </span>
            </dt>
            <dd className="mt-1 text-sm leading-relaxed text-white-secondary">
              {tool.description}
            </dd>
            <dd className="mt-2 text-sm text-white-secondary">
              Connection: {tool.connectionRequirement}. Tool packs:{" "}
              {tool.packs.join(", ") || "none"}.
            </dd>
            <dd>
              <details className="mt-3">
                <summary className="min-h-10 cursor-pointer py-2 text-sm font-medium text-heading">
                  Input schema for {tool.name}
                </summary>
                <pre className="max-h-80 overflow-auto rounded-lg bg-[var(--rule)] p-4 text-xs leading-relaxed text-heading">
                  <code>{JSON.stringify(schemas.get(tool.name), null, 2)}</code>
                </pre>
              </details>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
