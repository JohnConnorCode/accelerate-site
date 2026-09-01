/** A layout override is a bounded reorder/hide instruction over a fixed,
    code-defined set of ids — never a place to store new ids, markup, or
    styling. `applyLayoutOverride` is the single implementation of that
    merge, shared by every scope (nav, page regions, future scopes) so the
    reorder/hide/required-id rules exist exactly once. */
export interface LayoutDoc {
  order: string[];
  hidden: string[];
}

export function applyLayoutOverride<T extends { id: string }>(
  items: T[],
  requiredIds: string[],
  doc: LayoutDoc | null | undefined,
): T[] {
  if (!doc) return items;

  const byId = new Map(items.map((item) => [item.id, item]));
  const required = new Set(requiredIds);
  const hidden = new Set(doc.hidden.filter((id) => byId.has(id) && !required.has(id)));

  const orderedIds = doc.order.filter((id) => byId.has(id));
  const seen = new Set(orderedIds);
  for (const item of items) {
    if (!seen.has(item.id)) {
      orderedIds.push(item.id);
      seen.add(item.id);
    }
  }

  return orderedIds.filter((id) => !hidden.has(id)).map((id) => byId.get(id)!);
}
