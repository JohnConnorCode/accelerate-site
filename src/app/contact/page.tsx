import { seoMetadata } from "@/lib/og";
import { generateBreadcrumbJsonLd } from "@/lib/seo";
import { ContactPageContent } from "@/components/sections/ContactPage";

export const metadata = seoMetadata({
  title: "Contact Accelerate: Book a Free AI Consultation",
  description:
    "Book 30 minutes with John. You leave with the one constraint costing you the most, in writing, whether you hire us or not.",
  ogTitle: "Contact Us",
  ogSubtitle: "Book a free consultation about your business growth goals",
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
