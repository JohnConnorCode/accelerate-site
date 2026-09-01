import { cn } from "@/lib/utils";

/**
 * Intentional image placeholder. Renders a premium-looking frame that shows the
 * DESCRIPTION of the image we actually want there (so it can be AI-generated and
 * dropped in later). The prompt is also stored on `data-image-prompt` + alt.
 *
 * Swap-in later: replace <Placeholder/> with <Image src=... alt={prompt} />.
 */
export function Placeholder({
  label = "image",
  prompt,
  className,
}: {
  label?: string;
  prompt: string;
  className?: string;
}) {
  return (
    <div
      role="img"
      aria-label={prompt}
      data-image-prompt={prompt}
      className={cn(
        "relative flex items-center justify-center overflow-hidden rounded-2xl border border-dashed border-border-gold bg-[var(--bg-elevated)]",
        className,
      )}
    >
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 30% 25%, rgba(var(--accent-rgb),0.2), transparent 70%)",
        }}
      />
      <div className="relative max-w-[82%] text-center">
        <span className="font-mono text-[0.6rem] uppercase tracking-[0.28em] text-gold">
          ◳ {label}
        </span>
        <p className="mt-2 text-xs leading-relaxed text-white-muted">{prompt}</p>
      </div>
    </div>
  );
}
