import type { Metadata } from "next";
import { PublicFormView } from "@/components/forms/PublicFormView";
import type { StoredFormSchema } from "@/lib/revenue-os/form-builder";

type PublicFormPayload = { name: string; description: string; schema: StoredFormSchema };

async function fetchForm(token: string): Promise<PublicFormPayload | null> {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "https://www.acceleratewith.us";
  try {
    const response = await fetch(`${baseUrl}/api/public/forms/${encodeURIComponent(token)}`, {
      cache: "no-store",
    });
    if (!response.ok) return null;
    return (await response.json()) as PublicFormPayload;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const form = await fetchForm(token);
  return {
    title: form ? `${form.name}` : "Form not found",
    description: form?.description || "Share your details through this form.",
    robots: { index: false, follow: false },
  };
}

export default async function PublicFormPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const form = await fetchForm(token);
  if (!form) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Form not found</h1>
          <p className="mt-2 text-sm text-[var(--admin-muted)]">
            This link may have been unpublished or removed.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="mx-auto min-h-screen max-w-2xl px-6 py-12">
      <p className="text-xs uppercase tracking-wider text-[var(--admin-muted)]">Share your details</p>
      <h1 className="mt-2 text-3xl font-bold">{form.name}</h1>
      {form.description && <p className="mt-2 text-sm text-[var(--admin-muted)]">{form.description}</p>}
      <main className="mt-8">
        <PublicFormView token={token} schema={form.schema} />
      </main>
    </div>
  );
}
