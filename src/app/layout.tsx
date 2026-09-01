import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Jost, Inter, Newsreader, JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import { NavigationRuntime } from "@/components/navigation/NavigationRuntime";
import { MotionRuntime } from "@/components/motion/MotionRuntime";
import { marketingPositioning } from "@/content/marketing-positioning";
import "./globals.css";

// High-contrast editorial type system: Inter Tight (display), Inter (body),
// JetBrains Mono (labels/utility), Newsreader italic (serif accent).
const sans = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

const display = Jost({
  variable: "--font-jost", // keep var name — @theme inline maps --font-display to it
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const editorial = Newsreader({
  variable: "--font-editorial",
  subsets: ["latin"],
  weight: ["200", "300", "500"],
  style: ["italic"],
  display: "swap",
});

const mono = JetBrains_Mono({
  variable: "--font-mono-face",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#FBFBFA",
};

const defaultSocialImage =
  "/api/og?eyebrow=AI-ENABLED%20OPERATIONS&title=Build%20the%20right%20system%20for%20the%20business.&description=AI%20strategy%2C%20custom%20systems%2C%20and%20execution%20built%20around%20how%20the%20business%20actually%20works.";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.acceleratewith.us"),
  title: {
    default: "Accelerate | Custom AI Strategy, Solutions & Execution",
    template: "%s | Accelerate",
  },
  description: marketingPositioning.shortOffer,
  applicationName: "Accelerate",
  authors: [{ name: "Accelerate", url: "https://www.acceleratewith.us" }],
  creator: "Accelerate",
  publisher: "Accelerate",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://www.acceleratewith.us",
    siteName: "Accelerate",
    title: "Accelerate | Custom AI Strategy, Solutions & Execution",
    description: marketingPositioning.shortOffer,
    images: [
      {
        url: defaultSocialImage,
        width: 1200,
        height: 630,
        alt: "Accelerate builds AI-enabled operating systems around how the business actually works",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@accelerateAIops",
    creator: "@accelerateAIops",
    title: "Accelerate | Custom AI Strategy, Solutions & Execution",
    description: marketingPositioning.shortOffer,
    images: [defaultSocialImage],
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GSC_VERIFICATION || undefined,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": "https://www.acceleratewith.us/#organization",
  name: "Accelerate",
  url: "https://www.acceleratewith.us",
  logo: {
    "@type": "ImageObject",
    url: "https://www.acceleratewith.us/logo.png",
    width: 512,
    height: 512,
  },
  description: marketingPositioning.coreOffer,
  founder: {
    "@type": "Person",
    name: "John Connor",
  },
  email: "john@acceleratewith.us",
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "sales",
    email: "john@acceleratewith.us",
    url: "https://www.acceleratewith.us/contact",
  },
  areaServed: {
    "@type": "Country",
    name: "United States",
  },
  knowsAbout: [
    "Artificial Intelligence",
    "AI Strategy",
    "Workflow Automation",
    "Sales Automation",
    "Customer Engagement",
    "Content Creation",
    "Business Intelligence",
    "Small Business Operations",
  ],
  sameAs: ["https://www.linkedin.com/company/acceleratewith/"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${display.variable} ${editorial.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `document.documentElement.classList.add("motion-ready");setTimeout(function(){if(!document.documentElement.hasAttribute("data-motion-hydrated")){document.documentElement.classList.remove("motion-ready")}},4000);`,
          }}
        />
        <Script id="org-jsonld" type="application/ld+json" strategy="beforeInteractive">
          {JSON.stringify(organizationJsonLd)}
        </Script>
      </head>
      <body className="noise-overlay min-h-screen flex flex-col">
        <NavigationRuntime>
          <MotionRuntime />
          <ThemeProvider>{children}</ThemeProvider>
        </NavigationRuntime>
      </body>
    </html>
  );
}
