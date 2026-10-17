import { TicketConfirmation } from "@/components/events/TicketConfirmation";
import { ACCELERATE_TENANT_SLUG } from "@/lib/tenancy/constants";
export const metadata = {
  title: "Workshop registration",
  robots: { index: false, follow: false },
  referrer: "no-referrer" as const,
};
export default async function ConfirmationPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ order?: string; key?: string }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  return (
    <TicketConfirmation
      tenantSlug={ACCELERATE_TENANT_SLUG}
      slug={slug}
      orderId={query.order || ""}
      orderKey={query.key || ""}
    />
  );
}
