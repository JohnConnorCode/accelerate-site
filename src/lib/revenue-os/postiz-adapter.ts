import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { tenantIdForDatabase } from "@/lib/supabase/server";
import type { IntegrationAdapter } from "./integration-adapters";
import { decryptTenantSecret } from "./encryption";
import { isModuleEnabled } from "./modules";

const id = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const channelSchema = z.object({
  id,
  name: z.string().max(500),
  identifier: z.string(),
  disabled: z.boolean(),
});
export type PostizChannel = z.infer<typeof channelSchema>;
const identitySchema = z.object({
  connected: z.literal(true),
  organizationId: id,
  accelerateProtocol: z.literal(2),
});
const postSchema = z.object({
  id,
  content: z.string(),
  state: z.string(),
  publishDate: z.string(),
  releaseURL: z.string().nullable(),
  integration: z.object({ id }),
});
export type PostizPost = z.infer<typeof postSchema>;
export class PostizError extends Error {
  constructor(
    message: string,
    readonly outcome: "refused" | "unknown" = "refused",
  ) {
    super(message);
  }
}
export function postizOrigin() {
  const value = process.env.POSTIZ_ORIGIN;
  if (!value) throw new PostizError("Postiz hosting is not configured");
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    console.warn(
      "[social-marketing] Operation unavailable; details retained in the returned state or publication attempt.",
    );
    throw new PostizError("Invalid Postiz host configuration");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    !url.hostname.includes(".") ||
    url.hostname === "localhost"
  )
    throw new PostizError("Postiz requires an operator-configured HTTPS origin");
  return url.origin;
}
function apiKey(value: unknown) {
  return z
    .string()
    .trim()
    .min(20)
    .max(2000)
    .regex(/^[^\s\r\n]+$/)
    .parse(value);
}
async function request(
  key: string,
  path: string,
  body?: unknown | FormData,
  signal?: AbortSignal,
): Promise<unknown> {
  const origin = postizOrigin();
  const mutation = body !== undefined;
  try {
    const response = await fetch(`${origin}/api/public/v1${path}`, {
      method: mutation ? "POST" : "GET",
      headers: {
        Authorization: key,
        ...(body !== undefined && !(body instanceof FormData)
          ? { "Content-Type": "application/json" }
          : {}),
      },
      body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      redirect: "error",
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(12000)])
        : AbortSignal.timeout(12000),
    });
    if (!response.ok)
      throw new PostizError(
        `Postiz request failed (HTTP ${response.status})`,
        mutation ? "unknown" : "refused",
      );
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Missing response");
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > 1048576) {
          await reader.cancel();
          throw new Error("Response limit");
        }
        chunks.push(chunk.value);
      }
    } finally {
      reader.releaseLock();
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch (error) {
    if (error instanceof PostizError) throw error;
    throw new PostizError(
      mutation
        ? "Postiz outcome is unknown; reconcile before another submission"
        : "Postiz is unavailable or returned an invalid response",
      mutation ? "unknown" : "refused",
    );
  }
}
export const postizAdapter: IntegrationAdapter = {
  id: "postiz",
  name: "Postiz",
  category: "messaging",
  credentialFields: [{ formField: "apiKey", encryptedKey: "api_key" }],
  async verify(credentials) {
    try {
      const identity = identitySchema.parse(
        await request(apiKey(credentials.apiKey), "/is-connected"),
      );
      return { valid: true, provider: "postiz", accountDetails: { id: identity.organizationId } };
    } catch {
      console.warn(
        "[social-marketing] Operation unavailable; details retained in the returned state or publication attempt.",
      );
      return {
        valid: false,
        provider: "postiz",
        error:
          "Verify the Postiz host, organization API key and identity and service-hardening patches (protocol 2).",
      };
    }
  },
  async connect(credentials) {
    const result = await this.verify(credentials);
    if (!result.valid) throw new PostizError(result.error!);
    return {
      provider: "postiz",
      status: "active",
      connectedAt: new Date().toISOString(),
      accountIdentifier: result.accountDetails!.id,
    };
  },
  async health(credentials) {
    const start = Date.now();
    const result = await this.verify(credentials);
    return {
      provider: "postiz",
      healthy: result.valid,
      latencyMs: Date.now() - start,
      error: result.error,
    };
  },
  async reconcile() {
    return {
      provider: "postiz",
      status: "skipped",
      processed: 0,
      errors: ["Publication reconciliation belongs to the Social Marketing work handler."],
    };
  },
};

