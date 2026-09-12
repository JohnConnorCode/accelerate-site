import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";

/** @typedef {{version: 1, transport: "https", envFile: string} | {version: 1, transport: "local-operator", project: string, envFile: string, capabilities?: string[]}} AgentProfile */

/** One private configuration resolver for pickup, lifecycle commands and diagnostics. */
export function loadAgentConfiguration(
  { root, common },
  env = process.env,
  loadEnv = (file) => process.loadEnvFile(file),
) {
  const localEnv = resolve(root, ".env.agent.local");
  if (existsSync(localEnv)) loadEnv(localEnv);
  const preferred = resolve(common, env.ACCELERATE_AGENT_PROFILE_PATH ?? "work-board-agent.json");
  const operator = resolve(common, "work-board-operator.json");
  const selected =
    env.ACCELERATE_AGENT_NO_PROFILE === "1"
      ? null
      : existsSync(preferred)
        ? preferred
        : existsSync(operator)
          ? operator
          : null;
  /** @type {AgentProfile | null} */
  let profile = null;
  if (selected) {
    let value;
    try {
      value = JSON.parse(readFileSync(selected, "utf8"));
    } catch {
      throw new Error("The configured private agent profile is not valid JSON.");
    }
    if (
      !value ||
      Object.keys(value).some(
        (key) =>
          !(
            value.transport === "local-operator"
              ? ["version", "transport", "envFile", "project", "capabilities"]
              : ["version", "transport", "envFile"]
          ).includes(key),
      ) ||
      value.version !== 1 ||
      typeof value.envFile !== "string" ||
      !isAbsolute(value.envFile) ||
      !["https", "local-operator"].includes(value.transport) ||
      (value.transport === "local-operator" &&
        (typeof value.project !== "string" || !/^[a-z0-9-]{1,80}$/.test(value.project))) ||
      (value.capabilities !== undefined &&
        (!Array.isArray(value.capabilities) ||
          value.capabilities.length > 50 ||
          value.capabilities.some((c) => typeof c !== "string" || !/^[a-z0-9-]{1,80}$/.test(c))))
    )
      throw new Error("The configured private agent profile has an unsupported shape.");
    profile = value;
    if (!existsSync(value.envFile))
      throw new Error("The private agent profile references a missing environment file.");
    loadEnv(value.envFile);
  }
  return profile;
}

/** A lifecycle command must return to the transport that created its claim. */
export function assertClaimTransport(session, transport) {
  if (session.endpoint !== transport)
    throw new Error(
      "Claim session belongs to another transport; use its original configured board and project.",
    );
}
