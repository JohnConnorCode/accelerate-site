import "server-only";
import { z } from "zod";

/** Derive provider output from the canonical document schemas. Strict providers
 * require every object property; optional document fields travel as null and
 * are omitted again before canonical validation. */
export function strictSiteOutputSchema(schema: z.ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(schema) as Record<string, unknown>;
  delete json.$schema;
  const visit = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(visit);
    if (!value || typeof value !== "object") return value;
    const node = value as Record<string, unknown>;
    const result = Object.fromEntries(
      Object.entries(node).map(([key, child]) => [key, visit(child)]),
    );
    if (node.type === "object") {
      const properties = (result.properties ?? {}) as Record<string, unknown>;
      const required = new Set((node.required ?? []) as string[]);
      result.properties = Object.fromEntries(
        Object.entries(properties).map(([key, child]) => [
          key,
          required.has(key) ? child : { anyOf: [child, { type: "null" }] },
        ]),
      );
      result.required = Object.keys(properties);
      result.additionalProperties = false;
    }
    return result;
  };
  return visit(json) as Record<string, unknown>;
}

/** Required nulls become missing and still fail canonical validation. Null
 * array members remain null, so this never turns an invalid child into a node. */
export function omitProviderNullFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(omitProviderNullFields);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, item]) => item !== null)
      .map(([key, item]) => [key, omitProviderNullFields(item)]),
  );
}

/** Some current providers cap the number of union/nullable schema parameters.
 * Keep the wire envelope simple; the decoded document still passes the complete
 * canonical schema, grounding and asset checks before it can become a draft. */
export const siteJsonEnvelopeSchema = {
  type: "object",
  properties: { documentJson: { type: "string" } },
  required: ["documentJson"],
  additionalProperties: false,
};
export function siteJsonEnvelopePrompt(system: string): string {
  return `${system}\n\nTransport envelope: return one JSON object with exactly one property, documentJson. Its value must be a JSON-encoded string containing the complete document described above. The inner document, not the envelope, follows the document schema above. Escape the string correctly; do not use Markdown fences.`;
}
export function decodeSiteJsonEnvelope(value: unknown): unknown {
  const envelope = z
    .object({ documentJson: z.string().min(1).max(120000) })
    .strict()
    .parse(value);
  return JSON.parse(envelope.documentJson);
}
