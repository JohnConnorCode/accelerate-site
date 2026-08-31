import { permanentRedirect } from "next/navigation";

// Results became Selected Work. Preserve the useful legacy entrypoint.
export default function ResultsPage() {
  permanentRedirect("/work");
}
