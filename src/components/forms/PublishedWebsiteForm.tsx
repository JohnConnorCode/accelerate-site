import { readPublicForm } from "@/lib/revenue-os/form-builder";
import { ACCELERATE_TENANT_ID } from "@/lib/tenancy/constants";
import { PublicFormView } from "./PublicFormView";

export async function PublishedWebsiteForm({ token }: { token: string }) {
  try {
    const form = await readPublicForm(token);
    if (form?.tenantId === ACCELERATE_TENANT_ID)
      return <PublicFormView token={token} schema={form.schema} />;
  } catch {
    // Preserve the page, without exposing database details or claiming success.
  }
  return <p role="status">This form is currently unavailable. Please try again later.</p>;
}
