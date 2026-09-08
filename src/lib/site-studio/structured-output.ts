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
