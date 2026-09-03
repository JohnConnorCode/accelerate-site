import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { recordAudit } from "./audit";
import { registerCapability } from "./capabilities";
import { registerAutonomyPolicy } from "./autonomy-policy";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PluginStatus = "pending_review" | "approved" | "enabled" | "disabled" | "revoked";
export type ToolImpact = "read" | "internal_write" | "external_action";
export type ToolAutonomyLevel = "prohibited" | "always_ask" | "ask_until_trusted" | "standing_permission" | "autonomous";

export interface Plugin {
  id: string;
  tenant_id: string;
  plugin_key: string;
  name: string;
  description: string;
  version: string;
  status: PluginStatus;
  author: string | null;
  homepage_url: string | null;
  required_capabilities: string[];
  permissions: Record<string, unknown>;
  config_schema: Record<string, unknown>;
  config: Record<string, unknown>;
  mcp_server_url: string | null;
  skills: unknown[];
  source: string;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PluginTool {
  id: string;
  tenant_id: string;
  plugin_id: string;
  tool_name: string;
  label: string;
  description: string;
  input_schema: Record<string, unknown>;
  impact: ToolImpact;
  confirmation_required: boolean;
  autonomy_level: ToolAutonomyLevel;
  enabled: boolean;
  created_at: string;
}

export interface PluginTrigger {
  id: string;
  tenant_id: string;
  plugin_id: string;
  trigger_type: string;
  trigger_key: string;
  description: string | null;
  config: Record<string, unknown>;
  enabled: boolean;
  created_at: string;
}

export interface PluginManifest {
  pluginKey: string;
  name: string;
  description: string;
  version?: string;
  author?: string;
  homepageUrl?: string;
  requiredCapabilities?: string[];
  permissions?: Record<string, unknown>;
  configSchema?: Record<string, unknown>;
  config?: Record<string, unknown>;
  mcpServerUrl?: string;
  skills?: unknown[];
  tools?: Array<{
    toolName: string;
    label: string;
    description: string;
    inputSchema?: Record<string, unknown>;
    impact?: ToolImpact;
    confirmationRequired?: boolean;
    autonomyLevel?: ToolAutonomyLevel;
  }>;
  triggers?: Array<{
    triggerType: string;
    triggerKey: string;
    description?: string;
    config?: Record<string, unknown>;
  }>;
}

// ---------------------------------------------------------------------------
// Register a plugin from a manifest (idempotent upsert)
// ---------------------------------------------------------------------------

export async function registerPlugin(
  supabase: SupabaseClient,
  manifest: PluginManifest,
  input?: {
    source?: string;
    actorEmail?: string | null;
  },
): Promise<Plugin> {
  const pluginKey = manifest.pluginKey.trim();
  const name = manifest.name.trim();
  const description = manifest.description.trim();

  if (!pluginKey) throw new Error("pluginKey is required");
  if (!name) throw new Error("name is required");
  if (!description) throw new Error("description is required");

  // Check for existing plugin.
  const { data: existing } = await supabase
    .from("plugins")
    .select("id, status")
    .eq("plugin_key", pluginKey)
    .maybeSingle();

  let pluginId: string;

  if (existing) {
    // Update existing plugin.
    const { data, error } = await supabase
      .from("plugins")
      .update({
        name,
        description,
        version: manifest.version ?? "1.0.0",
        author: manifest.author ?? null,
        homepage_url: manifest.homepageUrl ?? null,
        required_capabilities: manifest.requiredCapabilities ?? [],
        permissions: manifest.permissions ?? {},
        config_schema: manifest.configSchema ?? {},
        config: manifest.config ?? {},
        mcp_server_url: manifest.mcpServerUrl ?? null,
        skills: manifest.skills ?? [],
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    pluginId = (data as Plugin).id;
  } else {
    // Insert new plugin.
    const { data, error } = await supabase
      .from("plugins")
      .insert({
        plugin_key: pluginKey,
        name,
        description,
        version: manifest.version ?? "1.0.0",
        status: "pending_review",
        author: manifest.author ?? null,
        homepage_url: manifest.homepageUrl ?? null,
        required_capabilities: manifest.requiredCapabilities ?? [],
        permissions: manifest.permissions ?? {},
        config_schema: manifest.configSchema ?? {},
        config: manifest.config ?? {},
        mcp_server_url: manifest.mcpServerUrl ?? null,
        skills: manifest.skills ?? [],
        source: input?.source ?? "registry",
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    pluginId = (data as Plugin).id;
  }

  // Register plugin tools.
  if (manifest.tools?.length) {
    for (const tool of manifest.tools) {
      await supabase
        .from("plugin_tools")
        .upsert(
          {
            plugin_id: pluginId,
            tool_name: tool.toolName,
            label: tool.label,
            description: tool.description,
            input_schema: tool.inputSchema ?? {},
            impact: tool.impact ?? "read",
            confirmation_required: tool.confirmationRequired ?? true,
            autonomy_level: tool.autonomyLevel ?? "always_ask",
          },
          { onConflict: "tenant_id,plugin_id,tool_name" },
        )
        .throwOnError();
    }
  }

  // Register plugin triggers.
  if (manifest.triggers?.length) {
    for (const trigger of manifest.triggers) {
      await supabase
        .from("plugin_triggers")
        .upsert(
          {
            plugin_id: pluginId,
            trigger_type: trigger.triggerType,
            trigger_key: trigger.triggerKey,
            description: trigger.description ?? null,
            config: trigger.config ?? {},
          },
          { onConflict: "tenant_id,plugin_id,trigger_key" },
        )
        .throwOnError();
    }
  }

  // Register required capabilities.
  if (manifest.requiredCapabilities?.length) {
    for (const capKey of manifest.requiredCapabilities) {
      await registerCapability(supabase, {
        capabilityKey: capKey,
        label: capKey.split(".").map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(" "),
        category: "plugin",
        source: `plugin:${pluginKey}`,
      }).catch(() => {});
    }
  }

  // Register autonomy policies for plugin tools.
  if (manifest.tools?.length) {
    for (const tool of manifest.tools) {
      if (tool.autonomyLevel) {
        await registerAutonomyPolicy(supabase, {
          actionKey: `plugin.${pluginKey}.${tool.toolName}`,
          label: `Plugin ${name}: ${tool.label}`,
          level: tool.autonomyLevel,
          source: `plugin:${pluginKey}`,
          actorEmail: input?.actorEmail,
        }).catch(() => {});
      }
    }
  }

  // Fetch the final plugin record.
  const { data: plugin, error: fetchError } = await supabase
    .from("plugins")
    .select("*")
    .eq("id", pluginId)
    .single();
  if (fetchError) throw new Error(fetchError.message);

  await recordAudit(supabase, {
    actorEmail: input?.actorEmail || "system",
    action: "plugin.registered",
    entityType: "plugin",
    entityId: pluginId,
    source: "automation",
    after: { plugin_key: pluginKey, name, version: manifest.version ?? "1.0.0" },
  });

  return plugin as Plugin;
}

// ---------------------------------------------------------------------------
// List plugins
// ---------------------------------------------------------------------------

export async function listPlugins(
  supabase: SupabaseClient,
  input?: {
    status?: PluginStatus;
  },
): Promise<Plugin[]> {
  let query = supabase
    .from("plugins")
    .select("*")
    .order("name", { ascending: true });

  if (input?.status) {
    query = query.eq("status", input.status);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as Plugin[];
}

// ---------------------------------------------------------------------------
// List tools for a plugin
// ---------------------------------------------------------------------------

export async function listPluginTools(
  supabase: SupabaseClient,
  pluginId: string,
  input?: { enabledOnly?: boolean },
): Promise<PluginTool[]> {
  let query = supabase
    .from("plugin_tools")
    .select("*")
    .eq("plugin_id", pluginId)
    .order("tool_name", { ascending: true });

  if (input?.enabledOnly) {
    query = query.eq("enabled", true);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as PluginTool[];
}

// ---------------------------------------------------------------------------
// List all enabled plugin tools (for tool pack assembly)
// ---------------------------------------------------------------------------

export async function listAllEnabledPluginTools(
  supabase: SupabaseClient,
): Promise<PluginTool[]> {
  const { data, error } = await supabase
    .from("plugin_tools")
    .select("*, plugins!inner(status)")
    .eq("enabled", true)
    .eq("plugins.status", "enabled")
    .order("tool_name", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as PluginTool[];
}

// ---------------------------------------------------------------------------
// List triggers for a plugin
// ---------------------------------------------------------------------------

export async function listPluginTriggers(
  supabase: SupabaseClient,
  pluginId: string,
  input?: { enabledOnly?: boolean },
): Promise<PluginTrigger[]> {
  let query = supabase
    .from("plugin_triggers")
    .select("*")
    .eq("plugin_id", pluginId)
    .order("trigger_key", { ascending: true });

  if (input?.enabledOnly) {
    query = query.eq("enabled", true);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as PluginTrigger[];
}

// ---------------------------------------------------------------------------
// Update plugin status (approve, enable, disable, revoke)
// ---------------------------------------------------------------------------

export async function updatePluginStatus(
  supabase: SupabaseClient,
  pluginId: string,
  status: PluginStatus,
  input?: {
    approvedBy?: string | null;
    actorEmail?: string | null;
  },
): Promise<void> {
  const { data: before, error: readError } = await supabase
    .from("plugins")
    .select("id, plugin_key, name, status")
    .eq("id", pluginId)
    .single();
  if (readError) throw new Error(readError.message);

  const updates: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (status === "approved" || status === "enabled") {
    updates.approved_by = input?.approvedBy ?? input?.actorEmail ?? "system";
    updates.approved_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from("plugins")
    .update(updates)
    .eq("id", pluginId);
  if (error) throw new Error(error.message);

  await recordAudit(supabase, {
    actorEmail: input?.actorEmail || "system",
    action: "plugin.status_changed",
    entityType: "plugin",
    entityId: pluginId,
    source: "automation",
    before: { status: before.status },
    after: { status, approved_by: updates.approved_by },
  });
}

// ---------------------------------------------------------------------------
// Get a single plugin
// ---------------------------------------------------------------------------

export async function getPlugin(
  supabase: SupabaseClient,
  pluginKey: string,
): Promise<Plugin | null> {
  const { data, error } = await supabase
    .from("plugins")
    .select("*")
    .eq("plugin_key", pluginKey)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as Plugin | null;
}
