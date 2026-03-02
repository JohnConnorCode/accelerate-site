import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  label?: string;
  heading: React.ReactNode;
  description?: string;
  className?: string;
  align?: "center" | "left";
}

export function SectionHeader({
  label,
  heading,
  description,
  className,
  align = "center",
}: SectionHeaderProps) {
  return (
    <div className={cn(align === "center" && "text-center", className)}>
      {label && <p className="section-label">{label}</p>}
      <h2 className="section-heading mb-4">{heading}</h2>
      {description && (
        <p className={cn("section-description", align === "center" && "mx-auto")}>
          {description}
        </p>
      )}
    </div>
  );
}
