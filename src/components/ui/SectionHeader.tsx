import { cn } from "@/lib/utils";
import { SignalMark } from "@/components/ui/SignalMark";

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
  return (
    <div className={cn(align === "center" && "text-center", className)}>
      {label && (
        <p className="section-label flex items-center gap-2.5 justify-start" style={align === "center" ? { justifyContent: "center" } : undefined}>
          <SignalMark size="sm" />
          <span>{label}</span>
          <SignalMark size="sm" />
        </p>
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
        <p className={cn("section-description", align === "center" && "mx-auto")}>
          {description}
        </p>
      )}
    </div>
  );
}
