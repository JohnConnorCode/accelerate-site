import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { CookieConsent } from "@/components/layout/CookieConsent";
import { TrackingScripts } from "@/components/layout/TrackingScripts";
import { ChatWidget } from "@/components/chat/ChatWidget";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://acceleratewith.us"),
  title: {
    default: "Accelerate | AI Solutions for Small Business",
    template: "%s | Accelerate",
  },
  description:
    "AI-powered websites, automations, and intelligent agents that help small businesses capture more leads and save time.",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://acceleratewith.us",
    siteName: "Accelerate",
    title: "Accelerate | AI Solutions for Small Business",
    description:
      "AI-powered websites, automations, and intelligent agents that help small businesses capture more leads and save time.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Accelerate | AI Solutions for Small Business",
    description:
      "AI-powered websites, automations, and intelligent agents that help small businesses capture more leads and save time.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <head>
        <script
          defer
          data-domain={process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN || "acceleratewith.us"}
          src="https://plausible.io/js/script.js"
        />
      </head>
      <body className="noise-overlay min-h-screen flex flex-col">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-gold-gradient focus:text-black focus:font-semibold focus:text-sm"
        >
          Skip to main content
        </a>
        <TrackingScripts />
        <Header />
        <main id="main-content" className="flex-1">{children}</main>
        <Footer />
        <CookieConsent />
        <ChatWidget />
      </body>
    </html>
  );
}
