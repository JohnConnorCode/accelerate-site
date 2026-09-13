/** Layout describes the work, independently of its theme or business data. */
export type AdminPageComposition = "overview" | "collection" | "board" | "workspace" | "settings";
const compositions: Record<string, AdminPageComposition> = {
  today: "overview",
  analytics: "overview",
  revenue: "overview",
  recovery: "overview",
  pipeline: "board",
  features: "board",
  content: "board",
  work: "board",
  ai: "workspace",
  conversations: "workspace",
  radar: "workspace",
  collections: "workspace",
  "contact-imports": "workspace",
  "identity-review": "workspace",
  blueprints: "workspace",
  settings: "settings",
  branding: "settings",
  setup: "settings",
  integrations: "settings",
  plugins: "settings",
  tenants: "settings",
  site: "settings",
  invoicing: "settings",
  "client-onboarding": "settings",
  "email-sequences": "settings",
};
export function adminPageComposition(path: string): AdminPageComposition {
  const parts = path.split("?")[0]!.split("/").filter(Boolean);
  const adminIndex = parts.indexOf("admin");
  const route = adminIndex >= 0 ? parts.slice(adminIndex + 1) : parts.slice(3);
  if (route.length > 1 && route[0] !== "site") return "workspace";
  return compositions[route[0] ?? "today"] ?? "collection";
}
