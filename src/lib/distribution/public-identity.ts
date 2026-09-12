import type { TenantConfig } from "@/config/tenant";
import { distributionProfile, type DistributionProfile } from "./profile";

export interface PublicIdentity {
  profile: DistributionProfile;
  name: string;
  siteUrl: string;
  metadataBase: URL;
  title: string;
  titleTemplate: string;
  description: string;
  applicationName: string;
  emailFooter: string;
  aiBusinessDescriptor: string;
  aiVoice: string;
}

/** Neutral profile identity comes only from configured tenant facts. */
export function neutralPublicIdentity(tenant: Pick<TenantConfig, "brand" | "ai">): PublicIdentity {
  const siteUrl = tenant.brand.siteUrl.replace(/\/$/, "");
  return {
    profile: "neutral",
    name: tenant.brand.name,
    siteUrl,
    metadataBase: new URL(siteUrl),
    title: tenant.brand.name,
    titleTemplate: `%s | ${tenant.brand.name}`,
    description: tenant.brand.tagline || tenant.ai.positioning,
    applicationName: tenant.brand.name,
    emailFooter: tenant.brand.emailFooter,
    aiBusinessDescriptor: tenant.ai.businessDescriptor,
    aiVoice: tenant.ai.voice,
  };
}

export function resolvedPublicIdentity(
  tenant: Pick<TenantConfig, "brand" | "ai">,
  env: Record<string, string | undefined> = process.env,
): PublicIdentity | { profile: "branded" } {
  const profile = distributionProfile(env);
  if (profile === "branded") return { profile };
  return neutralPublicIdentity(tenant);
}
