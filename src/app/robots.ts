import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/admin/", "/plan/", "/proposal/"],
      },
      {
        userAgent: "GPTBot",
        allow: ["/learn/", "/services", "/packages", "/industries/", "/about", "/results/"],
      },
      {
        userAgent: "Claude-Web",
        allow: ["/learn/", "/services", "/packages", "/industries/", "/about", "/results/"],
      },
      {
        userAgent: "PerplexityBot",
        allow: ["/learn/", "/services", "/packages", "/industries/", "/about", "/results/"],
      },
      {
        userAgent: "GoogleOther",
        allow: ["/learn/", "/services", "/packages", "/industries/", "/about", "/results/"],
      },
      {
        userAgent: "Applebot-Extended",
        allow: ["/learn/", "/services", "/packages", "/industries/", "/about", "/results/"],
      },
      {
        userAgent: "ClaudeBot",
        allow: ["/learn/", "/services", "/packages", "/industries/", "/about", "/results/"],
      },
    ],
    sitemap: "https://acceleratewith.us/sitemap.xml",
    host: "https://acceleratewith.us",
  };
}
