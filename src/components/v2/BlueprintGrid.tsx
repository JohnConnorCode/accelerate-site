import { cn } from "@/lib/utils";

/**
 * Dense, low-opacity "blueprint" grid backdrop (Vercel/Linear lane).
 * Faded with a radial mask so it reads as a systematic substrate, not noise.
 */
export function BlueprintGrid({
  className,
  fade = "center",
}: {
  className?: string;
  fade?: "center" | "top" | "none";
}) {
  const mask =
    fade === "center"
      ? "radial-gradient(circle at 50% 40%, black, transparent 78%)"
      : fade === "top"
      ? "linear-gradient(to bottom, black, transparent 85%)"
      : undefined;

  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0", className)}
      style={{
        backgroundImage:
          "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
        backgroundSize: "26px 26px",
        maskImage: mask,
        WebkitMaskImage: mask,
      }}
    />
  );
}
