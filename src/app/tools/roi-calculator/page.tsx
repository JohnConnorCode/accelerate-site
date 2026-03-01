import { seoMetadata } from "@/lib/og";
import { ROICalculatorPage } from "@/components/sections/ROICalculatorPage";

export const metadata = seoMetadata({
  title: "ROI Calculator",
  description:
    "See how much revenue AI-powered automation could add to your business. Enter your numbers and get a projected ROI instantly.",
  ogTitle: "ROI Calculator",
  ogSubtitle: "See how much revenue AI automation could add to your business",
});

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "ROI Calculator",
  description:
    "Calculate your projected return on investment from AI-powered business automation. See estimated revenue gains, time savings, and payback period.",
  url: "https://acceleratewith.us/tools/roi-calculator",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Any",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  provider: {
    "@type": "Organization",
    name: "Accelerate",
    url: "https://acceleratewith.us",
  },
};

export default function ROICalculatorRoute() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ROICalculatorPage />
    </>
  );
}
