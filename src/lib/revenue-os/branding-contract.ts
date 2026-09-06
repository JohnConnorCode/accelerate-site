import { z } from "zod";
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a six-digit hex color");
const publicUrl = z
  .url()
  .max(2048)
  .refine((value) => {
    if (!URL.canParse(value)) return false;
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  }, "Use a public HTTPS URL without credentials");
/** Shared, non-secret presentation contract. No HTML, CSS, scripts or model-defined fields. */
export const workspaceBrandSchema = z
  .object({
    version: z.literal(1),
    name: z.string().trim().min(1).max(100),
    logoMark: z.string().trim().min(1).max(4),
    logoUrl: z.union([publicUrl, z.literal("")]),
    accentColor: color,
    inkColor: color,
    backgroundColor: color,
    tagline: z.string().trim().max(180),
    legalName: z.string().trim().max(160),
    businessAddress: z.string().trim().max(500),
    supportEmail: z.union([z.email().max(254), z.literal("")]),
    siteUrl: z.union([publicUrl, z.literal("")]),
    font: z.enum(["sans", "serif"]),
  })
  .strict();
export type WorkspaceBrand = z.infer<typeof workspaceBrandSchema>;
export function contrastRatio(first: string, second: string) {
  const luminance = (hex: string) => {
    const rgb = [1, 3, 5]
      .map((start) => parseInt(hex.slice(start, start + 2), 16) / 255)
      .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
    return rgb[0]! * 0.2126 + rgb[1]! * 0.7152 + rgb[2]! * 0.0722;
  };
  const a = luminance(first),
    b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
export function brandButtonInk(accent: string) {
  return contrastRatio(accent, "#ffffff") >= 4.5 ? "#ffffff" : "#000000";
}
export function resolveWorkspaceBrand(
  config: Record<string, unknown>,
  workspaceName: string,
): WorkspaceBrand {
  const raw =
    config.brand && typeof config.brand === "object"
      ? (config.brand as Record<string, unknown>)
      : {};
  const defaults: WorkspaceBrand = {
    version: 1,
    name: workspaceName,
    logoMark: workspaceName.slice(0, 2).toUpperCase() || "B",
    logoUrl: "",
    accentColor: "#3055d3",
    inkColor: "#172033",
    backgroundColor: "#f4f5f7",
    tagline: "",
    legalName: "",
    businessAddress: "",
    supportEmail: "",
    siteUrl: "",
    font: "sans",
  };
  // Legacy tenants may have only the original brand fields. Validate each known
  // field independently so one old setting cannot invalidate their identity.
  for (const key of Object.keys(defaults) as (keyof WorkspaceBrand)[]) {
    const parsed = workspaceBrandSchema.shape[key].safeParse(raw[key]);
    if (parsed.success) Object.assign(defaults, { [key]: parsed.data });
  }
  return defaults;
}
