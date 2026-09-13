import { CustomerAuthPage } from "@/components/billing/CustomerAuthPage";

export const metadata = { title: "Reset password" };

export default function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string; next?: string }>;
}) {
  return <CustomerAuthPage mode="forgot" searchParams={searchParams} />;
}
