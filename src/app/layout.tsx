import type { Metadata, Viewport } from "next";
import { Inter, Jost } from "next/font/google";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import { TrackingScripts } from "@/components/layout/TrackingScripts";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { ScrollProgressBar } from "@/components/ui/ScrollProgressBar";
import { generateWebSiteJsonLd } from "@/lib/seo";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jost = Jost({
  variable: "--font-jost",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0a0a0a",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://acceleratewith.us"),
  title: {
    default: "Accelerate | AI Strategy & Systems for Small Business",
    template: "%s | Accelerate",
  },
  description:
    "We help small businesses figure out where AI fits, then build and manage the systems that make it happen. Strategy, automation, and ongoing management.",
  applicationName: "Accelerate",
  authors: [{ name: "Accelerate", url: "https://acceleratewith.us" }],
  creator: "Accelerate",
  publisher: "Accelerate",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://acceleratewith.us",
    siteName: "Accelerate",
    title: "Accelerate | AI Strategy & Systems for Small Business",
    description:
      "We help small businesses figure out where AI fits, then build and manage the systems that make it happen. Strategy, automation, and ongoing management.",
  },
  twitter: {
    card: "summary_large_image",
    site: "@accelerateAIops",
    creator: "@accelerateAIops",
    title: "Accelerate | AI Strategy & Systems for Small Business",
    description:
      "We help small businesses figure out where AI fits, then build and manage the systems that make it happen.",
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
  "@id": "https://acceleratewith.us/#organization",
  name: "Accelerate",
  url: "https://acceleratewith.us",
  logo: {
    "@type": "ImageObject",
    url: "https://acceleratewith.us/logo.png",
    width: 512,
    height: 512,
  },
  description:
    "AI strategy and systems for small businesses. We figure out where AI fits, then build and manage the systems that make it happen.",
  founder: {
    "@type": "Person",
    name: "John Connor",
  },
  email: "john@acceleratewith.us",
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "sales",
    email: "john@acceleratewith.us",
    url: "https://acceleratewith.us/contact",
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
  sameAs: [
    "https://www.linkedin.com/company/accelerate-ai-ops",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jost.variable}`} suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(generateWebSiteJsonLd()) }}
        />
        <script
          defer
          data-domain={process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN || "acceleratewith.us"}
          src="https://plausible.io/js/script.tagged-events.js"
        />
      </head>
      <body className="noise-overlay min-h-screen flex flex-col">
        <ThemeProvider>
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-gold-gradient focus:text-black focus:font-semibold focus:text-sm"
          >
            Skip to main content
          </a>
          <TrackingScripts />
          <ScrollProgressBar />
          <Header />
          <main id="main-content" className="flex-1">{children}</main>
          <Footer />
          <ChatWidget />
        </ThemeProvider>
      </body>
    </html>
  );
}
