import { seoMetadata } from "@/lib/og";
import { generateBreadcrumbJsonLd } from "@/lib/seo";
import { ContactPageContent } from "@/components/sections/ContactPage";

export const metadata = seoMetadata({
  title: "Contact Accelerate: Book a Free AI Consultation",
  description:
    "Get in touch with Accelerate. Book a free consultation or send us a message about your business growth goals.",
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
  url: "https://acceleratewith.us/contact",
  mainEntity: {
    "@id": "https://acceleratewith.us/#organization",
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
