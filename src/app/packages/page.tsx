import { seoMetadata } from "@/lib/og";
import { PackagesPageContent } from "@/components/sections/PackagesPage";
import { packages } from "@/content/packages";

export const metadata = seoMetadata({
  title: "Packages",
  description:
    "Transparent pricing for AI-powered websites, automations, and intelligent agents. Choose from Launch, Grow, or Accelerate packages to fit your business goals and budget.",
  ogTitle: "Packages & Pricing",
  ogSubtitle: "Transparent pricing for AI-powered business solutions",
});

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "Accelerate Service Packages",
  description:
    "AI-powered website and automation packages for small businesses.",
  url: "https://acceleratewith.us/packages",
  numberOfItems: packages.length,
  itemListElement: packages.map((pkg, index) => ({
    "@type": "ListItem",
    position: index + 1,
    item: {
      "@type": "Product",
      name: `${pkg.name} Package`,
      description: pkg.description,
      url: `https://acceleratewith.us/packages#${pkg.slug}`,
      offers: {
        "@type": "AggregateOffer",
        priceCurrency: "USD",
        lowPrice: pkg.priceOneTime,
        ...(pkg.priceMonthly > 0
          ? { highPrice: pkg.priceOneTime + pkg.priceMonthly * 12 }
          : {}),
        offerCount: 1,
        offers: [
          {
            "@type": "Offer",
            name: "Setup Fee",
            price: pkg.priceOneTime,
            priceCurrency: "USD",
            priceSpecification: {
              "@type": "UnitPriceSpecification",
              price: pkg.priceOneTime,
              priceCurrency: "USD",
              unitText: "one-time",
            },
          },
          ...(pkg.priceMonthly > 0
            ? [
                {
                  "@type": "Offer",
                  name: "Monthly Service",
                  price: pkg.priceMonthly,
                  priceCurrency: "USD",
                  priceSpecification: {
                    "@type": "UnitPriceSpecification",
                    price: pkg.priceMonthly,
                    priceCurrency: "USD",
                    unitText: "month",
                    referenceQuantity: {
                      "@type": "QuantitativeValue",
                      value: 1,
                      unitCode: "MON",
                    },
                  },
                },
              ]
            : []),
        ],
      },
      brand: {
        "@type": "Organization",
        name: "Accelerate",
        url: "https://acceleratewith.us",
      },
    },
  })),
};

export default function PackagesPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PackagesPageContent />
    </>
  );
}
