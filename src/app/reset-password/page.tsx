import { Suspense } from "react";
import { CustomerAuthForm } from "@/components/billing/CustomerAuthForm";

export const metadata = { title: "Choose a new password" };

export default function ResetPasswordPage() {
  return <main className="min-h-screen bg-[var(--admin-surface)] px-5 py-16"><Suspense fallback={<div className="mx-auto h-96 max-w-md animate-pulse rounded-3xl bg-black/5" />}><CustomerAuthForm mode="reset" /></Suspense></main>;
}
