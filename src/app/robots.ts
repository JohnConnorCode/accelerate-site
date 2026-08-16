import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/admin/", "/plan/", "/proposal/", "/packages", "/legacy-home", "/style-guide"],
      },
      {
        userAgent: "GPTBot",
        allow: ["/learn/", "/services", "/industries/", "/about"],
        disallow: "/packages",
      },
      {
        userAgent: "Claude-Web",
        allow: ["/learn/", "/services", "/industries/", "/about"],
        disallow: "/packages",
      },
      {
        userAgent: "PerplexityBot",
        allow: ["/learn/", "/services", "/industries/", "/about"],
        disallow: "/packages",
      },
      {
        userAgent: "GoogleOther",
        allow: ["/learn/", "/services", "/industries/", "/about"],
        disallow: "/packages",
      },
      {
        userAgent: "Applebot-Extended",
        allow: ["/learn/", "/services", "/industries/", "/about"],
        disallow: "/packages",
      },
      {
        userAgent: "ClaudeBot",
        allow: ["/learn/", "/services", "/industries/", "/about"],
        disallow: "/packages",
      },
    ],
    sitemap: "https://www.acceleratewith.us/sitemap.xml",
    host: "https://www.acceleratewith.us",
  };
}
