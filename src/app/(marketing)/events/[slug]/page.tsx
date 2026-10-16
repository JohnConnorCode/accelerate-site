import { ACCELERATE_TENANT_SLUG } from "@/lib/tenancy/constants";
import { ticketEventMetadata, ticketEventPage } from "@/lib/revenue-os/event-ticketing-page";
export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ preview?: string }> };
export async function generateMetadata({ params, searchParams }: Props) {
  if ((await searchParams).preview === "1")
    return { title: "Workshop preview", robots: { index: false, follow: false } };
  return ticketEventMetadata(ACCELERATE_TENANT_SLUG, (await params).slug);
}
export default async function WorkshopPage({ params, searchParams }: Props) {
  return ticketEventPage(
    ACCELERATE_TENANT_SLUG,
    (await params).slug,
    (await searchParams).preview === "1",
  );
}
