import { CustomerAuthPage } from "@/components/billing/CustomerAuthPage";

export const metadata = { title: "Choose a new password" };

export default function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string; next?: string }>;
}) {
  return <CustomerAuthPage mode="reset" searchParams={searchParams} />;
}
