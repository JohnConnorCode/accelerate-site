import { websiteThemeStyle } from "@/lib/site-studio/website-theme";
import type { WebsiteDocument } from "@/lib/site-studio/website-document";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { TrackingScripts } from "@/components/layout/TrackingScripts";
import { UTMCapture } from "@/components/layout/UTMCapture";
import { RevenueAnalyticsTracker } from "@/components/layout/RevenueAnalyticsTracker";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { ScrollProgress } from "@/components/layout/ScrollProgress";
import { PageTransition } from "@/components/layout/PageTransition";
import { Dock } from "@/components/home/Dock";

export function MarketingChrome({
  children,
  website,
}: {
  children: React.ReactNode;
  website?: WebsiteDocument;
}) {
  const logoSrc = website?.assets.find((asset) => asset.id === website.identity.logoAssetId)?.src;
  const style = website ? websiteThemeStyle(website.theme) : undefined;
  return (
    <div className="min-h-screen" style={style}>
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
      <Header
        content={website?.header}
        navLinks={website?.navigation}
        brandName={website?.identity.name}
        logoSrc={logoSrc}
      />
      <main id="main-content" className="flex-1">
        <PageTransition>{children}</PageTransition>
      </main>
      <Footer content={website?.footer} brandName={website?.identity.name} logoSrc={logoSrc} />
      <ChatWidget />
      <Dock content={website?.dock} />
    </div>
  );
}