/** No caller-supplied URL, organization override, raw request or credential escape. */
export async function tenantPostizClient(
  db: SupabaseClient,
  options: { historyOnly?: boolean; signal?: AbortSignal } = {},
) {
  options.signal?.throwIfAborted();
  const tenantId = tenantIdForDatabase(db);
  if (!tenantId) throw new PostizError("Postiz requires a tenant-bound database");
  const origin = postizOrigin();
  const [tenant, connection] = await Promise.all([
    db.from("tenants").select("status,config,updated_at").eq("id", tenantId).maybeSingle(),
    db
      .from("integration_connections")
      .select("status,encrypted_credentials,credential_version,account_email")
      .eq("tenant_id", tenantId)
      .eq("provider", "postiz")
      .maybeSingle(),
  ]);
  if (
    tenant.error ||
    tenant.data?.status !== "active" ||
    (!options.historyOnly && !isModuleEnabled("social-marketing", tenant.data.config))
  )
    throw new PostizError("Social Marketing is disabled or this workspace is unavailable");
  const c = connection.data;
  if (
    connection.error ||
    c?.status !== "connected" ||
    typeof c.encrypted_credentials?.api_key !== "string"
  )
    throw new PostizError("Connect this workspace’s Postiz organization first");
  const key = apiKey(
    decryptTenantSecret(c.encrypted_credentials.api_key, tenantId, "postiz", "api_key"),
  );
  const call = (path: string, body?: unknown | FormData) =>
    request(key, path, body, options.signal);
  const identity = identitySchema.parse(await call("/is-connected"));
  if (identity.organizationId !== c.account_email)
    throw new PostizError("Postiz organization changed; reconnect this workspace");
  const channels = async () =>
    z
      .array(channelSchema)
      .max(200)
      .parse(await call("/integrations"));
  const assertChannel = async (channelId: string) => {
    id.parse(channelId);
    const channel = (await channels()).find((row) => row.id === channelId);
    if (!channel || channel.disabled || channel.identifier !== "linkedin-page")
      throw new PostizError("Select an active LinkedIn company page in this workspace");
    return channel;
  };
  const configurationVersion = String(tenant.data.updated_at);
  const assertCurrent = async () => {
    if (options.historyOnly) throw new PostizError("History access cannot submit or upload");
    const current = await tenantPostizClient(db, { signal: options.signal });
    if (
      current.credentialVersion !== c.credential_version ||
      current.organizationId !== c.account_email ||
      current.origin !== origin ||
      current.configurationVersion !== configurationVersion
    )
      throw new PostizError("Postiz connection changed; preview and approve again");
  };
  return {
    tenantId,
    origin,
    configurationVersion,
    organizationId: identity.organizationId,
    credentialVersion: Number(c.credential_version),
    channels,
    assertChannel,
    settings: async (channelId: string) => {
      await assertChannel(channelId);
      return call(`/integration-settings/${channelId}`);
    },
    upload: async (bytes: Uint8Array, mime: "image/png" | "image/jpeg") => {
      await assertCurrent();
      const png = bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71;
      const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
      if (!bytes.length || bytes.length > 3000000 || !(mime === "image/png" ? png : jpeg))
        throw new PostizError("Use a PNG or JPEG image up to 3 MB");
      const form = new FormData();
      form.append(
        "file",
        new Blob([Uint8Array.from(bytes)], { type: mime }),
        mime === "image/png" ? "approved.png" : "approved.jpg",
      );
      const asset = z.object({ id, path: z.string().url() }).parse(await call("/upload", form));
      if (new URL(asset.path).origin !== origin)
        throw new PostizError("Postiz returned an unexpected media origin");
      return asset;
    },
    submitNow: async (
      channelId: string,
      content: string,
      media: { id: string; path: string } | null,
    ) => {
      await assertCurrent();
      await assertChannel(channelId);
      z.string().trim().min(1).max(3000).parse(content);
      if (media && (new URL(media.path).origin !== origin || !id.safeParse(media.id).success))
        throw new PostizError("Invalid approved Postiz media");
      const result = await call("/posts", {
        type: "now",
        date: new Date().toISOString(),
        shortLink: false,
        tags: [],
        posts: [
          {
            integration: { id: channelId },
            value: [{ content, image: media ? [media] : [] }],
            settings: { __type: "linkedin-page" },
          },
        ],
      });
      const parsed = z
        .array(z.object({ postId: id, integration: id }))
        .length(1)
        .safeParse(result);
      if (!parsed.success || parsed.data[0]!.integration !== channelId)
        throw new PostizError(
          "Postiz acceptance could not be verified; reconcile before retrying",
          "unknown",
        );
      return parsed.data[0]!;
    },
    posts: async (startDate: string, endDate: string) => {
      z.iso.datetime().parse(startDate);
      z.iso.datetime().parse(endDate);
      return z
        .object({ posts: z.array(postSchema).max(500) })
        .parse(await call(`/posts?${new URLSearchParams({ startDate, endDate })}`)).posts;
    },
    metrics: async (postId: string) => {
      id.parse(postId);
      const rows = z
        .array(
          z.object({
            label: z.enum([
              "Impressions",
              "Unique Impressions",
              "Clicks",
              "Likes",
              "Comments",
              "Shares",
              "Engagement",
            ]),
            data: z
              .array(
                z.object({ total: z.number().finite().nonnegative(), date: z.string().max(30) }),
              )
              .max(100),
          }),
        )
        .max(7)
        .parse(await call(`/analytics/post/${postId}?date=7`));
      return rows.flatMap((row) => {
        const latest = row.data.at(-1);
        return latest ? [{ label: row.label, value: latest.total, date: latest.date }] : [];
      });
    },
  };
}
