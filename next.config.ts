import type { NextConfig } from "next";
import createMDX from "@next/mdx";

const rawDeploymentId = process.env.NEXT_DEPLOYMENT_ID
  || process.env.VERCEL_GIT_COMMIT_SHA;
// Vercel custom deployment IDs for prebuilt output are user-managed values:
// they cannot use Vercel's reserved `dpl_` prefix and are capped at 32 chars.
const deploymentId = rawDeploymentId?.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32);

const nextConfig: NextConfig = {
  // Next's built-in version-skew protection. Long-lived tabs send this id with
  // App Router requests; a mismatched deployment triggers a hard navigation
  // instead of combining stale route payloads/assets with the current release.
  deploymentId: deploymentId || undefined,

  experimental: {
    // Next 16 auto-enables the runtime deployment-id override inside Vercel's
    // builder. That replaces the documented custom prebuilt id with Vercel's
    // reserved dpl_ id at runtime and produces two bootstrap identities. Keep
    // the build-time custom id serialized into the server output instead.
    runtimeServerDeploymentId: false,
  },

  // Ensure clean URLs without trailing slashes
  trailingSlash: false,

  // Support MDX pages
  pageExtensions: ["ts", "tsx", "md", "mdx"],

  // Image optimization
  images: {
    formats: ["image/avif", "image/webp"],
  },

  // Server external packages that should not be bundled
  serverExternalPackages: ["@react-pdf/renderer"],

  // Plausible analytics proxy (bypasses ad blockers)
  async rewrites() {
    return [
      {
        source: "/js/script.js",
        destination: "https://plausible.io/js/script.tagged-events.js",
      },
      {
        source: "/api/event",
        destination: "https://plausible.io/api/event",
      },
    ];
  },

  // Security headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy-Report-Only",
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://connect.facebook.net https://assets.calendly.com; style-src 'self' 'unsafe-inline' https://assets.calendly.com; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://www.google-analytics.com https://*.supabase.co https://calendly.com https://*.calendly.com; frame-src 'self' https://calendly.com https://*.calendly.com https://www.youtube-nocookie.com",
          },
        ],
      },
    ];
  },
};

const withMDX = createMDX({
  options: {
    remarkPlugins: ["remark-gfm"],
    rehypePlugins: [
      "rehype-slug",
      ["rehype-autolink-headings", { behavior: "wrap" }],
    ],
  },
});

export default withMDX(nextConfig);
