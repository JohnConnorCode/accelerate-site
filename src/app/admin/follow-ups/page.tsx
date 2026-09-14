import { redirect } from "next/navigation";
import { headers } from "next/headers";

/** Stable compatibility URL for the owner-facing Sales → Follow-ups entry. */
export default async function FollowUpsRedirect() {
  const scenario = (await headers()).get("x-accelerate-demo-scenario");
  redirect(scenario ? `/demo/command-center/${scenario}/recovery` : "/admin/recovery");
}
