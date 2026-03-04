import { seoMetadata } from "@/lib/og";
import { AnimateOnScroll } from "@/components/ui/AnimateOnScroll";

export const metadata = seoMetadata({
  title: "Privacy Policy",
  description:
    "Accelerate privacy policy. Learn how we collect, use, and protect your personal information.",
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <div className="py-20 md:py-28">
      <AnimateOnScroll className="max-w-3xl mx-auto px-4 sm:px-6">
        <h1 className="font-display text-3xl md:text-4xl font-bold text-[var(--white-primary)] mb-8">
          Privacy Policy
        </h1>

        <div className="prose-invert space-y-6 text-[var(--white-secondary)] text-sm leading-relaxed">
          <p className="text-[var(--white-muted)] text-xs">
            Last updated: February 28, 2026
          </p>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-[var(--white-primary)]">
              1. Information We Collect
            </h2>
            <p>
              We collect information you voluntarily provide when you use our
              services, including your name, email address, phone number,
              business information, and website URL. We also collect usage data
              through cookies and analytics tools when you visit our website.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-[var(--white-primary)]">
              2. How We Use Your Information
            </h2>
            <p>We use your information to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Provide and improve our services</li>
              <li>Generate personalized digital growth plans</li>
              <li>Send email communications you have opted into</li>
              <li>Analyze website usage to improve user experience</li>
              <li>Respond to your inquiries and support requests</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-[var(--white-primary)]">
              3. Data Sharing
            </h2>
            <p>
              We do not sell your personal information. We may share data with
              trusted third-party service providers (such as email delivery and
              analytics services) solely to operate our business. All
              third-party providers are contractually obligated to protect your
              data.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-[var(--white-primary)]">
              4. Cookies
            </h2>
            <p>
              We use essential cookies to operate our website and optional
              analytics and marketing cookies with your consent. You can manage
              your cookie preferences at any time through the cookie consent
              banner.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-[var(--white-primary)]">
              5. Data Security
            </h2>
            <p>
              We implement industry-standard security measures to protect your
              information, including encrypted data transmission (TLS/SSL),
              secure database storage, and access controls. However, no method
              of transmission over the internet is 100% secure.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-[var(--white-primary)]">
              6. Your Rights
            </h2>
            <p>
              You have the right to access, correct, or delete your personal
              information. To exercise these rights, contact us at{" "}
              <a
                href="mailto:john@acceleratewith.us"
                className="text-[var(--gold-light)] hover:underline"
              >
                john@acceleratewith.us
              </a>
              .
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-[var(--white-primary)]">
              7. Contact Us
            </h2>
            <p>
              If you have questions about this privacy policy, please contact us
              at{" "}
              <a
                href="mailto:john@acceleratewith.us"
                className="text-[var(--gold-light)] hover:underline"
              >
                john@acceleratewith.us
              </a>
              .
            </p>
          </section>
        </div>
      </AnimateOnScroll>
    </div>
  );
}
