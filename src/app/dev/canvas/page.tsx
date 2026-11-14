import "../../admin-chrome.css";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { CanvasDeskPreview } from "@/components/canvas/CanvasDeskPreview";

export default function CanvasPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <Suspense>
      <CanvasDeskPreview />
    </Suspense>
  );
}
