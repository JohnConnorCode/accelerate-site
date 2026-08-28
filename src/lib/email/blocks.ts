import { render } from "@maily-to/render";
import { siteUrl, tenant } from "@/config/tenant";

/**
 * Small, typed authoring vocabulary for operator-created campaign mail.
 * Transactional definitions stay code-owned in `registry.ts`; designs built in
 * Email Studio use this format so a preview, a test, and a delivery all render
 * through exactly one path.
 */
export type EmailBlock =
  | { id: string; type: "heading"; text: string }
  | { id: string; type: "paragraph"; text: string }
  | { id: string; type: "button"; text: string; url: string }
  | { id: string; type: "divider" }
  | { id: string; type: "spacer"; height: number };

export type EmailBlockType = EmailBlock["type"];

export const EMAIL_BLOCK_TYPES: Array<{ type: EmailBlockType; label: string; hint: string }> = [
  { type: "heading", label: "Heading", hint: "Introduce one clear idea." },
  { type: "paragraph", label: "Paragraph", hint: "Write the necessary context." },
  { type: "button", label: "Button", hint: "Give the reader one next action." },
  { type: "divider", label: "Divider", hint: "Separate distinct parts." },
  { type: "spacer", label: "Space", hint: "Create deliberate breathing room." },
];

export const EMAIL_LAYOUTS: Array<{ id: string; name: string; subject: string; previewText: string; blocks: EmailBlock[] }> = [
  {
    id: "operator-note",
    name: "Operator note",
    subject: "A clear next step for {{name}}",
    previewText: `A short, personal note from ${tenant.brand.name}.`,
    blocks: [
      { id: "heading", type: "heading", text: "A clear next step" },
      { id: "intro", type: "paragraph", text: "Hi {{name}},\n\nWe reviewed the context and identified the most useful next move." },
      { id: "detail", type: "paragraph", text: "{{message}}" },
      { id: "cta", type: "button", text: "Book a call", url: `${siteUrl()}/contact` },
    ],
  },
  {
    id: "follow-up",
    name: "Thoughtful follow-up",
    subject: "Following up, {{name}}",
    previewText: "A direct follow-up with one useful action.",
    blocks: [
      { id: "heading", type: "heading", text: "Following up" },
      { id: "copy", type: "paragraph", text: "Hi {{name}},\n\nI wanted to make sure this did not get lost. If timing has changed, that is useful context too." },
      { id: "cta", type: "button", text: "Choose a time", url: `${siteUrl()}/contact` },
    ],
  },
];

const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#039;");
const interpolate = (value: string, variables: Record<string, string>) => value.replace(/\{\{([A-Za-z0-9_]+)\}\}/g, (_, key: string) => variables[key] ?? `{{${key}}}`);

export function createEmailBlock(type: EmailBlockType, id = `${type}-${crypto.randomUUID()}`): EmailBlock {
  switch (type) {
    case "heading": return { id, type, text: "New heading" };
    case "paragraph": return { id, type, text: "Write the message your reader needs." };
    case "button": return { id, type, text: "Book a call", url: `${siteUrl()}/contact` };
    case "divider": return { id, type };
    case "spacer": return { id, type, height: 24 };
  }
}

export function validateEmailBlocks(value: unknown): EmailBlock[] | null {
  if (!Array.isArray(value) || value.length > 80) return null;
  const seen = new Set<string>();
  const valid = value.every((block) => {
    if (!block || typeof block !== "object") return false;
    const candidate = block as Partial<EmailBlock>;
    if (typeof candidate.id !== "string" || !candidate.id || seen.has(candidate.id)) return false;
    seen.add(candidate.id);
    if (!EMAIL_BLOCK_TYPES.some((entry) => entry.type === candidate.type)) return false;
    if (candidate.type === "heading" || candidate.type === "paragraph") return typeof candidate.text === "string" && candidate.text.length <= 4_000;
    if (candidate.type === "button") return typeof candidate.text === "string" && candidate.text.length <= 200 && typeof candidate.url === "string" && /^https?:\/\//.test(candidate.url);
    return candidate.type === "divider" || (candidate.type === "spacer" && typeof candidate.height === "number" && candidate.height >= 8 && candidate.height <= 96);
  });
  return valid ? value as EmailBlock[] : null;
}

const STORAGE_PREFIX = "__accelerate_email_blocks_v1__:";

