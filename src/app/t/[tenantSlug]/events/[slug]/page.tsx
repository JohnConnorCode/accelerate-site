import { ticketEventMetadata, ticketEventPage } from "@/lib/revenue-os/event-ticketing-page";
export const dynamic = "force-dynamic";
type Props = {
  params: Promise<{ tenantSlug: string; slug: string }>;
  searchParams: Promise<{ preview?: string }>;
};
export async function generateMetadata({ params, searchParams }: Props) {
  if ((await searchParams).preview === "1")
    return { title: "Workshop preview", robots: { index: false, follow: false } };
  const { tenantSlug, slug } = await params;
  return ticketEventMetadata(tenantSlug, slug);
}
export default async function WorkshopPage({ params, searchParams }: Props) {
  const { tenantSlug, slug } = await params;
  return (
    <main>{await ticketEventPage(tenantSlug, slug, (await searchParams).preview === "1")}</main>
  );
}
