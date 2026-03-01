import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/admin/"],
      },
      {
        userAgent: "GPTBot",
        allow: ["/learn/", "/services", "/industries/"],
      },
      {
        userAgent: "Claude-Web",
        allow: ["/learn/", "/services", "/industries/"],
      },
      {
        userAgent: "PerplexityBot",
        allow: ["/learn/", "/services", "/industries/"],
      },
    ],
    sitemap: "https://acceleratewith.us/sitemap.xml",
  };
}
