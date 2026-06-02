import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/admin/", "/plan/", "/proposal/", "/legacy-home", "/style-guide"],
      },
      {
        userAgent: "GPTBot",
        allow: ["/learn/", "/services", "/packages", "/industries/", "/about"],
      },
      {
        userAgent: "Claude-Web",
        allow: ["/learn/", "/services", "/packages", "/industries/", "/about"],
      },
      {
        userAgent: "PerplexityBot",
        allow: ["/learn/", "/services", "/packages", "/industries/", "/about"],
      },
      {
        userAgent: "GoogleOther",
        allow: ["/learn/", "/services", "/packages", "/industries/", "/about"],
      },
      {
        userAgent: "Applebot-Extended",
        allow: ["/learn/", "/services", "/packages", "/industries/", "/about"],
      },
      {
        userAgent: "ClaudeBot",
        allow: ["/learn/", "/services", "/packages", "/industries/", "/about"],
      },
    ],
    sitemap: "https://acceleratewith.us/sitemap.xml",
    host: "https://acceleratewith.us",
  };
}
