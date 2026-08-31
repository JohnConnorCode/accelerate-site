import { notFound, permanentRedirect } from "next/navigation";

const legacyRedirects: Record<string, string> = {
  sparkblox: "/work/sparkblox",
  "farrell-roofing": "/work",
  "montoya-capital": "/work",
};

export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(legacyRedirects).map((slug) => ({ slug }));
}

export default async function CaseStudyPage({ params }: { params: Promise<{ slug: string }> }) {
  const destination = legacyRedirects[(await params).slug];
  if (!destination) notFound();
  permanentRedirect(destination);
}
