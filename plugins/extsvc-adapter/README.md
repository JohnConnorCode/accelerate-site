# External Capability Services — Operator Self-Hosting Guide

This guide explains how to run an external open-source service (the "upstream") as a
governed capability for Accelerate. The pattern is the same for every upstream:

1. You self-host the upstream service on your infrastructure.
2. You add its URL and credentials through Accelerate's encrypted adapter path.
3. Accelerate talks to it over HTTPS with pinned origin, bounded bytes/time,
   tenant-scoped idempotency, and no vendored code.

**The upstream is NOT copied into this repository.** The adapter in this repo is a thin
client that enforces the contract in `src/lib/revenue-os/extsvc-adapter-contract.ts`.

---

## Quick Checklist for Every Upstream

| Step | What to do                                                              | Where                                              |
| ---- | ----------------------------------------------------------------------- | -------------------------------------------------- |
| 1    | Deploy the upstream service                                             | Your infrastructure (VM, Kubernetes, Docker, etc.) |
| 2    | Configure the upstream: auth, CORS, webhooks                            | Upstream admin UI / config files                   |
| 3    | Generate/obtain credentials (API key, token, secret)                    | Upstream                                           |
| 4    | Add the capability in Accelerate: **Admin → Integrations → [Upstream]** | Accelerate                                         |
| 5    | Paste the upstream URL (if adapter allows) and credentials              | Accelerate                                         |
| 6    | Test the connection                                                     | Accelerate shows "active" / "healthy"              |
| 7    | Verify the capability appears for Coworkers                             | **Admin → Coworkers → [Coworker] → Capabilities**  |
| 8    | Pin the upstream version in the adapter                                 | `extsvc-adapter-contract.ts` versionPin            |

---

## Network & Security Requirements

### Egress (Accelerate → Upstream)

- Accelerate must be able to reach the upstream's base URL on HTTPS (port 443).
- If upstream is on a private network, configure VPC peering, VPN, or SSH tunnel.
- **Do not expose the upstream to the public internet** unless it's designed for it.

### Ingress (Upstream → Accelerate) — for webhooks

- Some upstreams send webhooks (e.g., Papermark view events, Dub click events, Documenso signing callbacks).
- Create a **dedicated webhook endpoint** in Accelerate: `/api/public/[tenantSlug]/webhooks/<upstream>/`
- Configure the upstream to POST to that URL.
- The adapter MUST verify the webhook signature using `timingSafeEqual` and reject replays outside a bounded window (see `integration-adapters.ts` patterns).

### Credentials

- Credentials are entered once in **Admin → Integrations** and stored encrypted via `encryptSecret`.
- They are decrypted at use-time via `resolveTenantProviderSecrets` or `decryptTenantSecret`.
- **Never** log credentials. The adapter contract forbids credentials in errors or logs.

---

## Upstream-Specific Notes

### Crawlee (Opportunity Radar discovery)

- **Self-host**: Docker image `apify/actor-node-crawlee` or run as Node.js process.
- **No auth by default**: Run behind VPN or add a simple API key middleware.
- **Webhooks**: None needed; Accelerate polls/runs Crawlee as a job.
- **Rate limits**: Respect target sites' robots.txt and terms. Configure Crawlee's `requestHandlerTimeoutSecs` and `maxConcurrency`.

### Stagehand (Browser Worker)

- **Self-host**: Requires Playwright browsers. Docker: `mcr.microsoft.com/playwright:v1.40-jammy` + Stagehand.
- **No cloud Browserbase**: This card uses **local Playwright only**. Do not add `BROWSERBASE_API_KEY`.
- **Model provider**: Requires an LLM API key (OpenAI, Anthropic, Gemini) configured in Stagehand.
- **Resources**: Allocate 2-4 GB RAM per concurrent browser session.

### faster-whisper (Call Intelligence)

- **Self-host**: Docker `ghcr.io/guillaumekln/faster-whisper-server:latest` or Python service.
- **GPU recommended**: `ctranslate2` with CUDA for speed. CPU works but slower.
- **Audio upload**: Accelerate uploads audio files to the sidecar's `/transcribe` endpoint.
- **PII**: Configure the sidecar to not persist audio files. Accelerate uploads, receives transcript, deletes.

### Activepieces (Action Network)

- **Self-host**: Docker `activepieces/activepieces:latest` with Postgres.
- **Pieces as MCP**: Activepieces exposes each piece as an MCP server. Accelerate discovers and registers selected pieces as capability-gated tools.
- **No builder UI**: This integration does NOT embed the Activepieces builder. Accelerate keeps triggers, WorkItems, approvals, receipts.
- **Credentials**: Each piece needs its own credentials (e.g., Google Sheets OAuth, Slack token). Enter them in Activepieces, then Accelerate calls the piece via MCP.

### Papermark (Proposal Intelligence)

- **Self-host**: Docker `papermark/papermark:latest` with Postgres, Redis, S3-compatible storage.
- **Webhooks**: Configure Papermark to send `document.viewed` events to `/api/public/[tenantSlug]/webhooks/papermark/`.
- **Signature**: Verify `Papermark-Signature` header with `timingSafeEqual`.
- **Storage**: Use your own S3 bucket (MinIO, AWS S3, Cloudflare R2).

