"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Key,
  Mail,
  Globe,
  Building2,
  Loader2,
  CheckCircle,
  XCircle,
  Bell,
  LayoutPanelTop,
} from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { AdminSurface } from "@/components/admin/AdminSurface";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Toast } from "@/components/ui/Toast";
import { LoadingSkeleton } from "@/components/admin/LoadingSkeleton";
import { AdminSwitch } from "@/components/admin/AdminSwitch";
import { ADMIN_LAYOUT_SCOPES } from "@/lib/admin/layout-scopes";
import { LayoutScopeCard } from "@/components/admin/LayoutScopeCard";

interface Setting {
  key: string;
  value: string;
  is_secret: boolean;
  description: string;
  updated_at: string;
}

const settingSections = [
  {
    title: "API Keys",
    icon: Key,
    keys: ["OPENROUTER_API_KEY", "RESEND_API_KEY", "CRON_SECRET"],
  },
  {
    title: "Email Configuration",
    icon: Mail,
    keys: ["RESEND_FROM_EMAIL", "ADMIN_EMAIL"],
  },
  {
    title: "Analytics",
    icon: Globe,
    keys: ["NEXT_PUBLIC_PLAUSIBLE_DOMAIN"],
  },
  {
    title: "Site Configuration",
    icon: Building2,
    keys: ["SITE_URL", "BUSINESS_NAME"],
  },
];

