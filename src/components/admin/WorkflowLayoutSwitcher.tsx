"use client";

import { CalendarDays, Columns3, List } from "lucide-react";
import { AdminViewSwitcher } from "./AdminViewSwitcher";
import type { WorkflowLayout } from "@/lib/admin/workflow-views";

const options = [
  { id: "list", label: "List", icon: List },
  { id: "board", label: "Board", icon: Columns3 },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
] as const;

export function WorkflowLayoutSwitcher({
  value,
  onChange,
  layouts = ["list", "board", "calendar"],
}: {
  value: WorkflowLayout;
  onChange: (layout: WorkflowLayout) => void;
  layouts?: readonly WorkflowLayout[];
}) {
  return (
    <AdminViewSwitcher
      label="Workflow layout"
      value={value}
      onChange={onChange}
      options={options.filter((option) => layouts.includes(option.id))}
    />
  );
}
