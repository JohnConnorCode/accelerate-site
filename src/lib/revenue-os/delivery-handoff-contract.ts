import { z } from "zod";
export const handoffRequestSchema = z
  .object({
    expectedUpdatedAt: z.iso.datetime({ offset: true }),
    expectedTemplateVersion: z.number().int().positive().optional(),
    templateKey: z.string().trim().min(1).max(80).optional(),
    milestoneKeys: z.array(z.string().trim().min(1).max(80)).min(1).max(50).optional(),
    proposalId: z.uuid().optional(),
    expectedProposalVersion: z.number().int().positive().optional(),
  })
  .strict()
  .refine(
    (x) => Boolean(x.proposalId) === Boolean(x.expectedProposalVersion),
    "A proposal requires its reviewed version",
  );
export const onboardingMilestonesSchema = z
  .array(
    z
      .object({
        key: z
          .string()
          .trim()
          .regex(/^[a-z0-9][a-z0-9_-]{0,79}$/),
        title: z.string().trim().min(1).max(200),
        description: z.string().trim().max(4000).nullable().optional(),
        owner_user_id: z.uuid().nullable().optional(),
        owner: z.string().trim().max(320).nullable().optional(),
        due_offset_days: z.number().int().min(0).max(3650).nullable().optional(),
      })
      .strict(),
  )
  .min(1)
  .max(50)
  .refine(
    (xs) => new Set(xs.map((x) => x.key)).size === xs.length,
    "Milestone keys must be unique",
  );

export const SEED_DEFAULT_MILESTONES: Array<{
  key: string;
  title: string;
  description?: string | null;
  owner?: string | null;
  due_offset_days?: number | null;
}> = [
  {
    key: "kickoff",
    title: "Kickoff call",
    description: "Align on goals, success criteria, and cadence.",
    owner: "founder",
    due_offset_days: 3,
  },
  {
    key: "access",
    title: "Access and assets",
    description: "Collect logins, brand assets, and data sources.",
    owner: "founder",
    due_offset_days: 7,
  },
  {
    key: "first-win",
    title: "First win",
    description: "Deliver the first visible outcome from the proposal scope.",
    owner: "founder",
    due_offset_days: 14,
  },
];
