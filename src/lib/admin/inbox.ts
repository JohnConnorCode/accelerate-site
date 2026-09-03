export type AdminInboxKind =
  | "lead"
  | "contact"
  | "chat"
  | "partner"
  | "task"
  | "proposal"
  | "coworker"
  | "action";
export type AdminInboxPriority = "urgent" | "important" | "normal";

export interface AdminInboxItem {
  id: string;
  kind: AdminInboxKind;
  title: string;
  summary: string;
  priority: AdminInboxPriority;
  createdAt: string;
  dueAt?: string | null;
  href: string;
  person?: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
  };
  meta?: string | null;
}

export interface AdminInboxResponse {
  items: AdminInboxItem[];
  counts: Record<AdminInboxKind | "all", number>;
  updatedAt: string;
}
