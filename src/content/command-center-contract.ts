/** Shared by branded content and the exported neutral starter. */
export type CapabilityCategory = "capture" | "organize" | "act" | "learn" | "connect" | "govern";
export interface CategoryMeta {
  id: CapabilityCategory;
  label: string;
  blurb: string;
  glyph: string;
  rgb: string;
}
export interface Capability {
  id: string;
  category: CapabilityCategory;
  title: string;
  promise: string;
  detail: string;
  gated?: boolean;
}
export type SurfaceGroupId = "day" | "revenue" | "control";
export interface SurfaceGroup {
  id: SurfaceGroupId;
  label: string;
  blurb: string;
  rgb: string;
}
export interface CurrentSurface {
  n: string;
  group: SurfaceGroupId;
  title: string;
  body: string;
}
