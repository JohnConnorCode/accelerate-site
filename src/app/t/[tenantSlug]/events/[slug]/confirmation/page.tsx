import { TicketConfirmation } from "@/components/events/TicketConfirmation";
export const metadata = {
  title: "Workshop registration",
  robots: { index: false, follow: false },
  referrer: "no-referrer" as const,
};
export default async function ConfirmationPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string; slug: string }>;
  searchParams: Promise<{ order?: string; key?: string }>;
}) {
  const { tenantSlug, slug } = await params;
  const query = await searchParams;
  return (
    <TicketConfirmation
      tenantSlug={tenantSlug}
      slug={slug}
      orderId={query.order || ""}
      orderKey={query.key || ""}
    />
  );
}
