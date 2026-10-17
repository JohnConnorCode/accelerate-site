import { distributionProfile } from "@/lib/distribution/profile";
import { readPublicWebsite } from "@/lib/site-studio/website-public";
import { notFound } from "next/navigation";
import { MarketingChrome } from "@/components/layout/MarketingChrome";
import { createNeutralWebsite } from "@/lib/site-studio/neutral-website";
import { loadPublicTicketEvent } from "@/lib/revenue-os/event-ticketing";
import { WORKSHOP_EVENT_ID } from "@/content/workshops";
import { ACCELERATE_TENANT_SLUG } from "@/lib/tenancy/constants";
import { eventPath } from "@/lib/revenue-os/event-ticketing-contract";

// Public pages are prerendered and revalidated on this window. The publish
// write path invalidates them immediately; this is only the fallback.
export const revalidate = 60;

export default async function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const website = await readPublicWebsite();
  if (distributionProfile() === "neutral" && website.mode !== "published")
    return <MarketingChrome website={createNeutralWebsite()}>{children}</MarketingChrome>;
  if (website.mode === "unpublished") notFound();
  if (website.mode === "unavailable")
    throw new Error("The published website is temporarily unavailable.");
  const workshop =
    website.mode === "bootstrap" && distributionProfile() === "branded"
      ? await loadPublicTicketEvent(ACCELERATE_TENANT_SLUG, {
          eventId: WORKSHOP_EVENT_ID,
        }).catch(() => null)
      : null;
  return (
    <MarketingChrome
      website={website.mode === "published" ? website.document : undefined}
      workshopHref={workshop ? eventPath(ACCELERATE_TENANT_SLUG, workshop.slug) : undefined}
    >
      {children}
    </MarketingChrome>
  );
}