const notificationSettings = [
  {
    key: "NOTIFY_NEW_LEADS",
    label: "New lead submitted",
    description: "Get notified when someone completes the plan builder",
  },
  {
    key: "NOTIFY_NEW_CONTACTS",
    label: "New contact form",
    description: "Get notified on new contact form submissions",
  },
  {
    key: "NOTIFY_HOT_LEADS",
    label: "Hot leads",
    description: "Alert when a lead scores 70+ (hot)",
  },
  {
    key: "NOTIFY_PROPOSAL_VIEWED",
    label: "Proposal viewed",
    description: "Alert when a prospect views a shared proposal",
  },
  {
    key: "NOTIFY_TASK_OVERDUE",
    label: "Task overdue",
    description: "Alert when a follow-up task passes its due date",
  },
  {
    key: "NOTIFY_CONTRACT_EXPIRING",
    label: "Contract expiring",
    description: "Alert when a client contract is expiring within 30 days",
  },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, "success" | "error">>({});
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [notifyPrefs, setNotifyPrefs] = useState<Record<string, boolean>>({});
  const [savingNotifyPrefs, setSavingNotifyPrefs] = useState<Set<string>>(() => new Set());

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/settings");
      const data = await res.json();
      setSettings(data.settings || []);

      // Extract notification preferences
      const prefs: Record<string, boolean> = {};
      (data.settings || []).forEach((s: Setting) => {
        if (s.key.startsWith("NOTIFY_")) {
          prefs[s.key] = s.value === "true";
        }
      });
      setNotifyPrefs(prefs);
    } catch {
      setToast({ message: "Failed to load settings", type: "error" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async (key: string) => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value: editValue }),
      });

      if (!res.ok) throw new Error("Save failed");

      setToast({ message: `${key} updated successfully`, type: "success" });
      setEditingKey(null);
      setEditValue("");
      await fetchSettings();
    } catch {
      setToast({ message: "Failed to save setting", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (key: string) => {
    setTesting(key);
    setTestResults((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });

    try {
      const res = await fetch("/api/admin/settings/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });

      const data = await res.json();
      setTestResults((prev) => ({
        ...prev,
        [key]: data.success ? "success" : "error",
      }));
      setToast({
        message: data.success
          ? `${key} connection verified`
          : `${key} test failed: ${data.error || "Unknown error"}`,
        type: data.success ? "success" : "error",
      });
    } catch {
      setTestResults((prev) => ({ ...prev, [key]: "error" }));
      setToast({ message: `Failed to test ${key}`, type: "error" });
    } finally {
      setTesting(null);
    }
  };

  const handleNotifyToggle = async (key: string, newValue: boolean) => {
    if (savingNotifyPrefs.has(key)) return;
    setNotifyPrefs((prev) => ({ ...prev, [key]: newValue }));
    setSavingNotifyPrefs((prev) => new Set(prev).add(key));

    try {
      const response = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value: String(newValue) }),
      });
      if (!response.ok) throw new Error("Preference update failed");
    } catch {
      // Revert on failure
      setNotifyPrefs((prev) => ({ ...prev, [key]: !newValue }));
      setToast({ message: "Failed to update preference", type: "error" });
    } finally {
      setSavingNotifyPrefs((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const getSetting = (key: string): Setting | undefined => {
    return settings.find((s) => s.key === key);
  };

  if (loading) {
    return (
      <div>
        <PageHeader title="Settings" />
        <LoadingSkeleton variant="page" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Control notification preferences and the configuration that powers the operating system."
      />

      <div className="space-y-6">
        {/* Notification Preferences */}
        <div>
          <AdminSurface padding="lg">
            <div className="flex items-center gap-3 mb-5">
              <span className="grid size-10 place-items-center rounded-xl bg-black/[0.045] text-[var(--admin-ink)] dark:bg-white/[0.06]">
                <Bell className="size-4" />
              </span>
              <div>
                <p className="admin-eyebrow">Operating preferences</p>
                <h2 className="mt-1 text-balance text-lg font-semibold tracking-[-0.02em] text-[var(--admin-ink)]">
                  Notifications
                </h2>
              </div>
            </div>

            <div className="divide-y divide-[var(--admin-border)] overflow-hidden rounded-xl bg-[var(--admin-surface-subtle)] shadow-[var(--admin-shadow-border)]">
              {notificationSettings.map((pref) => (
                <div key={pref.key} className="flex items-center justify-between gap-4 px-4 py-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--admin-ink)]">{pref.label}</p>
                    <p className="admin-copy mt-1 text-pretty text-xs">{pref.description}</p>
                  </div>
                  <AdminSwitch
                    checked={Boolean(notifyPrefs[pref.key])}
                    onCheckedChange={(checked) => void handleNotifyToggle(pref.key, checked)}
                    label={`${notifyPrefs[pref.key] ? "Disable" : "Enable"} ${pref.label} notification`}
                    disabled={savingNotifyPrefs.has(pref.key)}
                  />
                </div>
              ))}
            </div>
          </AdminSurface>
        </div>

        {/* Layout */}
        <div>
          <AdminSurface padding="lg">
            <div className="flex items-center gap-3 mb-5">
              <span className="grid size-10 place-items-center rounded-xl bg-black/[0.045] text-[var(--admin-ink)] dark:bg-white/[0.06]">
                <LayoutPanelTop className="size-4" />
              </span>
              <div>
                <p className="admin-eyebrow">Read-only</p>
                <h2 className="mt-1 text-balance text-lg font-semibold tracking-[-0.02em] text-[var(--admin-ink)]">
                  Layout
                </h2>
                <p className="admin-copy mt-1 text-xs">
                  Ask the AI Workspace to reorganize the sidebar or Today page. Changes wait for
                  your approval before applying. Revert here at any time.
                </p>
              </div>
            </div>

            <div className="divide-y divide-[var(--admin-border)] overflow-hidden rounded-xl bg-[var(--admin-surface-subtle)] shadow-[var(--admin-shadow-border)]">
              {ADMIN_LAYOUT_SCOPES.map((scope) => (
                <LayoutScopeCard
                  key={scope.id}
                  scopeId={scope.id}
                  scopeLabel={scope.label}
                  regions={scope.regions}
                  onToast={(message, type) => setToast({ message, type })}
                />
              ))}
            </div>
          </AdminSurface>
        </div>

        {settingSections.map((section) => (
          <div key={section.title}>
            <AdminSurface padding="lg">
              <div className="flex items-center gap-3 mb-5">
                <span className="grid size-10 place-items-center rounded-xl bg-black/[0.045] text-[var(--admin-ink)] dark:bg-white/[0.06]">
                  <section.icon className="size-4" />
                </span>
                <div>
                  <p className="admin-eyebrow">Configuration</p>
                  <h2 className="mt-1 text-balance text-lg font-semibold tracking-[-0.02em] text-[var(--admin-ink)]">
                    {section.title}
                  </h2>
                </div>
              </div>

              <div className="divide-y divide-[var(--admin-border)] overflow-hidden rounded-xl bg-[var(--admin-surface-subtle)] shadow-[var(--admin-shadow-border)]">
                {section.keys.map((key) => {
                  const setting = getSetting(key);
                  const isEditing = editingKey === key;
                  const testResult = testResults[key];
                  const isTestable = key === "OPENROUTER_API_KEY" || key === "RESEND_API_KEY";

                  return (
                    <div key={key} className="px-4 py-4">
                      <div className="flex flex-col items-stretch justify-between gap-4 sm:flex-row sm:items-start">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="break-all font-mono text-xs font-semibold text-[var(--admin-ink)]">
                              {key}
                            </p>
                            {setting?.is_secret && (
                              <span className="rounded-md bg-black/[0.055] px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--admin-muted)] dark:bg-white/[0.07]">
                                SECRET
                              </span>
                            )}
                            {testResult && (
                              <span className="flex items-center gap-1">
                                {testResult === "success" ? (
                                  <CheckCircle className="h-3.5 w-3.5 text-[var(--success)]" />
                                ) : (
                                  <XCircle className="h-3.5 w-3.5 text-[var(--error)]" />
                                )}
                              </span>
                            )}
                          </div>
                          <p className="admin-copy mt-1 text-pretty text-xs">
                            {setting?.description || key}
                          </p>

                          {isEditing ? (
                            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                              <Input
                                type={setting?.is_secret ? "password" : "text"}
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                placeholder="Enter new value..."
                                className="flex-1"
                              />
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => handleSave(key)}
                                disabled={saving}
                              >
                                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setEditingKey(null);
                                  setEditValue("");
                                }}
                              >
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <p className="mt-2 break-all font-mono text-xs text-[var(--admin-ink)]">
                              {setting?.value || (
                                <span className="text-[var(--admin-muted)] italic">Not set</span>
                              )}
                            </p>
                          )}
                        </div>

                        {!isEditing && (
                          <div className="flex shrink-0 justify-end gap-2">
                            {isTestable && (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleTest(key)}
                                disabled={testing === key}
                              >
                                {testing === key ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  "Test"
                                )}
                              </Button>
                            )}
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                setEditingKey(key);
                                setEditValue("");
                              }}
                            >
                              Edit
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </AdminSurface>
          </div>
        ))}
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          isVisible={true}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
