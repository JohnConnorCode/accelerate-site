"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { isValidEmail } from "@/lib/validation";
import { leadMagnets } from "@/content/lead-magnets";
import { trackConversion } from "@/lib/analytics";
import { getUTMParams, clearUTMParams } from "@/lib/utm";

interface ResourceGateProps {
  resourceId: string;
  onClose: () => void;
}

export function ResourceGate({ resourceId, onClose }: ResourceGateProps) {
  const resource = leadMagnets.find((r) => r.id === resourceId);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const modalRef = useRef<HTMLDivElement>(null);
  const headingId = `resource-gate-heading-${resourceId}`;

  // Focus trap + Escape handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }

      if (e.key === "Tab" && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;

        const first = focusable[0] as HTMLElement | undefined;
        const last = focusable[focusable.length - 1] as HTMLElement | undefined;
        if (!first || !last) return;

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Auto-focus first input on mount
  useEffect(() => {
    if (modalRef.current) {
      const firstInput = modalRef.current.querySelector<HTMLElement>("input");
      firstInput?.focus();
    }
  }, []);

  if (!resource) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim() || !email.trim()) {
      setError("Please fill in all fields.");
      return;
    }

    if (!isValidEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/resource-download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resourceId: resource.id,
          name: name.trim(),
          email: email.trim(),
          utm: getUTMParams(),
        }),
      });

      if (!res.ok) {
        throw new Error("Request failed");
      }

      trackConversion("Resource Downloaded", {
        resource_id: resource.id,
        resource_name: resource.title,
      });
      clearUTMParams();

      // Trigger download
      window.open(resource.fileUrl, "_blank");
      onClose();
    } catch {
      // Still allow download even if API fails
      window.open(resource.fileUrl, "_blank");
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

        {/* Modal */}
        <motion.div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={headingId}
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="glass-prominent rounded-xl p-6 md:p-8 max-w-md w-full relative z-10"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 text-white-muted hover:text-white-primary transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-lg bg-gold-gradient flex items-center justify-center mx-auto mb-4">
              <Download className="w-6 h-6 text-black" />
            </div>
            <h2
              id={headingId}
              className="text-xl font-bold text-white-primary mb-1"
              style={{ fontFamily: "var(--font-jost), var(--font-inter), sans-serif" }}
            >
              Get Your Free Download
            </h2>
            <p className="text-sm text-white-secondary">
              Enter your details to download{" "}
              <span className="text-gold-light">{resource.title}</span>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Your Name"
              placeholder="John Smith"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <Input
              label="Work Email"
              type="email"
              placeholder="john@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            {error && (
              <p role="alert" className="text-[var(--error)] text-sm">{error}</p>
            )}

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Preparing Download...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Download Now
                </>
              )}
            </Button>

            <p className="text-xs text-white-muted text-center">
              We will send you occasional updates. Unsubscribe anytime.
            </p>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
