import { z } from "zod";

export const taskConfigSchema = z.discriminatedUnion("transport", [
  z
    .object({
      version: z.literal(1),
      transport: z.literal("local-operator"),
      project: z.string().regex(/^[a-z0-9-]{1,80}$/),
      envFile: z.string().startsWith("/").min(2),
    })
    .strict(),
  z
    .object({
      version: z.literal(1),
      transport: z.literal("https"),
      envFile: z.string().startsWith("/").min(2),
    })
    .strict(),
]);

export function pageOptions(flags: Record<string, string>) {
  const limit = Number(flags.limit ?? 25),
    offset = Number(flags.offset ?? 0);
  if (
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > 100 ||
    !Number.isSafeInteger(offset) ||
    offset < 0
  )
    throw new Error("Use --limit 1..100 and a nonnegative integer --offset");
  return { limit, offset };
}

type Card = {
  id: string;
  seed_key?: string | null;
  title: string;
  status: string;
  revision?: number;
  readiness?: string[];
  lease_expires_at?: string | null;
  lease_owner?: string | null;
  description?: string | null;
  notes?: string | null;
  acceptance_criteria?: string | null;
  work_spec?: object;
  dependencies?: string[];
};
export function receipt(card: Card, operation?: string) {
  return {
    ...(operation ? { operation } : {}),
    id: card.id,
    key: card.seed_key,
    title: card.title,
    status: card.status,
    revision: card.revision,
    readiness: card.readiness,
    lease: card.lease_expires_at ?? null,
  };
}
export function taskPacket(card: Card) {
  return {
    ...receipt(card),
    objective: card.description,
    notes: card.notes,
    legacyAcceptance: !(card.work_spec as { acceptance?: unknown[] } | undefined)?.acceptance
      ?.length
      ? card.acceptance_criteria
      : undefined,
    owner: card.lease_owner,
    dependencies: card.dependencies ?? [],
    contract: card.work_spec ?? {},
    next:
      card.status === "in_progress"
        ? "Implement remaining acceptance; heartbeat before lease expiry; submit named evidence."
        : card.status === "in_review"
          ? "Await review; implementation is not merged or deployed."
          : "Read readiness before claiming.",
  };
}
export function shellQuote(value: string) {
  return "'" + value.replaceAll("'", "'\\''") + "'";
}

export function recentProgress(
  events: { operation: string; created_at: string; payload?: { message?: string | null } }[],
) {
  return events
    .filter((event) => event.payload?.message)
    .slice(0, 3)
    .map((event) => ({
      operation: event.operation,
      at: event.created_at,
      message: event.payload!.message!.slice(0, 2000),
    }));
}
