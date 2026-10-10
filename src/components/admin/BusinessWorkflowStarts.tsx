import Link from "./AdminLink";
import { AdminSurface } from "./AdminSurface";
import { businessAreas } from "@/content/command-center-business";

const destinations = {
  "customer-context": "/admin/contacts",
  sales: "/admin/pipeline",
  delivery: "/admin/clients",
  billing: "/admin/invoicing",
  marketing: "/admin/site",
  "custom-apps": "/admin/ai",
};

export function BusinessWorkflowStarts({ compact = false }: { compact?: boolean }) {
  const content = (
    <div
      className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
      aria-label="Business workflow starting points"
    >
      {businessAreas.map((area) => (
        <AdminSurface key={area.id} padding="md">
          <h3 className="text-sm font-semibold">{area.title}</h3>
          <p className="admin-copy mt-2 text-sm">{area.tasks[0]?.detail ?? area.description}</p>
          <div className="mt-3 flex flex-wrap gap-4">
            <Link
              href={destinations[area.id]}
              className="inline-flex min-h-10 items-center text-xs font-semibold underline underline-offset-4"
            >
              Open workspace
            </Link>
            <Link
              href={area.guideHref}
              className="inline-flex min-h-10 items-center text-xs underline underline-offset-4"
            >
              Guide and setup
            </Link>
          </div>
        </AdminSurface>
      ))}
    </div>
  );
  return compact ? (
    <details className="rounded-xl bg-[var(--admin-surface)] p-4 shadow-[var(--admin-shadow-border)]">
      <summary className="min-h-10 cursor-pointer py-2 font-medium">
        Start a business workflow
      </summary>
      <div className="mt-3">{content}</div>
    </details>
  ) : (
    content
  );
}
