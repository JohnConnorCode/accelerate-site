import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Accelerate: AI Strategy & Systems for Small Business",
    short_name: "Accelerate",
    description:
      "We help small businesses figure out where AI fits, then build and manage the systems that make it happen.",
    start_url: "/",
    // "browser" (not "standalone") so this stays a normal website — no PWA
    // "install / download app" prompt, which doesn't belong on a marketing site.
    display: "browser",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
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
        src: "/apple-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
