import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import {
  AI_TOOL_REGISTRY_VERSION,
  listRevenueAiCapabilities,
  listRevenueAiCapabilitiesForProfile,
} from "@/lib/revenue-os/ai-tools";
import { parseTaskToolProfile } from "@/lib/revenue-os/tool-profiles";
import type { AiCapabilitiesPayload } from "@/lib/revenue-os/ai-operations-contract";

function label(name: string): string {
  return name
    .replace(/^get_/, "Read ")
    .replace(/^search_/, "Search ")
    .replace(/^propose_/, "Stage ")
    .replace(/_/g, " ");
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  // A task-focused profile scopes the same capability read that AI and MCP
  // use, so the UI, AI and MCP agree on available, missing and disabled tools.
  const profile = parseTaskToolProfile(new URL(request.url).searchParams.get("profile"));
  const capabilities =
    profile === "full"
      ? listRevenueAiCapabilities({ tenantConfig: auth.tenant.config })
      : listRevenueAiCapabilitiesForProfile(profile, { tenantConfig: auth.tenant.config });
  const payload: AiCapabilitiesPayload = {
    registryVersion: AI_TOOL_REGISTRY_VERSION,
    scope: "runtime_registry",
    profile,
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
