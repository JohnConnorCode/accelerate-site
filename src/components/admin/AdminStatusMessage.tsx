import { CheckCircle2, CircleAlert, Info, TriangleAlert, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type StatusTone = "success" | "warning" | "error" | "info";

const toneConfig: Record<StatusTone, { icon: LucideIcon; className: string }> = {
  success: { icon: CheckCircle2, className: "admin-status-message--success" },
  warning: { icon: TriangleAlert, className: "admin-status-message--warning" },
  error: { icon: CircleAlert, className: "admin-status-message--error" },
  info: { icon: Info, className: "admin-status-message--info" },
};

export function AdminStatusMessage({
  tone,
  children,
  className,
}: {
  tone: StatusTone;
  children: React.ReactNode;
  className?: string;
}) {
  const config = toneConfig[tone];
  const Icon = config.icon;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("admin-status-message", config.className, className)}
    >
      <span className="admin-status-message-icon" aria-hidden="true">
        <Icon className="size-4" />
      </span>
      <p className="min-w-0 text-pretty text-sm font-medium leading-5">{children}</p>
    </div>
  );
}
