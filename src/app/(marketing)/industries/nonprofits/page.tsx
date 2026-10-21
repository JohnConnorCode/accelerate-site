import { publishedWebsiteOverride, publishedWebsiteMetadata } from "@/lib/site-studio/website-page";
import { PageEngagementTracker } from "@/components/layout/PageEngagementTracker";
import { seoMetadata } from "@/lib/og";
import { verticals } from "@/content/verticals";
import { industryActivity } from "@/content/industry-activity";
import { ActivityStream } from "@/components/ui/ActivityStream";
import { IndustryPilot } from "@/components/sections/IndustryPilot";
import { NonprofitLanding } from "@/components/sections/NonprofitLanding";
import { generateVerticalJsonLd, generateBreadcrumbJsonLd } from "@/lib/seo";

const vertical = verticals.find((v) => v.slug === "nonprofits")!;

const bundledMetadata = seoMetadata({
  title: "AI for Nonprofits",
  description: vertical.shortDescription,
  ogTitle: "AI for Nonprofits",
  ogSubtitle: "Practical workflows for nonprofit operations",
  path: "/industries/nonprofits",
});

const breadcrumbJsonLd = generateBreadcrumbJsonLd([
  { name: "Home", url: "/" },
  { name: "Industries", url: "/industries" },
  { name: "Nonprofits", url: "/industries/nonprofits" },
]);

export default async function NonprofitsPage() {
  const published = await publishedWebsiteOverride("/industries/nonprofits");
  if (published) return published;
  const activity = industryActivity[vertical.slug];
  if (!activity) throw new Error(`Missing industry activity for ${vertical.slug}`);
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(generateVerticalJsonLd(vertical)),
        }}
      />
      <NonprofitLanding
        activitySection={
          <section className="py-12 lg:py-16" aria-label="Illustrative nonprofit workflow">
            <div className="wrap">
              <div className="mx-auto max-w-3xl">
                <ActivityStream {...activity} />
              </div>
            </div>
          </section>
        }
        pilotSection={<IndustryPilot pilot={vertical.pilot} />}
      />
      <PageEngagementTracker />
    </>
  );
}

export async function generateMetadata() {
  return (await publishedWebsiteMetadata("/industries/nonprofits")) ?? bundledMetadata;
}
