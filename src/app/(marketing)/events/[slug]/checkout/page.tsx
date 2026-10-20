import { TicketPayment } from "@/components/events/TicketPayment";
import { ACCELERATE_TENANT_SLUG } from "@/lib/tenancy/constants";
export const metadata = {
  title: "Workshop payment",
  robots: { index: false, follow: false },
  referrer: "no-referrer" as const,
};
export default async function PaymentPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ order?: string; key?: string }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  return (
    <TicketPayment
      tenantSlug={ACCELERATE_TENANT_SLUG}
      slug={slug}
      orderId={query.order || ""}
      orderKey={query.key || ""}
    />
  );
}
