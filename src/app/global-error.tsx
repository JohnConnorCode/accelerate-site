"use client";

import Link from "next/link";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#FBFBFA",
          color: "#0B0B0B",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div style={{ textAlign: "center", maxWidth: 420, padding: "0 1rem" }}>
          <p
            style={{
              fontSize: "3.5rem",
              fontWeight: 700,
              color: "#0B0B0B",
              marginBottom: "1rem",
            }}
          >
            Oops
          </p>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.75rem" }}>
            Something Went Wrong
          </h1>
          <p style={{ color: "rgba(11,11,11,0.6)", marginBottom: "2rem" }}>
            An unexpected error occurred. Please try again or return to the home page.
          </p>
          <div
            style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}
          >
            <button
              onClick={reset}
              style={{
                padding: "0.75rem 1.5rem",
                borderRadius: 0,
                border: "none",
                background: "#0B0B0B",
                color: "#FBFBFA",
                fontWeight: 600,
                fontSize: "0.875rem",
                cursor: "pointer",
              }}
            >
              Try Again
            </button>
            <Link
              href="/"
              style={{
                padding: "0.75rem 1.5rem",
                borderRadius: 0,
                border: "1px solid rgba(11,11,11,0.2)",
                background: "transparent",
                color: "#0B0B0B",
                fontWeight: 600,
                fontSize: "0.875rem",
                textDecoration: "none",
                cursor: "pointer",
              }}
            >
              Go Home
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
