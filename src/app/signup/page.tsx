import { Suspense } from "react";
import { CustomerAuthForm } from "@/components/billing/CustomerAuthForm";

export const metadata = { title: "Create account" };

export default function SignupPage() {
  return <main className="min-h-screen bg-[var(--admin-surface)] px-5 py-16"><Suspense fallback={<div className="mx-auto h-96 max-w-md animate-pulse rounded-3xl bg-black/5" />}><CustomerAuthForm mode="signup" /></Suspense></main>;
}
