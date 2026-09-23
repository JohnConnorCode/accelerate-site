import { tenant } from "@/config/tenant";
import { distributionProfile } from "@/lib/distribution/profile";
import { commandCenterOrigin, isCommandCenterHost } from "@/lib/command-center/runtime";
import { headers } from "next/headers";
import type { MetadataRoute } from "next";

export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  if (commandCenterOrigin && isCommandCenterHost((await headers()).get("host") || "")) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  if (distributionProfile() === "neutral")
    return {
      rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/admin/", "/demo/"] },
      host: tenant.brand.siteUrl,
      sitemap: `${tenant.brand.siteUrl}/sitemap.xml`,
    };
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/admin/",
          "/demo/",
          "/plan/",
          "/proposal/",
          "/packages",
          "/legacy-home",
          "/style-guide",
        ],
      },
      {
        userAgent: "GPTBot",
        allow: [
          "/learn/",
          "/docs/",
          "/services",
          "/industries/",
          "/command-center",
          "/ai-readiness",
          "/work",
          "/about",
        ],
        disallow: "/packages",
      },
      {
        userAgent: "Claude-Web",
        allow: [
          "/learn/",
          "/docs/",
          "/services",
          "/industries/",
          "/command-center",
          "/ai-readiness",
          "/work",
          "/about",
        ],
        disallow: "/packages",
      },
      {
        userAgent: "PerplexityBot",
        allow: [
          "/learn/",
          "/docs/",
          "/services",
          "/industries/",
          "/command-center",
          "/ai-readiness",
          "/work",
          "/about",
        ],
        disallow: "/packages",
      },
      {
        userAgent: "GoogleOther",
        allow: [
          "/learn/",
          "/docs/",
          "/services",
          "/industries/",
          "/command-center",
          "/ai-readiness",
          "/work",
          "/about",
        ],
        disallow: "/packages",
      },
      {
        userAgent: "Applebot-Extended",
        allow: [
          "/learn/",
          "/docs/",
          "/services",
          "/industries/",
          "/command-center",
          "/ai-readiness",
          "/work",
          "/about",
        ],
        disallow: "/packages",
      },
      {
        userAgent: "ClaudeBot",
        allow: [
          "/learn/",
          "/docs/",
          "/services",
          "/industries/",
          "/command-center",
          "/ai-readiness",
          "/work",
          "/about",
        ],
        disallow: "/packages",
      },
    ],
    sitemap: "https://www.acceleratewith.us/sitemap.xml",
    host: "https://www.acceleratewith.us",
  };
}
