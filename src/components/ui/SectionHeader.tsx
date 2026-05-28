import { cn } from "@/lib/utils";
import { Eyebrow } from "@/components/v2/studio/primitives";

interface SectionHeaderProps {
  label?: string;
  heading: React.ReactNode;
  description?: string;
  className?: string;
  align?: "center" | "left";
  size?: "default" | "large";
}

export function SectionHeader({
  label,
  heading,
  description,
  className,
  align = "center",
  size = "default",
}: SectionHeaderProps) {
  const centered = align === "center";
  return (
    <div className={cn(centered && "text-center", className)}>
      {label && (
        // Wrapper handles alignment; Eyebrow is inline-flex internally.
        // Renders "[ LABEL ]" via the v2 Eyebrow primitive so inner pages
        // share the same eyebrow recipe as the homepage sections.
        <div className={cn("mb-4", centered ? "flex justify-center" : "")}>
          <Eyebrow>{label}</Eyebrow>
        </div>
      )}
      <h2
        className={cn(
          "mb-4",
          size === "large" ? "page-heading" : "section-heading"
        )}
      >
        {heading}
      </h2>
      {description && (
        <p className={cn("section-description", centered && "mx-auto")}>
          {description}
        </p>
      )}
    </div>
  );
}
