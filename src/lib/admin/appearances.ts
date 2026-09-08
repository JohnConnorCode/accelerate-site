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
export function isAdminAppearance(value: unknown): value is AdminAppearance {
  return typeof value === "string" && (ids.has(value) || value === "workspace");
}
