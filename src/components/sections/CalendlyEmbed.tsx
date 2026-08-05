"use client";

import Script from "next/script";

const CALENDLY_URL = "https://calendly.com/john-superdebate/30min";

export function CalendlyEmbed() {
  return (
    <>
      <div
        className="calendly-inline-widget rounded-2xl border border-border-glass"
        data-url={`${CALENDLY_URL}?hide_gdpr_banner=1`}
        style={{ minWidth: "280px", height: "700px" }}
      />
      <Script src="https://assets.calendly.com/assets/external/widget.js" strategy="afterInteractive" />
    </>
  );
}
