import { PublishedWebsitePage, publishedWebsiteMetadata } from "@/lib/site-studio/website-page";
export const dynamic = "force-dynamic";
type Props = { params: Promise<{ websitePath: string[] }> };
export async function generateMetadata({ params }: Props) {
  return (
    (await publishedWebsiteMetadata("/" + (await params).websitePath.join("/"))) ?? {
      robots: { index: false, follow: false },
    }
  );
}
export default async function WebsitePage({ params }: Props) {
  return <PublishedWebsitePage path={"/" + (await params).websitePath.join("/")} />;
}
