import themes from "./themes.json";

/** Add a definition once: the renderer, picker and QA discover it here. */
export interface AdminAppearanceDef {
  id: string;
  label: string;
  description: string;
}
export const ADMIN_APPEARANCES = themes;
export type AdminAppearance = string;
const ids = new Set(themes.map((theme) => theme.id));

/** Retired built-ins resolve to their closest current mode, so a stored
 *  preference keeps working without a storage migration. */
export const RETIRED_APPEARANCES: Record<string, AdminAppearance> = {
  signal: "operator",
  studio: "light",
  frost: "light",
  material: "accelerate",
  mac: "light",
  capy: "accelerate",
};

/** next-themes attribute map. It must name every current id too: an unmapped
 *  theme would otherwise render with no data-theme attribute at all. */
export const APPEARANCE_ATTRIBUTE_VALUES: Record<string, string> = {
  ...Object.fromEntries([...ids, "workspace"].map((id) => [id, id])),
  ...RETIRED_APPEARANCES,
};

export function canonicalAppearance(value: unknown): unknown {
  return typeof value === "string" ? (RETIRED_APPEARANCES[value] ?? value) : value;
}

export function isAdminAppearance(value: unknown): value is AdminAppearance {
  return typeof value === "string" && (ids.has(value) || value === "workspace");
}
