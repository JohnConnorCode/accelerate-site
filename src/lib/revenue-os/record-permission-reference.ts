import "server-only";
import { AI_TOOL_TO_MODULE_MAP, REVENUE_OS_MODULES } from "./modules";
import { AUTONOMY_LEVELS, HARD_FLOOR_ACTION_KEYS } from "./autonomy-policy";
import {
  MCP_RESOURCE_MODULES,
  RECORD_DENY_CODES,
  RECORD_PERMISSION_VERSION,
} from "./record-permissions";

export interface RecordPermissionReference {
  contract: string;
  generatedFrom: Record<string, string>;
  denyCodes: readonly string[];
  autonomyLevels: readonly string[];
  hardFloors: readonly string[];
  modules: Array<{ id: string; name: string; core: boolean; defaultEnabled: boolean }>;
  toolGrants: Array<{ tool: string; module: string }>;
  mcpResources: Array<{ uri: string; module: string }>;
  boundaries: string[];
}

/**
 * Machine-readable permission/capability reference generated from executable
 * registrations — never hand-maintained. Any drift between this output and
 * the committed snapshot fails the contract test: a manifest, module list,
 * or floor that changes without regenerating the reference is a reviewable
 * event, not a silent one.
 */
export function buildRecordPermissionReference(): RecordPermissionReference {
  return {
    contract: RECORD_PERMISSION_VERSION,
    generatedFrom: {
      modules: "src/lib/revenue-os/modules.ts REVENUE_OS_MODULES",
      toolGrants: "src/lib/revenue-os/modules.ts AI_TOOL_TO_MODULE_MAP",
      hardFloors: "src/lib/revenue-os/autonomy-policy.ts HARD_FLOOR_ACTION_KEYS",
      autonomyLevels: "src/lib/revenue-os/autonomy-policy.ts AUTONOMY_LEVELS",
      denyCodes: "src/lib/revenue-os/record-permissions.ts RECORD_DENY_CODES",
      mcpResources: "src/lib/revenue-os/record-permissions.ts MCP_RESOURCE_MODULES",
    },
    denyCodes: RECORD_DENY_CODES,
    autonomyLevels: AUTONOMY_LEVELS,
    hardFloors: HARD_FLOOR_ACTION_KEYS,
    modules: REVENUE_OS_MODULES.map((mod) => ({
      id: mod.id,
      name: mod.name,
      core: mod.isCore,
      defaultEnabled: mod.defaultEnabled,
    })),
    toolGrants: [...AI_TOOL_TO_MODULE_MAP.entries()].map(([tool, mod]) => ({
      tool,
      module: mod.id,
    })),
    mcpResources: Object.entries(MCP_RESOURCE_MODULES).map(([uri, module]) => ({
      uri,
      module,
    })),
    boundaries: [
      "platform_admin: founder email match only; bound to one explicit tenant per check.",
      "workspace_member: active tenant_memberships row required; writes/exports/actions require the admin role.",
      "integration: explicit tenant-bound system identity; no membership row, still tenant/module/grant bound.",
      "default-deny: unbound clients, unknown tenants, suspended workspaces, revoked memberships, disabled modules, ungranted entities, and unreadable fields all deny with a named code.",
    ],
  };
}
