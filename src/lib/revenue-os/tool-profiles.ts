/**
 * Task-focused tool profiles — which tool surface a client loads.
 *
 * Browser-safe leaf module (no registry, no SDK) so the MCP route, Settings UI
 * and AI discovery share the same vocabulary and URLs the server actually
 * serves. The registry projection that maps a profile to registered tool names
 * lives in `ai-tools.ts`, which owns the registry.
 *
 *   core  (Minimal) — daily reads plus the discovery pair. Budgeted client.
 *   ops   (Daily)   — recommended. Daily driver + business loop writes.
 *   full  (Power)   — every registered tool. Claude Code / CLI.
 */
import { siteUrl } from "@/config/tenant";

export type TaskToolProfile = "core" | "ops" | "full";

export const DEFAULT_TASK_TOOL_PROFILE: TaskToolProfile = "ops";

export const PROFILE_ALIASES: Record<string, TaskToolProfile> = {
  ops: "ops",
  daily: "ops",
  core: "core",
  minimal: "core",
  full: "full",
  power: "full",
};

/** Bare / unknown query → Power (`full`), matching the route default. */
export function parseTaskToolProfile(raw: string | null | undefined): TaskToolProfile {
  if (!raw) return "full";
  return PROFILE_ALIASES[raw.trim().toLowerCase()] ?? "full";
}

export const TASK_TOOL_PROFILE_META: Record<
  TaskToolProfile,
  { label: string; recommended: boolean; query: string; blurb: string }
> = {
  ops: {
    label: "Daily",
    recommended: true,
    query: "?profile=ops",
    blurb:
      "Daily driver: today, pipeline, contacts, pending actions, work, knowledge and the propose_* writes. Use this on the Claude app.",
  },
  core: {
    label: "Minimal",
    recommended: false,
    query: "?profile=core",
    blurb:
      "Smallest surface: daily reads plus the discovery pair. Fallback if the Claude app cannot load the recommended set.",
  },
  full: {
    label: "Power",
    recommended: false,
    query: "",
    blurb: "Every registered tool. Claude Code, or a second Claude desktop connector.",
  },
};

/** Absolute MCP URL for a profile. `base` is origin only (no /api/mcp). */
export function mcpEndpointUrl(base: string, profile: TaskToolProfile): string {
  const origin = base.replace(/\/$/, "");
  return `${origin}/api/mcp${TASK_TOOL_PROFILE_META[profile].query}`;
}

export function mcpProductionUrl(profile: TaskToolProfile = DEFAULT_TASK_TOOL_PROFILE): string {
  return mcpEndpointUrl(siteUrl(), profile);
}
