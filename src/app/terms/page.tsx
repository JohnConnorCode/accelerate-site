import { seoMetadata } from "@/lib/og";
import { AnimateOnScroll } from "@/components/ui/AnimateOnScroll";

export const metadata = seoMetadata({
  title: "Terms of Service",
  description:
    "Accelerate terms of service. Review the terms and conditions for using our AI-powered business solutions.",
  path: "/terms",
});

export default function TermsPage() {
  return (
    <div className="py-20 md:py-28">
      <AnimateOnScroll className="max-w-3xl mx-auto px-4 sm:px-6">
        <h1 className="font-display text-3xl md:text-4xl font-bold text-white-primary mb-8">
          Terms of Service
        </h1>

        <div className="prose-invert space-y-6 text-white-secondary text-sm leading-relaxed">
          <p className="text-white-muted text-xs">
            Last updated: February 28, 2026
          </p>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-white-primary">
              1. Acceptance of Terms
            </h2>
            <p>
              By accessing or using the Accelerate website and services, you
              agree to be bound by these terms. If you do not agree, please do
              not use our services.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-white-primary">
              2. Services
            </h2>
            <p>
              Accelerate provides AI-powered websites, business automations, and
              intelligent agents for small businesses. Service details,
              deliverables, and pricing are outlined in individual project
              agreements.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-white-primary">
              3. Free Tools
            </h2>
            <p>
              Our free tools (Website Grader, ROI Calculator, Solution
              Generator) are provided as-is for informational purposes. Results
              are estimates and should not be considered guarantees of actual
              performance.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-white-primary">
              4. Intellectual Property
            </h2>
            <p>
              All content, designs, and code created by Accelerate remain our
              intellectual property until full payment is received. Upon
              completion and payment, clients receive full ownership of their
              deliverables as specified in the project agreement.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-white-primary">
              5. Payment Terms
            </h2>
            <p>
              Payment terms are defined in individual project agreements.
              Monthly recurring services require a valid payment method on file
              and can be cancelled with 30 days written notice.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-white-primary">
              6. Limitation of Liability
            </h2>
            <p>
              Accelerate shall not be liable for any indirect, incidental, or
              consequential damages arising from the use of our services. Our
              total liability shall not exceed the amount paid for the specific
              service in question.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-white-primary">
              7. Modifications
            </h2>
            <p>
              We reserve the right to modify these terms at any time. Changes
              take effect upon posting to this page. Continued use of our
              services constitutes acceptance of modified terms.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-white-primary">
              8. Contact
            </h2>
            <p>
              Questions about these terms? Contact us at{" "}
              <a
                href="mailto:john@acceleratewith.us"
                className="text-gold-light underline underline-offset-2"
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
