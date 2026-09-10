import { readPublicWebsite } from "@/lib/site-studio/website-public";
import { notFound } from "next/navigation";
import { MarketingChrome } from "@/components/layout/MarketingChrome";

export default async function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const website = await readPublicWebsite();
  if (website.mode === "unpublished") notFound();
  if (website.mode === "unavailable")
    throw new Error("The published website is temporarily unavailable.");
  return (
    <MarketingChrome website={website.mode === "published" ? website.document : undefined}>
      {children}
    </MarketingChrome>
  );
}
