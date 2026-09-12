/** Fork vs original-installation profile. Default branded preserves this deployment. */
export type DistributionProfile = "branded" | "neutral";

export function distributionProfile(
  env: Record<string, string | undefined> = process.env,
): DistributionProfile {
  const value = env.NEXT_PUBLIC_DISTRIBUTION_PROFILE?.trim();
  if (!value || value === "branded") return "branded";
  if (value === "neutral") return "neutral";
  throw new Error(
    'NEXT_PUBLIC_DISTRIBUTION_PROFILE must be "branded" or "neutral". Unset keeps the original branded installation.',
  );
}
