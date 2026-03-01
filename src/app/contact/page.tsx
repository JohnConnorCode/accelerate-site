import { seoMetadata } from "@/lib/og";
import { ContactPageContent } from "@/components/sections/ContactPage";

export const metadata = seoMetadata({
  title: "Contact",
  description:
    "Get in touch with Accelerate. Book a free consultation or send us a message about your business growth goals.",
  ogTitle: "Contact Us",
  ogSubtitle: "Book a free consultation about your business growth goals",
});

export default function ContactPage() {
  return <ContactPageContent />;
}
