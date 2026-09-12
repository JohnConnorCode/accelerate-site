import {
  socialPreviewSchema,
  socialProposalSchema,
  socialWeeklySchema,
  type socialDraftSchema,
} from "@/lib/revenue-os/social-marketing-contract";
import type { z } from "zod";
import type { DemoBusinessState } from "./business-runtime";
import type { DemoScenarioPack } from "./scenarios";
type Draft = z.infer<typeof socialDraftSchema>;
type Post = { id: string; revision: number; state: string; draft: Draft; scheduled_at: string };
export type DemoSocialState = {
  posts: Post[];
  media: Record<string, string>;
  receipts: Record<string, unknown>[];
};
const now = () => new Date().toISOString();
async function digest(value: unknown) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(value))),
    ),
  )
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
export async function handleDemoSocial(
  pack: DemoScenarioPack,
  business: DemoBusinessState,
  modules: Record<string, boolean>,
  url: URL,
  method: string,
  body: Record<string, unknown>,
  save: () => void,
): Promise<Response | null> {
  const approval =
    url.pathname === "/api/admin/revenue-os/actions" && method === "PATCH"
      ? business.actions.find(
          (a) => a.id === body.id && a.action_type === "social_marketing_change",
        )
      : null;
  if (
    !url.pathname.startsWith("/api/admin/social") &&
    !approval &&
    !(
      url.pathname === "/api/admin/tenant/providers" &&
      ["configure_postiz", "disconnect"].includes(String(body.action)) &&
      (body.action === "configure_postiz" || body.provider === "postiz")
    )
  )
    return null;
  const state = (business.social ??= { posts: [], media: {}, receipts: [] });
  const enabled = modules["social-marketing"] === true;
  const json = (value: unknown, status = 200) => Response.json(value, { status });
  try {
    if (
      ["/api/admin/social", "/api/admin/social-history"].includes(url.pathname) &&
      method === "GET"
    )
      return json({
        enabled,
        posts: state.posts,
        attempts: [],
        receipts: state.receipts,
        media: [],
        mediaPreviewUrls: state.media,
        channels: [
          { id: "demo-linkedin-page", name: `${pack.name} (simulated LinkedIn)`, disabled: false },
        ],
        connection: { organizationId: "fictional-demo-organization", version: 1 },
        settings: {},
        setupError: null,
        truncated: false,
        demo: true,
      });
    if (!enabled)
      return json({ error: "Social Marketing is disabled; history remains available" }, 403);
    if (url.pathname === "/api/admin/tenant/providers")
      return json({ success: true, simulated: true });
    if (url.pathname === "/api/admin/social/media" && method === "POST") {
      if (
        !["image/png", "image/jpeg"].includes(String(body.mime)) ||
        typeof body.data !== "string" ||
        body.data.length > 500000
      )
        throw new Error("Use a demo image smaller than 375 KB");
      const id = crypto.randomUUID();
      state.media[id] = `data:${body.mime};base64,${body.data}`;
      save();
      return json({ id });
    }
    const makePreview = async (input: unknown) => {
      const parsed = socialPreviewSchema.parse(input);
      if (parsed.change.operation === "reconcile")
        throw new Error("The demo has no real provider receipts to associate");
      const ids =
        parsed.change.operation === "save"
          ? parsed.change.drafts.map((p) => p.id)
          : parsed.change.posts.map((p) => p.id);
      if (new Set(ids).size !== ids.length) throw new Error("Each post may appear once");
      const before = state.posts.filter((p) => ids.includes(p.id));
      for (const ref of parsed.change.operation === "save"
        ? parsed.change.drafts
        : parsed.change.posts) {
        const p = before.find((p) => p.id === ref.id);
        if ((!p && ref.revision !== 0) || (p && p.revision !== ref.revision))
          throw new Error("Draft changed; preview again");
      }
      const facts = { ...parsed, before, enabled };
      return {
        ...facts,
        digest: await digest(facts),
        consequences:
          parsed.change.operation === "schedule"
            ? "Simulate approval of these exact LinkedIn posts and times. No provider is contacted."
            : "Save this exact fictional change; publication remains simulated.",
      };
    };
    const apply = async (input: unknown) => {
      const parsed = socialProposalSchema.passthrough().parse(input);
      const fresh = await makePreview({ operationId: parsed.operationId, change: parsed.change });
      if (fresh.digest !== parsed.digest) throw new Error("Preview changed; review again");
      if (parsed.change.operation === "reconcile")
        throw new Error("No real provider receipts in the demo");
      if (parsed.change.operation === "save")
        for (const draft of parsed.change.drafts) {
          if (
            draft.channelId !== "demo-linkedin-page" ||
            (draft.mediaId && !state.media[draft.mediaId])
          )
            throw new Error("Unknown demo page or image");
          const post = {
            id: draft.id,
            revision: draft.revision + 1,
            state: "draft",
            draft,
            scheduled_at: draft.scheduledAt,
          };
          const index = state.posts.findIndex((p) => p.id === draft.id);
          if (index >= 0) state.posts[index] = post;
          else state.posts.push(post);
        }
      else
        for (const ref of parsed.change.posts) {
          const post = state.posts.find((p) => p.id === ref.id)!;
          if (
            parsed.change.operation === "schedule" &&
            Date.parse(post.scheduled_at) <= Date.now() + 60000
          )
            throw new Error("Choose a future publication time");
          post.state = parsed.change.operation === "schedule" ? "scheduled" : "cancelled";
        }
      const receipt = {
        id: crypto.randomUUID(),
        operation: parsed.change.operation,
        created_at: now(),
        simulated: true,
      };
      state.receipts.push(receipt);
      save();
      return receipt;
    };
    if (approval) {
      if (approval.status !== "pending") throw new Error("Approval already handled");
      if (body.decision !== "approve") {
        approval.status = "rejected";
        save();
        return json({ success: true });
      }
      const result = await apply(approval.payload);
      approval.status = "executed";
      approval.result = result;
      save();
      return json({ success: true, result });
    }
    if (body.kind === "week") {
      const input = socialWeeklySchema.parse(body.input);
      const parts = input.source.excerpt.split(/\n\s*\n/).filter((p) => p.trim());
      if (parts.length < 3) throw new Error("Supply three source paragraphs");
      if (parts.slice(0, 3).some((content) => `${content}\n\n${input.source.url}`.length > 3000))
        throw new Error(
          "Shorten the source paragraphs or URL so each complete post fits 3,000 characters",
        );
      return json({
        drafts: parts.slice(0, 3).map((content, i) => ({
          id: crypto.randomUUID(),
          revision: 0,
          title: `${input.source.title.slice(0, 198)} ${i + 1}`,
          content: `${content}\n\n${input.source.url}`,
          channelId: input.channelId,
          scheduledAt: new Date(Date.parse(input.weekStart) + i * 172800000).toISOString(),
          timeZone: input.timeZone,
          sources: [input.source],
          mediaId: null,
        })),
        publicationApproved: false,
      });
    }
    if (body.kind === "preview") return json(await makePreview(body.input));
    if (body.kind === "save") {
      const p = socialProposalSchema.passthrough().parse(body.input);
      if (p.change.operation !== "save") throw new Error("Use approval for scheduling");
      return json(await apply(p));
    }
    if (body.kind === "propose") {
      const p = socialProposalSchema.parse(body.input);
      const fresh = await makePreview({ operationId: p.operationId, change: p.change });
      if (fresh.digest !== p.digest) throw new Error("Preview changed");
      const id = crypto.randomUUID();
      business.actions.unshift({
        id,
        action_type: "social_marketing_change",
        title: `Social Marketing: ${p.change.operation}`,
        description: fresh.consequences,
        status: "pending",
        error: null,
        payload: fresh,
        result: null,
        pluginId: "social-marketing",
        created_at: now(),
      });
      save();
      return json({ id });
    }
    return json({ error: "Unsupported social demo operation" }, 422);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Demo operation failed" }, 422);
  }
}
