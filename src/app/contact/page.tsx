import { seoMetadata } from "@/lib/og";
import { generateBreadcrumbJsonLd } from "@/lib/seo";
import { ContactPageContent } from "@/components/sections/ContactPage";

export const metadata = seoMetadata({
  title: "Book a Free AI Strategy Session",
  description:
    "Talk through how your business works and where AI, automation, training, or managed execution could free time or increase revenue.",
  ogTitle: "Contact Us",
  ogSubtitle: "Find the most useful place for AI in your business",
  path: "/contact",
});

const breadcrumbJsonLd = generateBreadcrumbJsonLd([
  { name: "Home", url: "/" },
  { name: "Contact", url: "/contact" },
]);

const contactJsonLd = {
  "@context": "https://schema.org",
  "@type": "ContactPage",
  name: "Contact Accelerate",
  url: "https://www.acceleratewith.us/contact",
  mainEntity: {
    "@id": "https://www.acceleratewith.us/#organization",
  },
};

export default function ContactPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(contactJsonLd) }}
      />
      <ContactPageContent />
    </>
  );
}
