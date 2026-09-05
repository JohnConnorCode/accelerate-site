-- =============================================================================
-- Plugin SDK: plugins table + plugin_tools + plugin_triggers.
--
-- Implements the northstar Phase D primitive (docs/NORTHSTAR.md §34):
-- a plugin manifest system with capability requirements, tool registration,
-- trigger registration, skills, and permission declarations.
--
-- Plugins extend — they do not fork. Every plugin tool flows through the
-- same governance (autonomy policy, capability graph, audit receipts) as
-- built-in tools. The existence of a plugin tool does not automatically
-- imply permission to use it.
--
-- Additive and idempotent. Safe to run repeatedly.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Plugin status enum
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.plugin_status AS ENUM (
    'pending_review',
    'approved',
    'enabled',
    'disabled',
    'revoked'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- Plugins table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.plugins (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL DEFAULT public.accelerate_default_tenant_id(),
  plugin_key        TEXT NOT NULL,            -- e.g. "jira", "linear", "slack-notifier"
  name              TEXT NOT NULL,            -- display name
  description       TEXT NOT NULL,            -- what the plugin does
  version           TEXT NOT NULL DEFAULT '1.0.0',
  status            public.plugin_status NOT NULL DEFAULT 'pending_review',
  author            TEXT,                     -- who made this plugin
  homepage_url      TEXT,                     -- link to docs/source
  required_capabilities TEXT[] NOT NULL DEFAULT '{}', -- capability_keys this plugin needs
  permissions       JSONB NOT NULL DEFAULT '{}', -- permission declarations (what it can do)
  config_schema     JSONB NOT NULL DEFAULT '{}', -- JSON schema for plugin-specific config
  config            JSONB NOT NULL DEFAULT '{}', -- current config values
  mcp_server_url    TEXT,                     -- external MCP server this plugin connects to
  skills            JSONB NOT NULL DEFAULT '[]',-- skill declarations (name, description, trigger)
  source            TEXT NOT NULL DEFAULT 'registry', -- "registry", "local", "mcp"
  approved_by       TEXT,                     -- who approved this plugin
  approved_at       TIMESTAMPTZ,             -- when approved
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One plugin key per tenant.
CREATE UNIQUE INDEX IF NOT EXISTS idx_plugins_tenant_key
  ON public.plugins (tenant_id, plugin_key);

-- Tenant-composite primary key index.
CREATE UNIQUE INDEX IF NOT EXISTS idx_plugins_tenant_id_id
  ON public.plugins (tenant_id, id);

-- Find enabled plugins.
CREATE INDEX IF NOT EXISTS idx_plugins_enabled
  ON public.plugins (tenant_id, status)
  WHERE status = 'enabled';

-- Find plugins that require a specific capability.
CREATE INDEX IF NOT EXISTS idx_plugins_capabilities
  ON public.plugins USING GIN (tenant_id, required_capabilities);

-- ---------------------------------------------------------------------------
-- Plugin tools: tools contributed by plugins
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.plugin_tools (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL DEFAULT public.accelerate_default_tenant_id(),
  plugin_id         UUID NOT NULL REFERENCES public.plugins(id) ON DELETE CASCADE,
  tool_name         TEXT NOT NULL,            -- e.g. "jira.create_issue"
  label             TEXT NOT NULL,            -- display name
  description       TEXT NOT NULL,            -- what the tool does
  input_schema      JSONB NOT NULL DEFAULT '{}',-- JSON schema for inputs
  impact            TEXT NOT NULL DEFAULT 'read'
                    CHECK (impact IN ('read','internal_write','external_action')),
  confirmation_required BOOLEAN NOT NULL DEFAULT true,
  autonomy_level    TEXT NOT NULL DEFAULT 'always_ask'
                    CHECK (autonomy_level IN ('prohibited','always_ask','ask_until_trusted','standing_permission','autonomous')),
  enabled           BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One tool name per plugin per tenant.
CREATE UNIQUE INDEX IF NOT EXISTS idx_plugin_tools_tenant_plugin_name
  ON public.plugin_tools (tenant_id, plugin_id, tool_name);

-- Tenant-composite primary key index.
CREATE UNIQUE INDEX IF NOT EXISTS idx_plugin_tools_tenant_id_id
  ON public.plugin_tools (tenant_id, id);

-- Find enabled tools for a plugin.
CREATE INDEX IF NOT EXISTS idx_plugin_tools_enabled
  ON public.plugin_tools (tenant_id, plugin_id, enabled)
  WHERE enabled = true;

-- ---------------------------------------------------------------------------
-- Plugin triggers: events that activate plugin behavior
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.plugin_triggers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL DEFAULT public.accelerate_default_tenant_id(),
  plugin_id         UUID NOT NULL REFERENCES public.plugins(id) ON DELETE CASCADE,
  trigger_type      TEXT NOT NULL,            -- "webhook", "cron", "event", "work_item"
  trigger_key       TEXT NOT NULL,            -- e.g. "opportunity.stage_changed", "cron:5m"
  description       TEXT,                     -- what this trigger does
  config            JSONB NOT NULL DEFAULT '{}', -- trigger-specific config (URL, schedule, event filter)
  enabled           BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One trigger key per plugin.
CREATE UNIQUE INDEX IF NOT EXISTS idx_plugin_triggers_tenant_plugin_key
  ON public.plugin_triggers (tenant_id, plugin_id, trigger_key);

-- Tenant-composite primary key index.
CREATE UNIQUE INDEX IF NOT EXISTS idx_plugin_triggers_tenant_id_id
  ON public.plugin_triggers (tenant_id, id);

-- Find enabled triggers.
CREATE INDEX IF NOT EXISTS idx_plugin_triggers_enabled
  ON public.plugin_triggers (tenant_id, plugin_id, enabled)
  WHERE enabled = true;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
ALTER TABLE public.plugins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant member access" ON public.plugins
  FOR ALL TO authenticated
  USING (tenant_id = private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id))
  WITH CHECK (tenant_id = private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id));

ALTER TABLE public.plugin_tools ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant member access" ON public.plugin_tools
  FOR ALL TO authenticated
  USING (tenant_id = private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id))
  WITH CHECK (tenant_id = private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id));

ALTER TABLE public.plugin_triggers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant member access" ON public.plugin_triggers
  FOR ALL TO authenticated
  USING (tenant_id = private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id))
  WITH CHECK (tenant_id = private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id));

-- =============================================================================
-- Validation: plugin names and keys never empty
-- =============================================================================
ALTER TABLE public.plugins
  ADD CONSTRAINT plugins_name_required CHECK (btrim(name) <> '');
ALTER TABLE public.plugins
  ADD CONSTRAINT plugins_key_required CHECK (btrim(plugin_key) <> '');
ALTER TABLE public.plugins
  ADD CONSTRAINT plugins_description_required CHECK (btrim(description) <> '');

ALTER TABLE public.plugin_tools
  ADD CONSTRAINT plugin_tools_name_required CHECK (btrim(tool_name) <> '');
ALTER TABLE public.plugin_tools
  ADD CONSTRAINT plugin_tools_label_required CHECK (btrim(label) <> '');
ALTER TABLE public.plugin_tools
  ADD CONSTRAINT plugin_tools_description_required CHECK (btrim(description) <> '');

ALTER TABLE public.plugin_triggers
  ADD CONSTRAINT plugin_triggers_type_required CHECK (btrim(trigger_type) <> '');
ALTER TABLE public.plugin_triggers
  ADD CONSTRAINT plugin_triggers_key_required CHECK (btrim(trigger_key) <> '');
