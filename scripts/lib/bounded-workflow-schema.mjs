/** The host accepts a deliberately small JSON Schema subset with linear work.
 * Regexes, remote refs, recursive refs and arbitrary formats never reach AJV. */
export function validateBoundedWorkflowSchema(schema) {
  let nodes = 0;
  function visit(node, depth = 0) {
    if (++nodes > 200 || depth > 8 || !node || typeof node !== "object" || Array.isArray(node))
      throw new Error("Workflow schema exceeds structural bounds");
    const keys = new Set([
      "type",
      "description",
      "enum",
      "properties",
      "required",
      "additionalProperties",
      "items",
      "minItems",
      "maxItems",
      "minLength",
      "maxLength",
      "minimum",
      "maximum",
    ]);
    if (Object.keys(node).some((key) => !keys.has(key)))
      throw new Error("Unsupported workflow schema keyword");
    if (node.enum) {
      if (
        Object.keys(node).some((key) => !["enum", "description", "type"].includes(key)) ||
        !Array.isArray(node.enum) ||
        !node.enum.length ||
        node.enum.length > 30 ||
        node.enum.some((value) => typeof value !== "string" || value.length > 100)
      )
        throw new Error("Bounded string enum required");
      return;
    }
    if (node.type === "object") {
      if (
        node.additionalProperties !== false ||
        !node.properties ||
        Object.keys(node.properties).length > 30
      )
        throw new Error("Closed workflow object required");
      for (const [key, value] of Object.entries(node.properties)) {
        if (!/^[a-zA-Z][a-zA-Z0-9]{0,63}$/.test(key)) throw new Error("Invalid input field");
        visit(value, depth + 1);
      }
    } else if (node.type === "array") {
      if (!Number.isInteger(node.maxItems) || node.maxItems < 1 || node.maxItems > 100)
        throw new Error("Bounded array required");
      visit(node.items, depth + 1);
    } else if (node.type === "string") {
      if (!Number.isInteger(node.maxLength) || node.maxLength < 1 || node.maxLength > 2000)
        throw new Error("Bounded string required");
    } else if (node.type === "number" || node.type === "integer") {
      if (
        !Number.isFinite(node.minimum) ||
        !Number.isFinite(node.maximum) ||
        node.minimum > node.maximum
      )
        throw new Error("Bounded number required");
    } else if (node.type !== "boolean") throw new Error("Unsupported workflow type");
  }
  visit(schema);
}
