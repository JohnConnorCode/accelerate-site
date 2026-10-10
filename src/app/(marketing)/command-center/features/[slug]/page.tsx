import { notFound } from "next/navigation";
import { businessAreas } from "@/content/command-center-business";
import { BusinessFeaturePage } from "@/components/command-center/BusinessFeaturePage";
import { publishedWebsiteOverride, publishedWebsiteMetadata } from "@/lib/site-studio/website-page";
import { seoMetadata } from "@/lib/og";

type Props = { params: Promise<{ slug: string }> };
export function generateStaticParams() {
  return businessAreas.map((area) => ({ slug: area.id }));
}
export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const area = businessAreas.find((item) => item.id === slug);
  if (!area) notFound();
  const path = `/command-center/features/${area.id}`;
  return (
    (await publishedWebsiteMetadata(path)) ??
    seoMetadata({ title: `${area.title} | Command Center`, description: area.description, path })
  );
}
export default async function FeaturePage({ params }: Props) {
  const { slug } = await params;
  const area = businessAreas.find((item) => item.id === slug);
  if (!area) notFound();
  const published = await publishedWebsiteOverride(`/command-center/features/${area.id}`);
  return published ?? <BusinessFeaturePage area={area} />;
}
