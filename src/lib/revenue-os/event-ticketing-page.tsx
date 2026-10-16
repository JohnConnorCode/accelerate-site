import { cache } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { NextResponse } from "next/server";
import { siteUrl, tenant } from "@/config/tenant";
import { requireAdmin } from "@/lib/admin/auth";
import { ACCELERATE_TENANT_SLUG } from "@/lib/tenancy/constants";
import { distributionProfile } from "@/lib/distribution/profile";
import { loadPublicTicketEvent, readTicketEvent } from "./event-ticketing";
import { eventPath, eventTiming, ticketMoney } from "./event-ticketing-contract";
import { WorkshopContent } from "@/components/events/WorkshopContent";

const loadPublicEvent = cache(loadPublicTicketEvent);
export async function ticketEventMetadata(tenantSlug: string, slug: string): Promise<Metadata> {
  const event = await loadPublicEvent(tenantSlug, slug);
  if (!event) return { title: "Workshop", robots: { index: false, follow: false } };
  const description = `${eventTiming(event).date} at ${event.venue_name}. ${ticketMoney(event.price_cents)} per ticket. ${event.description}`;
  const currentDescription =
    description.length > 160 ? description.slice(0, 157).replace(/\s+\S*$/, "") + "…" : description;
  return {
    title: event.title,
    description: currentDescription,
    alternates: { canonical: `${siteUrl()}${eventPath(tenantSlug, slug)}` },
    openGraph: { title: event.title, description: currentDescription, type: "website" },
  };
}
export async function ticketEventPage(tenantSlug: string, slug: string, preview: boolean) {
  let event = await loadPublicEvent(tenantSlug, slug);
  if (preview) {
    const auth = await requireAdmin();
    if (auth instanceof NextResponse || auth.tenant.slug !== tenantSlug) notFound();
    event = await readTicketEvent(auth.database, slug, true);
  }
  if (!event) notFound();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    description: event.description,
    startDate: event.starts_at,
    endDate: event.ends_at,
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    eventStatus: "https://schema.org/EventScheduled",
    location: { "@type": "Place", name: event.venue_name, address: event.venue_address },
    ...(distributionProfile() === "branded" && tenantSlug === ACCELERATE_TENANT_SLUG
      ? {
          organizer: { "@type": "Organization", name: tenant.brand.name, url: siteUrl() },
          performer: ["John Connor", "Matthew Rolnick"].map((name) => ({
            "@type": "Person",
            name,
          })),
        }
      : {}),
    offers: {
      "@type": "Offer",
      url: `${siteUrl()}${eventPath(tenantSlug, slug)}`,
      price: (event.price_cents / 100).toFixed(2),
      priceCurrency: "USD",
      availability:
        event.status === "published" && (event.available_tickets ?? 0) > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/SoldOut",
    },
  };
  return (
    <>
      {!preview && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
        />
      )}
      <WorkshopContent event={event} tenantSlug={tenantSlug} preview={preview} />
    </>
  );
}