### Documenso (E-signature)

- **Self-host**: Docker `documenso/documenso:latest` with Postgres, Redis, S3.
- **Certificate**: Documenso requires a signing certificate. Generate a self-signed `.p12` for testing, use a real one for production.
- **Webhooks**: Configure `document.completed` → `/api/public/[tenantSlug]/webhooks/documenso/`.
- **Flow**: Accelerate generates agreement from accepted proposal → sends via Documenso → on signed, transitions opportunity to CLOSED WON.

### listmonk (Lead Nurture)

- **Self-host**: Single binary or Docker `listmonk/listmonk:latest` with Postgres.
- **Version pin REQUIRED**: Pin to a CVE-clean version (check GitHub Security Advisories for template injection, CSRF-to-XSS, stored XSS).
- **Egress restriction**: Run listmonk with network policy allowing only Accelerate and your SMTP provider.
- **No auto-send**: Every campaign requires approval in Accelerate before listmonk delivers.

### Chatwoot (Support + Website Conversations)

- **Self-host**: Docker `chatwoot/chatwoot:latest` with Postgres, Redis, S3.
- **Website widget**: Add Chatwoot's JS snippet to your site. Configure inbox → Accelerate webhook.
- **Webhooks**: `conversation.created`, `message.created` → `/api/public/[tenantSlug]/webhooks/chatwoot/`.
- **Identity**: Chatwoot contact → Accelerate identity resolution (see `inbound.ts`).

### Dub (Attribution)

- **Self-host**: Docker `dubinc/dub:latest` with Postgres (PlanetScale), Redis (Upstash), Tinybird.
- **Links**: Accelerate creates tracked links via Dub API. Conversion webhook → full chain.
- **AGPL core**: Core is AGPL-3.0; enterprise features in `/ee` are commercial. Use CE only.
- **Domain**: Configure a custom short domain (e.g., `go.yourcompany.com`).

### Docling (Document Intake)

- **Self-host**: Docker `doclingproject/docling-serve:latest` or Python `docling-serve` with `uv`.
- **Resources**: 4-8 GB RAM for model loading. Models download once and cache.
- **Formats**: PDF, DOCX, PPTX, XLSX, HTML, images, audio.
- **No chat-with-PDF**: This integration extracts structure → canonical records + WorkItems. No RAG chat product.

---

## Version Pinning Procedure

Every adapter declares a `versionPin` in `extsvc-adapter-contract.ts`:

```typescript
versionPin: {
  project: "stagehand",
  version: "4.0.1",
  reviewedAt: "2026-08-15T00:00:00.000Z",
  breakingChangesSince: "None since 4.0.0",
}
```

**When the upstream releases a new version:**

1. Test the new version in a staging environment.
2. Check the upstream changelog for breaking changes.
3. Update the adapter if needed (new endpoints, changed schemas, removed features).
4. Update `versionPin.version`, `reviewedAt`, and `breakingChangesSince`.
5. Run `npm run test:extsvc-adapter-conformance` — it will verify the pin is fresh.
6. Deploy the adapter change. The upstream service can then be upgraded.

**Never** upgrade the upstream service without updating the adapter pin first.

---

## Troubleshooting

| Symptom                               | Likely Cause                                     | Fix                                                     |
| ------------------------------------- | ------------------------------------------------ | ------------------------------------------------------- |
| "Provider unavailable" in Admin       | Upstream down, network, or wrong URL             | Check upstream health endpoint; verify VPC/DNS          |
| "Credential verification failed"      | Wrong key, expired, or insufficient scopes       | Re-enter credentials in Admin → Integrations            |
| Webhook signature mismatch            | Upstream sends different signature format        | Check adapter's signature verification logic            |
| "Capability unavailable" for Coworker | Adapter not registered, or capability not synced | Run capability sync; check adapter registration         |
| Idempotency conflict on replay        | Same requestId used twice                        | Accelerate reuses the original receipt; this is correct |
| Slow health check                     | Upstream latency > timeoutMs                     | Increase `timeoutMs` in adapter transport config        |
| Rate limit errors                     | Upstream rate limit exceeded                     | Add backoff in adapter; respect `Retry-After` header    |

---

## Adding a New Upstream (for Contributors)

1. Create adapter file: `src/lib/revenue-os/<upstream>-adapter.ts` (or add to `integration-adapters.ts`).
2. Implement `ExtsvcAdapterContract` fully.
3. Add to `INTEGRATION_ADAPTERS` in `integration-adapters.ts`.
4. Run `npm run test:extsvc-adapter-conformance` — must pass.
5. Add version pin with today's `reviewedAt`.
6. Write operator guide section above for this upstream.
7. Run `npm run verify:agent-contract`, `tsc`, `lint`, `build`.

---

## Contract Reference

- **Adapter contract**: `src/lib/revenue-os/extsvc-adapter-contract.ts`
- **Conformance test**: `scripts/test-extsvc-adapter-conformance.ts`
- **Reference adapter**: `src/lib/revenue-os/stripe-adapter.ts`
- **Integration registry**: `src/lib/revenue-os/integration-adapters.ts`
- **Credential handling**: `src/lib/revenue-os/encryption.ts`

Run `npm run test:extsvc-adapter-conformance` before any PR that touches an adapter.
