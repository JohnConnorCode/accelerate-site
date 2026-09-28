# Model Context Protocol (MCP) Integration Guide

This guide covers workspace MCP connections. For owner-delegated website
execution from ChatGPT, use the separately scoped
[Site Studio OAuth guide](SITE-STUDIO-CHATGPT.md). Ordinary workspace keys and
the local runner do not receive that delegation or gain direct editor execution.

Accelerate Revenue OS includes an authoritative **Model Context Protocol (MCP)** server. It speaks the handshake-based ("legacy," in the [MCP spec's own current terminology](https://modelcontextprotocol.io/specification/versioning)) `initialize` lifecycle and negotiates whichever of `2025-06-18`, `2025-03-26`, or `2024-11-05` a connecting client requests, over the Streamable HTTP transport.

Compatible MCP clients, including **Claude Desktop**, **Claude Code**, **Cursor**, and **Google Antigravity**, can read bounded workspace state and stage actionable proposals into the operator's review queue. Check each client's current transport and authentication support before connecting it.

---

## Safety & Architectural Invariants

1. **Bounded Reads Only**: Read tools (`get_today_snapshot`, `search_pipeline`, `get_record_timeline`, `search_knowledge_base`) return bounded query windows with sensitive credentials and tokens scrubbed.
2. **Action Queue Gating**: Mutations (`propose_task`, `propose_task_update`, `propose_stage_change`, `propose_send_email`, `propose_campaign_activation`, `propose_founder_note`, `propose_layout_change`) **never** write directly to production state. Instead, they insert staged proposals into `action_queue` requiring explicit operator approval from `/admin/today` or the Command Center before execution. There is no tool that approves a proposal — approval only happens from an authenticated admin session, deliberately, so nothing can both propose and approve its own change through the same channel.
3. **Deterministic Tenant Isolation**: The tenant HTTP endpoint accepts the key issued for that workspace in Integrations. The platform endpoint and local runner have separate installation-level credentials and scope.

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

## 3. ChatGPT compatibility

The workspace endpoint is `https://<your-domain>/api/public/<tenantSlug>/mcp`.
It accepts a workspace Bearer key generated in **Integrations**. This is useful
for MCP clients that support custom Bearer credentials, but **do not generate or
rotate a workspace key for ChatGPT setup**: [OpenAI's authentication guide](https://developers.openai.com/plugins/build/auth)
says ChatGPT cannot present custom API keys. The workspace endpoint does not
implement the OAuth flow required for an authenticated ChatGPT MCP app.

[OpenAI's current availability guide](https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt)
also says custom MCP apps are **web only**. Full MCP write support is in beta
for Business, Enterprise, and Edu workspaces; Pro is limited to read/fetch.
A workspace key therefore cannot enable Command Center control in the ChatGPT
phone app, regardless of plan.

The separately scoped [Site Studio OAuth connection](SITE-STUDIO-CHATGPT.md)
is the path for owner-delegated website editing in a supported ChatGPT web
workspace, after installation-level OAuth configuration and a real-client
verification. It does not expose the ordinary workspace tools. Check that the
OAuth metadata endpoint is configured before attempting a connection; a route
existing in source or a public MCP health response is not connection proof.

For the ordinary registered workspace tools in ChatGPT web, use the separate
[workspace MCP OAuth setup](WORKSPACE-MCP-OAUTH.md). Its endpoint has a distinct
resource audience and a revocable admin delegation. It does not change the
Bearer-key endpoint above or grant Site Studio website execution.

### What a workspace MCP proposal means

Workspace MCP mutation tools stage proposals rather than directly changing the
target record. For example, `propose_task_update` can stage a task completion,
snooze, or edit in `action_queue` and return its proposal ID. The target task
changes only after an operator approves the proposal in Today or Command Center.
A compatible client can find a task ID in `get_today_snapshot` or
`get_pending_actions`.

### Troubleshooting

- **"Invalid or missing tenant MCP API key."** In a compatible client, check that
  the key is sent as a Bearer credential and matches the tenant slug in the URL.
  Generating a replacement rotates the existing credential.
- **The host cannot connect.** Check DNS and deployment reachability. A public
  `GET` to the tenant endpoint should return `{"status":"ok",...}`. That response
  does not verify authentication, tool discovery, or a tool call.

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

## Selected workspace MCP capabilities

This table illustrates common operations. The authenticated `tools/list` response
is authoritative for the deployed version, selected profile, enabled modules and
ready connections. The workspace MCP surface does not cover every admin action.

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
