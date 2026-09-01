import { cn } from "@/lib/utils";
import { Info, AlertTriangle, Lightbulb, AlertCircle } from "lucide-react";

const icons = {
  info: Info,
  warning: AlertTriangle,
  tip: Lightbulb,
  important: AlertCircle,
};

const colors = {
  info: "border-l-[var(--fg)]",
  warning: "border-l-[var(--fg)]",
  tip: "border-l-[var(--fg)]",
  important: "border-l-[var(--fg)]",
};

interface CalloutProps {
  type?: keyof typeof icons;
  title?: string;
  children: React.ReactNode;
}

export function Callout({ type = "info", title, children }: CalloutProps) {
  const Icon = icons[type];

  return (
    <div
      className={cn(
        "my-6 border border-[color-mix(in_srgb,var(--fg)_12%,transparent)] border-l-4 p-5",
        colors[type],
      )}
    >
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-5 w-5 shrink-0 text-white-secondary" />
        <div>
          {title && <p className="mb-1 font-display font-semibold text-white-primary">{title}</p>}
          <div className="text-sm text-white-secondary leading-relaxed [&>p]:m-0">{children}</div>
        </div>
      </div>
    </div>
  );
}
