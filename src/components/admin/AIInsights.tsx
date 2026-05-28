"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, RefreshCw } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { LoadingSkeleton } from "./LoadingSkeleton";

export function AIInsights() {
  const [insights, setInsights] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const fetchInsights = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/ai-insights", { method: "POST" });
      const data = await res.json();
      setInsights(data.insights || []);
      setLoaded(true);
    } catch {
      setInsights(["Failed to load AI insights."]);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <GlassCard hover="none" padding="none">
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-gold-light" />
            <h3 className="font-display text-sm font-semibold text-white-primary">
              AI Insights
            </h3>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchInsights}
            disabled={loading}
            className="text-xs px-3 py-1.5"
          >
            <RefreshCw className={`h-3 w-3 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Analyzing..." : loaded ? "Refresh" : "Generate"}
          </Button>
        </div>

        {loading && !loaded ? (
          <LoadingSkeleton variant="cards" count={1} />
        ) : insights.length > 0 ? (
          <ul className="space-y-2">
            <AnimatePresence>
              {insights.map((insight, i) => (
                <motion.li
                  key={i}
                  className="flex items-start gap-2 text-sm text-white-secondary"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: i * 0.05 }}
                >
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[var(--gold-light)] shrink-0" />
                  {insight}
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        ) : (
          <p className="text-sm text-white-muted">
            Click &quot;Generate&quot; to get AI-powered insights about your business metrics.
          </p>
        )}
      </div>
    </GlassCard>
  );
}
