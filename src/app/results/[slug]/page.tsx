import { redirect } from "next/navigation";

// Results / case-study detail pages removed. Redirect every slug (incl. the
// links still embedded in blog articles, e.g. /results/<slug>) to the
// homepage so nothing 404s.
export default function CaseStudyPage() {
  redirect("/");
}
