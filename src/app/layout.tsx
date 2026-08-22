import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Jost, Inter, Newsreader, JetBrains_Mono } from "next/font/google";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import { TrackingScripts } from "@/components/layout/TrackingScripts";
import { UTMCapture } from "@/components/layout/UTMCapture";
import { RevenueAnalyticsTracker } from "@/components/layout/RevenueAnalyticsTracker";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { ScrollProgress } from "@/components/layout/ScrollProgress";
import { PageTransition } from "@/components/layout/PageTransition";
import { Dock } from "@/components/home/Dock";
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

export const metadata: Metadata = {
  metadataBase: new URL("https://www.acceleratewith.us"),
  title: {
    default: "Accelerate | Custom AI Systems, Built and Run for You",
    template: "%s | Accelerate",
  },
  description:
    "Custom business solutions powered by AI, built and run by Accelerate. We take over routine intake, follow-up, and quoting so your team gets its week back.",
  applicationName: "Accelerate",
  authors: [{ name: "Accelerate", url: "https://www.acceleratewith.us" }],
  creator: "Accelerate",
  publisher: "Accelerate",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://www.acceleratewith.us",
    siteName: "Accelerate",
    title: "Accelerate | Custom AI Systems, Built and Run for You",
    description:
      "Custom business solutions powered by AI, built and run by Accelerate. We take over routine intake, follow-up, and quoting so your team gets its week back.",
  },
  twitter: {
    card: "summary_large_image",
    site: "@accelerateAIops",
    creator: "@accelerateAIops",
    title: "Accelerate | Custom AI Systems, Built and Run for You",
    description:
      "Custom business solutions powered by AI, built and run by Accelerate. We take over routine intake, follow-up, and quoting so your team gets its week back.",
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
    "Custom business solutions powered by AI, built and run by Accelerate. We take over routine intake, follow-up, and quoting so your team gets its week back.",
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
            when JS is actually available, so no-JS users still see everything.
            Rendered via next/script (not a raw JSX <script>) so Next injects it
            through its own hydration-safe path instead of a node React must
            diff 1:1 against the DOM — raw <head> scripts get shifted out of
            order by extensions that inject their own <script> tags before
            hydration (e.g. crypto wallet content scripts), which throws a
            hydration-mismatch error that can leave the whole page's scroll-
            reveal animations frozen invisible. */}
        <Script id="js-flag" strategy="beforeInteractive">
          {"document.documentElement.dataset.js='on';"}
        </Script>
        <Script id="org-jsonld" type="application/ld+json" strategy="beforeInteractive">
          {JSON.stringify(organizationJsonLd)}
        </Script>
      </head>
      <body className="noise-overlay min-h-screen flex flex-col">
        <ThemeProvider>
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-[var(--fg)] focus:text-[var(--bg)] focus:font-semibold focus:text-sm"
          >
            Skip to main content
          </a>
          <TrackingScripts />
          <UTMCapture />
          <RevenueAnalyticsTracker />
          <ScrollProgress />
          <Header />
          <main id="main-content" className="flex-1">
            <PageTransition>{children}</PageTransition>
          </main>
          <Footer />
          <ChatWidget />
          <Dock />
        </ThemeProvider>
      </body>
    </html>
  );
}
