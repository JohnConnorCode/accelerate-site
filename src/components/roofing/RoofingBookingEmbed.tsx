"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CALENDLY_URL } from "@/lib/booking";
import { getUTMParams } from "@/lib/utm";
import { trackConversion } from "@/lib/analytics";

export function RoofingBookingEmbed({ email, token }: { email: string; token: string }) {
  const reported = useRef(false);
  const [loaded, setLoaded] = useState(false);
  const src = useMemo(() => {
    const params = new URLSearchParams({
      hide_gdpr_banner: "1",
      embed_domain: "acceleratewith.us",
      embed_type: "Inline",
      email,
    });
    const attribution = getUTMParams();
    if (attribution?.utm_source) params.set("utm_source", attribution.utm_source);
    if (attribution?.utm_medium) params.set("utm_medium", attribution.utm_medium);
    if (attribution?.utm_campaign) params.set("utm_campaign", attribution.utm_campaign);
    if (attribution?.utm_content) params.set("utm_content", attribution.utm_content);
    return `${CALENDLY_URL}?${params.toString()}`;
  }, [email]);

  useEffect(() => {
    if (reported.current) return;
    reported.current = true;
    trackConversion("calendar_viewed", { funnel: "roofing" });
    fetch("/api/qualify/calendar-viewed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
      keepalive: true,
    }).catch(() => undefined);
  }, [token]);

  return (
    <div className="relative min-h-[690px] overflow-hidden rounded-[18px] bg-[#f8f8f6] shadow-[0_0_0_1px_rgba(255,255,255,0.1),0_24px_70px_rgba(0,0,0,0.28)]">
      <iframe
        src={src}
        title="Book your free Roofing Revenue Leak Audit"
        className="h-[690px] w-full border-0"
        onLoad={() => setLoaded(true)}
      />
      <div
        aria-hidden={loaded}
        className={`pointer-events-none absolute inset-0 grid place-items-center bg-[#10110f] transition-[opacity,filter] duration-500 ${loaded ? "opacity-0 blur-[4px]" : "opacity-100 blur-0"}`}
      >
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="size-7 animate-spin rounded-full border-2 border-white/15 border-t-[#d7ff5f]" />
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/55">
            Loading available times
          </span>
        </div>
      </div>
    </div>
  );
}
