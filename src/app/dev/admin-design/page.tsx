import { notFound } from "next/navigation";
import { AdminDesignPreview } from "@/components/admin/AdminDesignPreview";
export default function AdminDesignPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <AdminDesignPreview />;
}
