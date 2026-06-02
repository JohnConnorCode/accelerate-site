import { redirect } from "next/navigation";

// Results page removed. Redirect any traffic (incl. legacy internal/external
// links) to the homepage so nothing 404s.
export default function ResultsPage() {
  redirect("/");
}
