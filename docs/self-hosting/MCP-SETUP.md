# Model Context Protocol (MCP) Integration Guide

Accelerate Revenue OS includes an authoritative **Model Context Protocol (MCP)** server. It speaks the handshake-based ("legacy," in the [MCP spec's own current terminology](https://modelcontextprotocol.io/specification/versioning)) `initialize` lifecycle and negotiates whichever of `2025-06-18`, `2025-03-26`, or `2024-11-05` a connecting client requests, over the Streamable HTTP transport.

This allows external AI clients, including **Claude Desktop**, **Claude Code**, **ChatGPT** (native Connectors), **Cursor**, and **Google Antigravity**, to securely read bounded workspace state and stage actionable proposals into the operator's review queue.

---

## Safety & Architectural Invariants

1. **Bounded Reads Only**: Read tools (`get_today_snapshot`, `search_pipeline`, `get_record_timeline`, `search_knowledge_base`) return bounded query windows with sensitive credentials and tokens scrubbed.
2. **Action Queue Gating**: Mutations (`propose_task`, `propose_task_update`, `propose_stage_change`, `propose_send_email`, `propose_campaign_activation`, `propose_founder_note`, `propose_layout_change`) **never** write directly to production state. Instead, they insert staged proposals into `action_queue` requiring explicit operator approval from `/admin/today` or the Command Center before execution. There is no tool that approves a proposal — approval only happens from an authenticated admin session, deliberately, so nothing can both propose and approve its own change through the same channel.
3. **Deterministic Tenant Isolation**: External requests authenticate via founder session cookies or per-tenant `REVENUE_OS_API_KEY` Bearer tokens.

---

## 1. Claude Desktop Setup

Claude Desktop communicates over local `stdio` with your Revenue OS instance.

### Configuration File Location

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

### Configuration Snippet

Add the `revenue-os` server to `mcpServers`:

```json
{
  "mcpServers": {
    "revenue-os": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/your/clone/scripts/revenue-os-mcp.ts"],
      "env": {
        "NODE_OPTIONS": "--conditions=react-server",
        "ADMIN_EMAIL": "you@yourbusiness.example",
        "NEXT_PUBLIC_SUPABASE_URL": "https://<your-project-ref>.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "<your-supabase-service-role-key>"
      }
    }
  }
}
```

`NODE_OPTIONS` is required: `scripts/revenue-os-mcp.ts` imports `src/lib/revenue-os/mcp-server.ts`, which is marked `server-only`, and that condition only resolves with this flag set.

> **Tip**: If running locally from the repo directory, you can also run:
>
> ```bash
> npm run mcp:stdio
> ```

### Testing in Claude Desktop

1. Restart Claude Desktop.
2. Look for the hammer/tools icon in the prompt box showing available Revenue OS tools:
   - `get_today_snapshot`
   - `search_pipeline`
   - `get_record_timeline`
   - `search_knowledge_base`
   - `propose_task`
   - `propose_task_update`
   - `propose_stage_change`
   - `propose_send_email`
   - `propose_campaign_activation`
   - `propose_founder_note`
   - `propose_layout_change`
3. Ask Claude: _"What are my top priorities today in Revenue OS?"_ — Claude will invoke `get_today_snapshot` and summarize your queue.

---

## 2. Claude Code (CLI) Setup

To connect [Claude Code](https://docs.anthropic.com/en/docs/agents-and-tools/claude-code/overview) to your Revenue OS MCP server:

```bash
claude mcp add revenue-os --env NODE_OPTIONS=--conditions=react-server -- npx tsx /absolute/path/to/your/clone/scripts/revenue-os-mcp.ts
```

Or configure environment variables in your active shell / `.env.local`:

```bash
export NODE_OPTIONS="--conditions=react-server"
export ADMIN_EMAIL="you@yourbusiness.example"
export NEXT_PUBLIC_SUPABASE_URL="https://<project-ref>.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="<service-key>"
```

---

## 3. ChatGPT Setup

ChatGPT's app-wide **Connectors** feature is the current, correct way to connect ChatGPT
itself (not a Custom GPT) to a remote MCP server, and it speaks MCP directly over the
Streamable HTTP transport this server implements, with no OpenAPI schema and no wrapping the
protocol in an Action. Available on ChatGPT Pro, Plus, Business, Enterprise, and
Education plans.

The older **Custom GPT Actions** mechanism (an OpenAPI schema attached to one specific
Custom GPT) still exists as a separate path, but it is not what connects the ChatGPT app
itself, and it forces the model to hand-construct raw JSON-RPC request bodies to get
anything done. Use native Connectors unless you specifically need a Custom GPT.

### Endpoints

- **Platform Endpoint**: `https://<your-domain>/api/mcp`
- **Tenant-Scoped Endpoint**: `https://<your-domain>/api/public/<tenantSlug>/mcp`

Generate the tenant MCP key first, from `/admin/integrations` on your deployment
(`Integrations & Modules` → the MCP card). The key is shown once at generation time;
store it somewhere you can paste from.

### Step-by-Step Connector Setup

1. In the ChatGPT app, open **Settings → Connectors**.
2. Enable **Developer mode** if you don't see an option to add a custom connector yet
   (Settings → Connectors → Advanced).
3. Click **Add custom connector** (sometimes labeled **Create**).
4. **Name**: `Revenue OS` (or your workspace's brand name).
5. **URL**: `https://<your-domain>/api/public/<tenantSlug>/mcp` for a single-workspace
   deployment, or the platform endpoint above for the reference deployment.
6. **Authentication**: choose **API Key**, then paste the tenant MCP key you generated
   in `/admin/integrations` as a **Bearer token**. Selecting the wrong auth mode here is
   the single most common connection failure; this server only accepts a Bearer token,
   never OAuth or no-auth.
7. Save, then open a chat and explicitly **enable the connector for that conversation**
   (adding it in Settings does not turn it on everywhere by default). ChatGPT then calls
   `tools/list` and shows you the available actions, every tool in the reference table
   near the end of this document, grouped by what it reads versus what it proposes.
8. Ask a question that needs a read tool (_"what's on my plate today?"_) to prove the
   read path, then ask for something that needs a proposal (_"mark the roofer follow-up
   task done"_) to prove the write path. ChatGPT will show you the tool call it wants to
   make and wait for your confirmation before sending it; that confirmation is in
   addition to, not instead of, the founder approval this server's own action queue
   still requires at `/admin/today` before anything actually changes.

### What "write to the database" means here

No tool in this registry ever writes directly. Every mutating tool, including
`propose_task_update`, which is what lets ChatGPT mark a task complete, snooze it, or
edit its title, priority, or due date, stages a proposal in `action_queue` and returns
its id. Nothing happens until a human approves it from `/admin/today` or the Command
Center. ChatGPT can find a task's id from `get_today_snapshot`'s queue (task entries are
`"task:<id>"`) or `get_pending_actions`; either the bare id or the `"task:"`-prefixed
form works.

### Troubleshooting

- **Connector saves but ChatGPT never calls a tool.** You added it in Settings but did
  not enable it for the current conversation; re-check step 7.
- **"Invalid or missing tenant MCP API key."** The auth mode is set to something other
  than API Key/Bearer, the key was mistyped, or the key belongs to a different tenant
  than the URL you configured. Regenerate the key from `/admin/integrations` if unsure.
- **Connection looks like a network error with no useful message.** This is almost
  always an auth-mode mismatch (see above) rather than the server being unreachable;
  confirm `GET https://<your-domain>/api/public/<tenantSlug>/mcp` returns
  `{"status":"ok",...}` in a browser first to rule out a DNS/deploy problem before
  troubleshooting auth.

---

## 4. Cursor IDE Setup

To enable Revenue OS MCP in Cursor:

1. Open **Cursor Settings** -> **Features** -> **MCP Servers**.
2. Click **+ Add New MCP Server**.
3. **Name**: `revenue-os`
4. **Type**: `command`
5. **Command**:
   ```bash
   NODE_OPTIONS=--conditions=react-server npx tsx /absolute/path/to/your/clone/scripts/revenue-os-mcp.ts
   ```

Or create `.cursor/mcp.json` in your workspace root:

```json
{
  "mcpServers": {
    "revenue-os": {
      "command": "npx",
      "args": ["tsx", "scripts/revenue-os-mcp.ts"],
      "env": {
        "NODE_OPTIONS": "--conditions=react-server",
        "ADMIN_EMAIL": "you@yourbusiness.example",
        "NEXT_PUBLIC_SUPABASE_URL": "https://<project-ref>.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "<service-key>"
      }
    }
  }
}
```

---

## 5. Google Antigravity (AGY) Setup

In Antigravity CLI or IDE, declare Revenue OS in your `~/.gemini/antigravity/config.json` or project MCP settings:

```json
{
  "mcpServers": {
    "revenue-os": {
      "command": "npx",
      "args": ["tsx", "scripts/revenue-os-mcp.ts"],
      "cwd": "/absolute/path/to/your/clone",
      "env": {
        "NODE_OPTIONS": "--conditions=react-server",
        "ADMIN_EMAIL": "you@yourbusiness.example",
        "NEXT_PUBLIC_SUPABASE_URL": "https://<project-ref>.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "<service-key>"
      }
    }
  }
}
```

---

## Available MCP Capabilities Reference

### 1. Tools (`tools/list` & `tools/call`)

| Tool Name                     | Impact   | Description                                                                      |
| :---------------------------- | :------- | :------------------------------------------------------------------------------- |
| `get_today_snapshot`          | Read     | Retrieves urgent tasks, pending approvals, and unread inbound messages.          |
| `search_pipeline`             | Read     | Filter and search opportunities by stage, query, or activity date.               |
| `search_contacts`             | Read     | Search contacts and associated company details by name, email, or phone.         |
| `search_conversations`        | Read     | Search omnichannel conversations and inbound messages by status or unread state. |
| `get_pending_actions`         | Read     | List pending proposals currently in the `action_queue` awaiting founder review.  |
| `get_record_timeline`         | Read     | Retrieves chronological activity history for a specific contact or company.      |
| `search_knowledge_base`       | Read     | Searches Grounding Substrate and founder notes with provenance.                  |
| `propose_task`                | Proposal | Stages a new task with due date and priority for founder approval.               |
| `propose_task_update`         | Proposal | Stages completing, snoozing, or editing an existing task for founder approval.   |
| `propose_stage_change`        | Proposal | Stages an opportunity stage movement with required transition notes.             |
| `propose_send_email`          | Proposal | Drafts an outbound email with subject and body for founder review.               |
| `propose_conversation_reply`  | Proposal | Stages a reply to an active conversation thread for founder approval.            |
| `propose_campaign_activation` | Proposal | Stages campaign state changes.                                                   |
| `propose_founder_note`        | Proposal | Stages a founder note attachment to a contact or company record.                 |
| `propose_layout_change`       | Proposal | Stages workspace layout overrides.                                               |

### 2. Live Bounded Resources (`resources/list` & `resources/read`)

| Resource URI                      | MIME Type          | Description                                                    |
| :-------------------------------- | :----------------- | :------------------------------------------------------------- |
| `revenue-os://today/snapshot`     | `application/json` | Real-time queue, pending items count, and triage summary.      |
| `revenue-os://system/modules`     | `application/json` | Active and disabled plugin modules in the workspace.           |
| `revenue-os://knowledge/registry` | `application/json` | Second Brain Grounding Substrate registry and grounding rules. |

### 3. Prompt Workflows (`prompts/list` & `prompts/get`)

| Prompt Name                  | Purpose                                                                                             |
| :--------------------------- | :-------------------------------------------------------------------------------------------------- |
| `daily_operator_triage`      | Walks the assistant through evaluating today's priorities and staging necessary follow-ups.         |
| `pipeline_health_check`      | Analyzes stuck opportunities or those lacking next actions.                                         |
| `reactivate_stale_deals`     | Identifies stale/lost deals and drafts personalized recovery outreach for founder approval.         |
| `triage_inbox_conversations` | Inspects unread conversations, analyzes context, and drafts suggested replies for founder approval. |
