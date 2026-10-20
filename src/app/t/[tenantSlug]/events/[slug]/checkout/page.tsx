import { TicketPayment } from "@/components/events/TicketPayment";
export const metadata = {
  title: "Workshop payment",
  robots: { index: false, follow: false },
  referrer: "no-referrer" as const,
};
export default async function PaymentPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string; slug: string }>;
  searchParams: Promise<{ order?: string; key?: string }>;
}) {
  const { tenantSlug, slug } = await params;
  const query = await searchParams;
  return (
    <main>
      <TicketPayment
        tenantSlug={tenantSlug}
        slug={slug}
        orderId={query.order || ""}
        orderKey={query.key || ""}
      />
    </main>
  );
}
