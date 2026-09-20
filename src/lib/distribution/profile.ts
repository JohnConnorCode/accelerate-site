/** The complete application defaults to a neutral fork. Agency content is opt-in. */
export type DistributionProfile = "branded" | "neutral";

export function distributionProfile(
  env: Record<string, string | undefined> = {
    NEXT_PUBLIC_DISTRIBUTION_PROFILE: process.env.NEXT_PUBLIC_DISTRIBUTION_PROFILE,
  },
): DistributionProfile {
  const value = env.NEXT_PUBLIC_DISTRIBUTION_PROFILE?.trim();
  if (!value || value === "neutral") return "neutral";
  if (value === "branded") return "branded";
  throw new Error(
    'NEXT_PUBLIC_DISTRIBUTION_PROFILE must be "branded" or "neutral". Unset starts a neutral installation.',
  );
}
