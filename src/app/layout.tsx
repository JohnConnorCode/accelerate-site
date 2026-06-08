import type { Metadata, Viewport } from "next";
import { Jost, Hanken_Grotesk, Fraunces, JetBrains_Mono } from "next/font/google";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import { TrackingScripts } from "@/components/layout/TrackingScripts";
import { UTMCapture } from "@/components/layout/UTMCapture";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { MobileCTABar } from "@/components/layout/MobileCTABar";
import { ScrollProgress } from "@/components/v2/studio/ScrollProgress";
import { LenisProvider } from "@/components/v2/living/LenisProvider";
import "./globals.css";

// Distinctive type system (frontend-design skill: avoid Inter/generic).
const sans = Hanken_Grotesk({
  variable: "--font-inter", // keep var name; now points to a refined grotesque
  subsets: ["latin"],
  display: "swap",
});

const display = Jost({
  variable: "--font-jost", // Jost — a geometric Futura revival (per brand direction)
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const editorial = Fraunces({
  variable: "--font-editorial",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
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
  themeColor: "#0a0a0a",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://www.acceleratewith.us"),
  title: {
    default: "Accelerate | Custom AI Solutions, Built & Run for You",
    template: "%s | Accelerate",
  },
  description:
    "Custom business solutions powered by AI, built and run by Accelerate. Book more jobs, sign more clients, reclaim hours. We deliver the results and stand behind them.",
  applicationName: "Accelerate",
  authors: [{ name: "Accelerate", url: "https://www.acceleratewith.us" }],
  creator: "Accelerate",
  publisher: "Accelerate",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://www.acceleratewith.us",
    siteName: "Accelerate",
    title: "Accelerate | Custom AI Solutions, Built & Run for You",
    description:
      "Custom business solutions powered by AI, built and run by Accelerate. Book more jobs, sign more clients, reclaim hours. We deliver the results and stand behind them.",
  },
  twitter: {
    card: "summary_large_image",
    site: "@accelerateAIops",
    creator: "@accelerateAIops",
    title: "Accelerate | Custom AI Solutions, Built & Run for You",
    description:
      "Custom business solutions powered by AI, built and run by Accelerate. Book more jobs, sign more clients, reclaim hours. We deliver the results and stand behind them.",
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
  description:
    "Custom business solutions powered by AI, built and run by Accelerate. Book more jobs, sign more clients, reclaim hours. We deliver the results and stand behind them.",
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
  sameAs: [
    "https://www.linkedin.com/company/acceleratewith/",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable} ${editorial.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        {/* progressive-enhancement flag — section-reveal CSS only hides content
            when JS is actually available, so no-JS users still see everything. */}
        <script
          dangerouslySetInnerHTML={{
            __html: "document.documentElement.dataset.js='on';",
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <script
          defer
          data-domain={process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN || "acceleratewith.us"}
          data-api="/api/event"
          src="/js/script.js"
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
          <UTMCapture />
          {/* site-wide smooth scroll (desktop, non-reduced-motion) so every
              page feels as smooth as the homepage — not just `/` */}
          <LenisProvider />
          <ScrollProgress />
          <Header />
          <main id="main-content" className="flex-1">{children}</main>
          <Footer />
          <ChatWidget />
          <MobileCTABar />
        </ThemeProvider>
      </body>
    </html>
  );
}
