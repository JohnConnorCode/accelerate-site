import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { AI_TOOL_REGISTRY_VERSION, listRevenueAiCapabilities } from "@/lib/revenue-os/ai-tools";
import type { AiCapabilitiesPayload } from "@/lib/revenue-os/ai-operations-contract";

function label(name: string): string {
  return name
    .replace(/^get_/, "Read ")
    .replace(/^search_/, "Search ")
    .replace(/^propose_/, "Stage ")
    .replace(/_/g, " ");
}

export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const capabilities = listRevenueAiCapabilities();
  const payload: AiCapabilitiesPayload = {
    registryVersion: AI_TOOL_REGISTRY_VERSION,
    scope: "runtime_registry",
    readinessEvaluated: true,
    capabilities: capabilities.map((capability) => ({
      ...capability,
      label: label(capability.name),
      state: capability.available ? "available" : "unavailable",
      operationalReadiness: capability.available ? "ready" : "unavailable",
    })),
    safety: {
      registeredReads: capabilities.filter((capability) => capability.impact === "read").length,
      registeredInternalWrites: capabilities.filter(
        (capability) => capability.impact === "internal_write",
      ).length,
      registeredExternalActions: capabilities.filter(
        (capability) => capability.impact === "external_action",
      ).length,
      registeredDestructiveActions: capabilities.filter(
        (capability) => capability.impact === "destructive",
      ).length,
      readsMayExecuteDirectly: capabilities.some(
        (capability) => capability.impact === "read" && !capability.confirmationRequired,
      ),
      writesRequireApproval: capabilities
        .filter((capability) => capability.impact === "internal_write")
        .every((capability) => capability.confirmationRequired),
      externalActionsRequireApproval: capabilities
        .filter((capability) => capability.impact === "external_action")
        .every((capability) => capability.confirmationRequired),
      destructiveActionsAvailable: capabilities.some(
        (capability) => capability.impact === "destructive",
      ),
    },
  };
  return NextResponse.json(payload);
}
