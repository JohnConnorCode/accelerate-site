import { z } from "zod";
import { isSiteContentHref } from "./links";

const label = z.string().min(1).max(160);
const copy = z.string().max(2000);
const href = z.string().max(1000).refine(isSiteContentHref, "Use a safe website link");
export const websiteLinkSchema = z.object({ label, href }).strict();
export const websiteNavigationItemSchema = z
  .object({
    label,
    href: z.union([href, z.literal("#")]),
    children: z.array(websiteLinkSchema).min(1).max(30).optional(),
  })
  .strict()
  .refine(
    (item) => item.href !== "#" || !!item.children?.length,
    "A navigation group without a destination needs child links",
  );
export const websiteHeaderSchema = z.object({ ctaLabel: label, ctaHref: href }).strict();
export const websiteFooterSchema = z
  .object({
    text: copy,
    links: z.array(websiteLinkSchema).max(60),
    columns: z
      .array(z.object({ heading: label, links: z.array(websiteLinkSchema).max(30) }).strict())
      .max(8)
      .default([]),
    email: z.union([z.email().max(254), z.literal("")]).default(""),
    social: z.array(websiteLinkSchema).max(10).default([]),
    rights: z.string().max(300).default(""),
    newsletter: z
      .object({
        visible: z.boolean(),
        heading: copy,
        description: copy,
        placeholder: label,
        inputLabel: label,
        buttonLabel: label,
        successText: copy,
      })
      .strict()
      .default({
        visible: false,
        heading: "Newsletter",
        description: "",
        placeholder: "you@example.com",
        inputLabel: "Email address",
        buttonLabel: "Subscribe",
        successText: "You’re subscribed!",
      }),
  })
  .strict();
export const websiteDockSchema = z
  .object({ visible: z.boolean(), heading: label, detail: copy, ctaLabel: label, ctaHref: href })
  .strict();
export type WebsiteHeader = z.infer<typeof websiteHeaderSchema>;
export type WebsiteFooter = z.infer<typeof websiteFooterSchema>;
export type WebsiteDock = z.infer<typeof websiteDockSchema>;
export type WebsiteNavigation = z.infer<typeof websiteNavigationItemSchema>[];
