"use client";

import Script from "next/script";
import { useEffect, useState } from "react";
import { getCookiePreferences } from "@/lib/tracking";

export function TrackingScripts() {
  const [consent, setConsent] = useState<{ analytics: boolean; marketing: boolean }>({
    analytics: false,
    marketing: false,
  });

  useEffect(() => {
    const prefs = getCookiePreferences();
    if (prefs) {
      setConsent({ analytics: prefs.analytics, marketing: prefs.marketing });
    }

    // Re-check when localStorage changes (consent update)
    const handleStorage = () => {
      const updated = getCookiePreferences();
      if (updated) {
        setConsent({ analytics: updated.analytics, marketing: updated.marketing });
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const gtagId = process.env.NEXT_PUBLIC_GTAG_ID;
  const metaPixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;

  return (
    <>
      {/* Google Tag (gtag.js) */}
      {consent.analytics && gtagId && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${gtagId}`}
            strategy="afterInteractive"
          />
          <Script id="gtag-init" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${gtagId}', {
                page_path: window.location.pathname,
              });
            `}
          </Script>
        </>
      )}

      {/* Meta Pixel */}
      {consent.marketing && metaPixelId && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${metaPixelId}');
            fbq('track', 'PageView');
          `}
        </Script>
      )}
    </>
  );
}
