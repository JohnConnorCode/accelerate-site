"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cookie, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  getCookiePreferences,
  setCookiePreferences,
} from "@/lib/tracking";
import type { CookiePreferences } from "@/lib/types";
import { cn } from "@/lib/utils";

export function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [prefs, setPrefs] = useState<CookiePreferences>({
    necessary: true,
    analytics: true,
    marketing: true,
  });

  useEffect(() => {
    const existing = getCookiePreferences();
    if (!existing) {
      // Small delay to not block initial render
      const timer = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAcceptAll = () => {
    const all: CookiePreferences = { necessary: true, analytics: true, marketing: true };
    setCookiePreferences(all);
    setVisible(false);
  };

  const handleRejectOptional = () => {
    const minimal: CookiePreferences = { necessary: true, analytics: false, marketing: false };
    setCookiePreferences(minimal);
    setVisible(false);
  };

  const handleSavePreferences = () => {
    setCookiePreferences({ ...prefs, necessary: true });
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:bottom-6 md:max-w-md z-50"
        >
          <div className="glass-prominent rounded-xl p-5 border border-[var(--border-glass)]">
            <div className="flex items-start gap-3 mb-4">
              <Cookie className="w-5 h-5 text-[var(--gold-base)] shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-white-primary mb-1">
                  We value your privacy
                </h3>
                <p className="text-xs text-white-secondary leading-relaxed">
                  We use cookies to improve your experience, analyze site traffic, and
                  show relevant ads. You can choose which cookies to allow.
                </p>
              </div>
              <button
                type="button"
                onClick={handleRejectOptional}
                className="text-white-muted hover:text-white-primary transition-colors shrink-0"
                aria-label="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {showDetails && (
              <div className="mb-4 space-y-2">
                <label className="flex items-center gap-3 text-xs">
                  <input
                    type="checkbox"
                    checked
                    disabled
                    className="accent-[var(--gold-base)]"
                  />
                  <span className="text-white-secondary">
                    <strong className="text-white-primary">Necessary</strong> — Required for the site to function
                  </span>
                </label>
                <label className="flex items-center gap-3 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={prefs.analytics}
                    onChange={(e) => setPrefs((p) => ({ ...p, analytics: e.target.checked }))}
                    className="accent-[var(--gold-base)]"
                  />
                  <span className="text-white-secondary">
                    <strong className="text-white-primary">Analytics</strong> — Help us understand how you use the site
                  </span>
                </label>
                <label className="flex items-center gap-3 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={prefs.marketing}
                    onChange={(e) => setPrefs((p) => ({ ...p, marketing: e.target.checked }))}
                    className="accent-[var(--gold-base)]"
                  />
                  <span className="text-white-secondary">
                    <strong className="text-white-primary">Marketing</strong> — Allow personalized ads across platforms
                  </span>
                </label>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Button
                onClick={handleAcceptAll}
                size="sm"
                className="flex-1"
              >
                Accept All
              </Button>
              {showDetails ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleSavePreferences}
                  className="flex-1"
                >
                  Save Preferences
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowDetails(true)}
                  className="flex-1"
                >
                  Customize
                </Button>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
