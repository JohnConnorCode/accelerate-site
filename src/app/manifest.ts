import { tenant } from "@/config/tenant";
import { distributionProfile } from "@/lib/distribution/profile";
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  if (distributionProfile() === "neutral")
    return {
      name: tenant.brand.name,
      short_name: tenant.brand.name,
      description: tenant.brand.tagline,
      start_url: "/",
      display: "browser",
    };
  return {
    name: "Accelerate: AI Strategy & Systems for Small Business",
    short_name: "Accelerate",
    description:
      "We help small businesses figure out where AI fits, then build and manage the systems that make it happen.",
    start_url: "/",
    // "browser" (not "standalone") so this stays a normal website — no PWA
    // "install / download app" prompt, which doesn't belong on a marketing site.
    display: "browser",
    // Paper (#FBFBFA) matches the default light viewport themeColor in
    // layout.tsx — the old near-black (#0a0a0a) predated the editorial system.
    background_color: "#FBFBFA",
    theme_color: "#FBFBFA",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "48x48",
        type: "image/x-icon",
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
      {
        // Generated route from src/app/apple-icon.tsx (Next serves
        // generated apple-icons at /apple-icon, not /apple-icon.png).
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
