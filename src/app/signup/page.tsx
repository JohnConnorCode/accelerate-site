import { CustomerAuthPage } from "@/components/billing/CustomerAuthPage";

export const metadata = { title: "Create account" };

export default function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string; next?: string }>;
}) {
  return <CustomerAuthPage mode="signup" searchParams={searchParams} />;
}
