import "server-only";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { readPublicWebsite } from "./website-public";
import { WebsitePageContent, WebsiteArticle } from "./website-renderer";
import { renderNativeWebsiteSection } from "./native-renderer";
import type { WebsiteDocument } from "./website-document";

export function findWebsiteContent(document: WebsiteDocument, path: string) {
  return (
    document.pages.find((page) => page.path === path) ??
    document.collections
      .flatMap((collection) => collection.entries)
      .find((entry) => entry.path === path)
  );
}
export async function publishedWebsiteMetadata(path: string): Promise<Metadata | null> {
  const website = await readPublicWebsite();
  if (website.mode !== "published") return null;
  const item = findWebsiteContent(website.document, path);
  if (!item) return null;
  const image = website.document.assets.find(
    (asset) => asset.id === item.metadata.imageAssetId,
  )?.src;
  return {
    title: item.metadata.title,
    description: item.metadata.description,
    alternates: { canonical: path },
    robots: { index: !item.metadata.noIndex, follow: true },
    openGraph: {
      title: item.metadata.title,
      description: item.metadata.description,
      url: path,
      ...(image ? { images: [image] } : {}),
    },
  };
}
export async function PublishedWebsitePage({ path }: { path: string }) {
  const website = await readPublicWebsite();
  if (website.mode === "unavailable")
    throw new Error("The published website is temporarily unavailable.");
  if (website.mode !== "published") notFound();
  const item = findWebsiteContent(website.document, path);
  if (!item) notFound();
  if ("content" in item)
    return (
      <WebsitePageContent
        page={item}
        assets={website.document.assets}
        renderNative={renderNativeWebsiteSection}
      />
    );
  return (
    <article className="mx-auto max-w-3xl px-6 py-24">
      <h1 className="mb-6 text-4xl font-semibold">{item.title}</h1>
      <p className="mb-8">{item.summary}</p>
      <WebsiteArticle body={item.body} assets={website.document.assets} />
    </article>
  );
}

/** Existing route modules keep their bundled rendering until a published page
 * explicitly owns that path. A private draft never overrides a public route. */
export async function publishedWebsiteOverride(path: string) {
  const website = await readPublicWebsite();
  if (website.mode === "published" && findWebsiteContent(website.document, path))
    return <PublishedWebsitePage path={path} />;
  return null;
}