export function serializeEmailBlocks(blocks: EmailBlock[]) {
  return `${STORAGE_PREFIX}${JSON.stringify(blocks)}`;
}

export function parseStoredEmailBlocks(value: string | null | undefined): EmailBlock[] | null {
  if (!value?.startsWith(STORAGE_PREFIX)) return null;
  try { return validateEmailBlocks(JSON.parse(value.slice(STORAGE_PREFIX.length))); }
  catch { return null; }
}

export function blocksFromPlainText(text: string): EmailBlock[] {
  return text.split(/\n{2,}/).map((paragraphText, index) => ({
    id: `imported-${index + 1}`,
    type: "paragraph" as const,
    text: paragraphText,
  })).filter((block) => block.text.trim());
}

export function emailBlocksToText(blocks: EmailBlock[], variables: Record<string, string>) {
  return blocks.flatMap((block) => {
    if (block.type === "heading" || block.type === "paragraph") return [interpolate(block.text, variables)];
    if (block.type === "button") return [`${interpolate(block.text, variables)}: ${interpolate(block.url, variables)}`];
    return [];
  }).filter(Boolean).join("\n\n");
}

type MailyNode = { type: string; attrs?: Record<string, unknown>; content?: MailyNode[]; text?: string };
const paragraph = (text: string): MailyNode => ({ type: "paragraph", content: text ? [{ type: "text", text }] : [] });

function emailDocument(blocks: EmailBlock[], variables: Record<string, string>) {
  const content: MailyNode[] = [
    { type: "heading", attrs: { level: 3, textAlign: "left" }, content: [{ type: "text", text: tenant.brand.name }] },
    { type: "horizontalRule" },
  ];
  for (const block of blocks) {
    if (block.type === "heading") content.push({ type: "heading", attrs: { level: 1, textAlign: "left" }, content: [{ type: "text", text: interpolate(block.text, variables) }] });
    if (block.type === "paragraph") interpolate(block.text, variables).split(/\n{2,}/).forEach((text) => content.push(paragraph(text.replace(/\n/g, " "))));
    if (block.type === "button") content.push({ type: "button", attrs: { text: interpolate(block.text, variables), url: interpolate(block.url, variables), alignment: "left", buttonColor: "#1b211e", textColor: "#c8ef58", borderRadius: "smooth" } });
    if (block.type === "divider") content.push({ type: "horizontalRule" });
    if (block.type === "spacer") content.push({ type: "spacer", attrs: { height: block.height } });
  }
  content.push({ type: "horizontalRule" }, paragraph(`${tenant.brand.name} · ${tenant.brand.domain}`));
  return { type: "doc", content };
}

/** The production preview/test/send compiler. Maily renders email-client-safe
 * HTML; fallback remains a complete safe document for temporary renderer faults. */
export async function renderEmailBlocks(blocks: EmailBlock[], variables: Record<string, string>, previewText?: string) {
  const text = emailBlocksToText(blocks, variables);
  try {
    const html = await render(emailDocument(blocks, variables) as never, { preview: previewText || undefined } as never);
    return { html, text };
  } catch {
    const body = blocks.map((block) => {
      if (block.type === "heading") return `<h1 style="margin:0 0 16px;font-size:28px;line-height:1.2;color:#151611">${escapeHtml(interpolate(block.text, variables))}</h1>`;
      if (block.type === "paragraph") return `<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#3f4744">${escapeHtml(interpolate(block.text, variables)).replace(/\n/g, "<br>")}</p>`;
      if (block.type === "button") return `<p style="margin:24px 0"><a href="${escapeHtml(interpolate(block.url, variables))}" style="display:inline-block;border-radius:8px;background:#1b211e;padding:14px 18px;color:#c8ef58;font-weight:700;text-decoration:none">${escapeHtml(interpolate(block.text, variables))} →</a></p>`;
      if (block.type === "divider") return `<hr style="border:0;border-top:1px solid #dfe5df;margin:24px 0">`;
      return `<div style="height:${block.height}px"></div>`;
    }).join("");
    return { text, html: `<!doctype html><html><body style="margin:0;background:#eef1ee;font-family:Arial,sans-serif"><main style="max-width:600px;margin:32px auto;padding:32px;background:#fff;border-radius:16px">${body}</main></body></html>` };
  }
}
