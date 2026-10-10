import { getRevenueAiTools } from "../src/lib/revenue-os/ai-tools";

// This is a projection, not a second operation or tool registry. It never opens a database.
console.log(
  JSON.stringify(
    getRevenueAiTools().map((tool) => ({
      name: tool.name,
      serviceTarget: tool.serviceTarget,
      impact: tool.impact,
      confirmationRequired: tool.confirmationRequired,
      operation: tool.operation ?? null,
    })),
  ),
);
