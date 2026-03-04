import { seoMetadata } from "@/lib/og";
import { WebsiteGraderPage } from "@/components/sections/WebsiteGraderPage";

export const metadata = seoMetadata({
  title: "Free Website Grader",
  description:
    "Free instant website analysis. See how your site scores on performance, SEO, mobile, security, and accessibility with actionable tips.",
  ogTitle: "Free Website Grader",
  ogSubtitle: "Instant analysis of your site's performance, SEO, and more",
  path: "/tools/website-grader",
});

export default function WebsiteGraderRoute() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "Website Grader",
            description:
              "Free website analysis tool that grades your site on performance, SEO, mobile-friendliness, security, and accessibility.",
            url: "https://acceleratewith.us/tools/website-grader",
            applicationCategory: "BusinessApplication",
            operatingSystem: "Any",
            offers: {
              "@type": "Offer",
              price: "0",
              priceCurrency: "USD",
            },
            provider: {
              "@id": "https://acceleratewith.us/#organization",
            },
          }),
        }}
      />
      <WebsiteGraderPage />
    </>
  );
}
