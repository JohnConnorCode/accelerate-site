"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { CheckSquare, Circle, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import Link from "@/components/admin/AdminLink";
import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/ui/GlassCard";
import { TaskQuickAdd } from "./TaskQuickAdd";
import { fetchJson } from "@/lib/admin/fetchJson";
import { toast } from "@/lib/admin/useToast";

interface Task {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  due_time: string | null;
  priority: string;
  status: string;
  related_type: string | null;
  related_id: string | null;
  related_name: string | null;
  created_at: string;
  completed_at: string | null;
  snoozed_until: string | null;
}

const priorityColors: Record<string, string> = {
  high: "text-red-400",
  medium: "text-yellow-400",
  low: "text-blue-400",
};

export function TaskWidget() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    try {
      const today = new Date().toISOString().split("T")[0]!;
      const [todayData, overdueData] = await Promise.all([
        fetchJson<{ tasks?: Task[] }>(`/api/admin/tasks?status=pending&date=${today}`),
        fetchJson<{ tasks?: Task[] }>(`/api/admin/tasks?include_overdue=true`),
      ]);

      // Merge and deduplicate: overdue first, then today's
      const overdueIds = new Set<string>();
      const overdue = (overdueData.tasks || []).filter((t: Task) => {
        if (t.due_date && t.due_date < today) {
          overdueIds.add(t.id);
          return true;
        }
        return false;
      });
      const todayTasks = (todayData.tasks || []).filter((t: Task) => !overdueIds.has(t.id));

      setTasks([...overdue, ...todayTasks]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleComplete = async (taskId: string) => {
    try {
      await fetchJson("/api/admin/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: taskId, status: "completed" }),
      });
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      toast.success("Task completed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't complete task");
    }
  };

  const today = new Date().toISOString().split("T")[0]!;

  if (loading) return null;
  if (tasks.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-6"
      >
        <GlassCard hover="none" padding="md">
          <div className="flex items-center gap-2 mb-3">
            <CheckSquare className="h-4 w-4 text-gold-light" />
            <h3 className="font-display text-sm font-semibold text-white-primary">
              Today&apos;s Tasks
            </h3>
          </div>
          <p className="text-xs text-white-muted">No tasks due today. Nice work!</p>
          <TaskQuickAdd onTaskCreated={fetchTasks} />
        </GlassCard>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mb-6"
    >
      <GlassCard hover="none" padding="md">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <CheckSquare className="h-4 w-4 text-gold-light" />
            <h3 className="font-display text-sm font-semibold text-white-primary">
              Today&apos;s Tasks
            </h3>
            <span className="text-[10px] text-white-muted bg-white/10 rounded-full px-2 py-0.5">
              {tasks.length}
            </span>
          </div>
        </div>

        <div className="space-y-1">
          {tasks.map((task, i) => {
            const isOverdue = task.due_date ? task.due_date < today : false;

            return (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-white/5 transition-colors group"
              >
                <button
                  onClick={() => handleComplete(task.id)}
                  className="shrink-0 cursor-pointer text-white-muted hover:text-emerald-400 transition-colors"
                  title="Mark complete"
                >
                  <Circle className="h-4 w-4 group-hover:hidden" />
                  <CheckCircle2 className="h-4 w-4 hidden group-hover:block" />
                </button>

                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white-primary truncate">{task.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {isOverdue && (
                      <span className="flex items-center gap-1 text-[10px] text-red-400 font-medium">
                        <AlertCircle className="h-3 w-3" />
                        Overdue
                      </span>
                    )}
                    {task.due_date && !isOverdue && (
                      <span className="flex items-center gap-1 text-[10px] text-white-muted">
                        <Clock className="h-3 w-3" />
                        {task.due_time || "Today"}
                      </span>
                    )}
                    {task.related_name && (
                      <Link
                        href={
                          task.related_type === "lead"
                            ? "/admin/leads"
                            : task.related_type === "client"
                            ? `/admin/clients/${task.related_id}`
                            : `/admin/contacts/${encodeURIComponent(task.related_name)}`
                        }
                        className="text-[10px] text-white-muted hover:text-gold-light transition-colors truncate"
                      >
                        {task.related_name}
                      </Link>
                    )}
                  </div>
                </div>

                <span className={cn("text-[10px] font-medium shrink-0", priorityColors[task.priority] || "text-white-muted")}>
                  {task.priority}
                </span>
              </motion.div>
            );
          })}
        </div>

        <TaskQuickAdd onTaskCreated={fetchTasks} />
      </GlassCard>
    </motion.div>
  );
}
