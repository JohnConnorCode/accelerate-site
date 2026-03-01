import { cn } from "@/lib/utils";
import { Info, AlertTriangle, Lightbulb, AlertCircle } from "lucide-react";

const icons = {
  info: Info,
  warning: AlertTriangle,
  tip: Lightbulb,
  important: AlertCircle,
};

const colors = {
  info: "border-l-blue-400",
  warning: "border-l-amber-400",
  tip: "border-l-[var(--gold-base)]",
  important: "border-l-red-400",
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
        "my-6 rounded-lg border-l-4 glass p-5",
        colors[type]
      )}
    >
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-5 w-5 shrink-0 text-white-secondary" />
        <div>
          {title && (
            <p className="mb-1 font-display font-semibold text-white-primary">
              {title}
            </p>
          )}
          <div className="text-sm text-white-secondary leading-relaxed [&>p]:m-0">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
