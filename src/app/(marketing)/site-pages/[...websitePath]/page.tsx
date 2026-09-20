import { notFound } from "next/navigation";
import { distributionProfile } from "@/lib/distribution/profile";
import { readPublicWebsite } from "@/lib/site-studio/website-public";
import { PublishedWebsitePage, publishedWebsiteMetadata } from "@/lib/site-studio/website-page";
import { WebsitePageContent } from "@/lib/site-studio/website-renderer";
import { createNeutralWebsite } from "@/lib/site-studio/neutral-website";
import { renderNativeWebsiteSection } from "@/lib/site-studio/native-renderer";

type Props = { params: Promise<{ websitePath: string[] }> };
export async function generateMetadata({ params }: Props) {
  const path = `/${(await params).websitePath.join("/")}`;
  return (await publishedWebsiteMetadata(path)) ?? { robots: { index: false, follow: true } };
}

/** Middleware sends disabled agency routes here before their source pages or
 * metadata execute. This route never falls back to agency content. */
export default async function NeutralOwnedPage({ params }: Props) {
  if (distributionProfile() !== "neutral") notFound();
  const path = `/${(await params).websitePath.join("/")}`;
  const website = await readPublicWebsite();
  if (path === "/command-center" && website.mode === "bootstrap") {
    const starter = createNeutralWebsite();
    return (
      <WebsitePageContent
        page={starter.pages[0]!}
        assets={starter.assets}
        renderNative={renderNativeWebsiteSection}
      />
    );
  }
  return <PublishedWebsitePage path={path} />;
}
