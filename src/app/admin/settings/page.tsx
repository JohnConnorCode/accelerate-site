"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Key, Mail, Globe, Building2, Loader2, CheckCircle, XCircle } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Toast } from "@/components/ui/Toast";
import { LoadingSkeleton } from "@/components/admin/LoadingSkeleton";

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
    keys: ["ANTHROPIC_API_KEY", "RESEND_API_KEY", "CRON_SECRET"],
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

export default function SettingsPage() {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, "success" | "error">>({});
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/settings");
      const data = await res.json();
      setSettings(data.settings || []);
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
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <PageHeader title="Settings" subtitle="Manage API keys and configuration" />

      <div className="space-y-6">
        {settingSections.map((section, sectionIdx) => (
          <motion.div
            key={section.title}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: sectionIdx * 0.1 }}
          >
            <GlassCard hover="none">
              <div className="flex items-center gap-3 mb-5">
                <section.icon className="h-5 w-5 text-[var(--gold-light)]" />
                <h2 className="font-display text-lg font-semibold text-white-primary">
                  {section.title}
                </h2>
              </div>

              <div className="space-y-4">
                {section.keys.map((key) => {
                  const setting = getSetting(key);
                  const isEditing = editingKey === key;
                  const testResult = testResults[key];
                  const isTestable = key === "ANTHROPIC_API_KEY" || key === "RESEND_API_KEY";

                  return (
                    <div
                      key={key}
                      className="border border-border-glass rounded-lg p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-white-primary">
                              {key}
                            </p>
                            {setting?.is_secret && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white-muted">
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
                          <p className="text-xs text-white-muted mt-0.5">
                            {setting?.description || key}
                          </p>

                          {isEditing ? (
                            <div className="mt-3 flex gap-2">
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
                            <p className="mt-1 text-sm text-white-secondary font-mono">
                              {setting?.value || (
                                <span className="text-white-muted italic">
                                  Not set
                                </span>
                              )}
                            </p>
                          )}
                        </div>

                        {!isEditing && (
                          <div className="flex gap-2 shrink-0">
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
            </GlassCard>
          </motion.div>
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
    </motion.div>
  );
}
