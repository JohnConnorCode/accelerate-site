/** Canonical admin appearance registry. This is the single source of truth
 * for every workspace theme id: the picker, session persistence, scenario
 * defaults, the CSS token contract, and browser QA all derive from it.
 *
 * Adding a theme is a checklist, not archaeology (see
 * docs/contributing/ADMIN-THEMES.md):
 * 1. Append one entry here (id, label, description).
 * 2. Add its token block to src/app/globals.css covering every required
 *    theme token (the verifier names anything missing).
 * 3. Extend the QA appearance matrix and capture screenshots.
 *
 * `light` (Paper) is the base scope in CSS and carries no [data-theme]
 * block; every other id must have one. This module has no dependencies so
 * client components, server code, and tests can all import it. */

export interface AdminAppearanceDef {
  /** Stable id. Also the next-themes theme name and the CSS [data-theme] value. */
  id: string;
  /** Operator-facing name shown in the appearance picker. */
  label: string;
  /** One-line character statement shown beside the name. */
  description: string;
}

export const ADMIN_APPEARANCES = [
  { id: "light", label: "Paper", description: "Clear editorial workspace" },
  { id: "dark", label: "Night", description: "Low-light operating view" },
  { id: "signal", label: "Signal", description: "Focused violet operations" },
  { id: "studio", label: "Studio", description: "Bright project workspace" },
  { id: "frost", label: "Frost", description: "Luminous violet workspace" },
] as const satisfies ReadonlyArray<AdminAppearanceDef>;

export type AdminAppearance = (typeof ADMIN_APPEARANCES)[number]["id"];

const ADMIN_APPEARANCE_IDS: ReadonlySet<string> = new Set(
  ADMIN_APPEARANCES.map((appearance) => appearance.id),
);

export function isAdminAppearance(value: unknown): value is AdminAppearance {
  return typeof value === "string" && ADMIN_APPEARANCE_IDS.has(value);
}
