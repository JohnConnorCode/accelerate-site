import { tenant } from "@/config/tenant";
import { distributionProfile } from "@/lib/distribution/profile";
import { isCommandCenterHost } from "@/lib/command-center/runtime";
import { headers } from "next/headers";
import type { MetadataRoute } from "next";

export const dynamic = "force-dynamic";

const marketingIcons: MetadataRoute.Manifest["icons"] = [
  { src: "/favicon.ico", sizes: "48x48", type: "image/x-icon" },
  { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
  { src: "/apple-icon", sizes: "180x180", type: "image/png" },
];

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const host = (await headers()).get("host") || "";
  if (isCommandCenterHost(host) && process.env.NEXT_PUBLIC_COMMAND_CENTER_ORIGIN) {
    return {
      id: "/workspace",
      name: "Accelerate Command Center",
      short_name: "Command Center",
      description: "Your governed Accelerate workspace for seeing what matters and acting safely.",
      start_url: "/workspace",
      scope: "/",
      display: "standalone",
      display_override: ["window-controls-overlay", "standalone", "browser"],
      background_color: "#0B0B0B",
      theme_color: "#0B0B0B",
      categories: ["business", "productivity"],
      icons: [
        { src: "/command-center-icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "/command-center-icon-512.png", sizes: "512x512", type: "image/png" },
        {
          src: "/command-center-icon-512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "maskable",
        },
        { src: "/apple-icon", sizes: "180x180", type: "image/png" },
      ],
      shortcuts: [
        { name: "Today", short_name: "Today", url: "/workspace" },
        { name: "Inbox", short_name: "Inbox", url: "/admin/inbox" },
        { name: "Tasks", short_name: "Tasks", url: "/admin/work" },
        { name: "Search", short_name: "Search", url: "/admin/today?open=search" },
      ],
    };
  }

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
    icons: marketingIcons,
  };
}
