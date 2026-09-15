import { FormsWorkspace } from "@/components/admin/FormsWorkspace";
import { PageHeader } from "@/components/admin/PageHeader";

/**
 * Form builder admin surface. Manifest extensions/form-builder.module.json
 * owns the route, nav entry, module toggle, and AI tool claims. All reads
 * and writes go through /api/admin/forms, which gates on the module and
 * delegates to the tenant-bound form-builder domain service.
 */
export default function FormsPage() {
  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Forms"
        subtitle="Build shareable intake forms, publish a link, and review each response before it enters the pipeline."
      />
      <FormsWorkspace />
    </div>
  );
}
