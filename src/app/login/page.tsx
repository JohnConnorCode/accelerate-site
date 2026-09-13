import { CustomerAuthPage } from "@/components/billing/CustomerAuthPage";

export const metadata = { title: "Sign in" };

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string; next?: string }>;
}) {
  return <CustomerAuthPage mode="login" searchParams={searchParams} />;
}
