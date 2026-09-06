/** Trusted settings contracts: generated forms and shared mutation validation. */
import {
  RADAR_PROFILE_FIELDS,
  radarProfileSchema,
  radarProfileReadiness,
} from "./radar-profile-contract";
export function pluginSettingsContract(id: string) {
  if (id !== "opportunity-radar-profile-v1")
    throw new Error(`Unknown plugin settings contract: ${id}`);
  return {
    fields: RADAR_PROFILE_FIELDS,
    schema: radarProfileSchema,
    readiness: radarProfileReadiness,
  };
}
