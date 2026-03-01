import { seoMetadata } from "@/lib/og";
import { AboutPageContent } from "@/components/sections/AboutPage";

export const metadata = seoMetadata({
  title: "About",
  description:
    "Meet the team behind Accelerate. Over a decade of building technology platforms, now helping small businesses grow with AI-powered tools.",
  ogTitle: "About Accelerate",
  ogSubtitle: "Over a decade of building technology platforms for small businesses",
});

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Accelerate",
  url: "https://acceleratewith.us",
  description:
    "AI-powered websites, automations, and intelligent agents that help small businesses capture more leads and save time.",
  founder: {
    "@type": "Person",
    name: "John Connor",
  },
};

export default function AboutPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(organizationJsonLd),
        }}
      />
      <AboutPageContent />
    </>
  );
}
