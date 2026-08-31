import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { TrackingScripts } from "@/components/layout/TrackingScripts";
import { UTMCapture } from "@/components/layout/UTMCapture";
import { RevenueAnalyticsTracker } from "@/components/layout/RevenueAnalyticsTracker";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { ScrollProgress } from "@/components/layout/ScrollProgress";
import { PageTransition } from "@/components/layout/PageTransition";
import { Dock } from "@/components/home/Dock";

export function MarketingChrome({ children }: { children: React.ReactNode }) {
  return (
    <>
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
    </>
  );
}
