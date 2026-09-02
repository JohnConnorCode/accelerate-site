# Model Context Protocol (MCP) Integration Guide

Accelerate Revenue OS includes an authoritative **Model Context Protocol (MCP)** server complying with the [MCP 2024-11-05 specification](https://modelcontextprotocol.io/).

This allows external AI clients—including **Claude Desktop**, **Claude Code**, **ChatGPT (Custom GPT / Custom Actions)**, **Cursor**, and **Google Antigravity**—to securely read bounded workspace state and stage actionable proposals into the operator's review queue.

---

## Safety & Architectural Invariants

1. **Bounded Reads Only**: Read tools (`get_today_snapshot`, `search_pipeline`, `get_record_timeline`, `search_knowledge_base`) return bounded query windows with sensitive credentials and tokens scrubbed.
2. **Action Queue Gating**: Mutations (`propose_task`, `propose_stage_change`, `propose_send_email`, `propose_campaign_activation`, `propose_founder_note`, `propose_layout_change`) **never** write directly to production state. Instead, they insert staged proposals into `action_queue` requiring explicit operator approval from `/admin/today` or the Command Center before execution.
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

## 3. ChatGPT (Custom GPT / Actions) Setup

ChatGPT interacts with Revenue OS over the HTTP JSON-RPC 2.0 transport endpoint.

### Endpoints

- **Platform Endpoint**: `https://<your-domain>/api/mcp`
- **Tenant-Scoped Endpoint**: `https://<your-domain>/api/public/<tenantSlug>/mcp`

### Step-by-Step Custom GPT Setup

1. Open [ChatGPT](https://chatgpt.com) and navigate to **Explore GPTs** -> **Create a GPT**.
2. Go to the **Configure** tab.
3. **Name**: `Revenue OS Operator`
4. **Instructions**:
   ```text
   You are an AI assistant connected to Accelerate Revenue OS via Model Context Protocol.
   When asked about daily tasks, priorities, or pipeline health:
   1. Use get_today_snapshot or search_pipeline to retrieve grounded data.
   2. When proposing actions (tasks, emails, pipeline stage changes), format clear proposals for the founder to review.
   3. Note that all actions staged enter the action_queue and require founder confirmation before sending.
   ```
5. Click **Add Action** at the bottom of the Configuration page.
6. **Authentication**:
   - **Type**: `API Key`
   - **Auth Type**: `Bearer`
   - **API Key**: Enter your `REVENUE_OS_API_KEY` (configured in your environment or tenant settings).
7. **Schema**: Paste the OpenAPI 3.1 schema below:

```yaml
openapi: 3.1.0
info:
  title: Revenue OS MCP API
  version: 1.0.0
  description: HTTP JSON-RPC 2.0 Model Context Protocol endpoint for Revenue OS.
servers:
  - url: https://<your-domain>/api
    description: Revenue OS Production
paths:
  /mcp:
    post:
      summary: Send MCP JSON-RPC 2.0 Request
      operationId: sendMcpRequest
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - jsonrpc
                - id
                - method
              properties:
                jsonrpc:
                  type: string
                  enum: ["2.0"]
                id:
                  type:
                    - string
                    - number
                method:
                  type: string
                  enum:
                    - initialize
                    - ping
                    - tools/list
                    - tools/call
                    - resources/list
                    - resources/read
                    - prompts/list
                    - prompts/get
                params:
                  type: object
      responses:
        "200":
          description: Successful JSON-RPC response
          content:
            application/json:
              schema:
                type: object
                properties:
                  jsonrpc:
                    type: string
                  id:
                    type:
                      - string
                      - number
                      - "null"
                  result:
                    type: object
                  error:
                    type: object
```

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
