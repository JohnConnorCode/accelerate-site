"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface NavLink {
  label: string;
  href: string;
  children?: { label: string; href: string }[];
}

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
  navLinks: NavLink[];
}

export function MobileNav({ isOpen, onClose, navLinks }: MobileNavProps) {
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      // Small delay to let the animation start before focusing
      const timer = setTimeout(() => closeButtonRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[60] lg:hidden"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/80"
            onClick={onClose}
          />

          {/* Nav Panel */}
          <motion.nav
            initial={{ y: "-100%" }}
            animate={{ y: 0 }}
            exit={{ y: "-100%" }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="relative glass-prominent min-h-screen pt-6 pb-12 px-6"
          >
            {/* Close + Logo Row */}
            <div className="flex items-center justify-between mb-12">
              <span className="text-2xl font-bold text-gold-gradient tracking-tight">
                Accelerate
              </span>
              <button
                ref={closeButtonRef}
                onClick={onClose}
                className="text-white/70 hover:text-white p-2 cursor-pointer"
                aria-label="Close navigation menu"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Nav Links */}
            <div className="flex flex-col gap-2">
              {navLinks.map((link) =>
                link.children ? (
                  <div key={link.label}>
                    <button
                      onClick={() =>
                        setExpandedItem(
                          expandedItem === link.label ? null : link.label
                        )
                      }
                      aria-expanded={expandedItem === link.label}
                      className="w-full flex items-center justify-between py-3 text-xl text-white/80 hover:text-white transition-colors cursor-pointer"
                    >
                      {link.label}
                      <ChevronDown
                        className={`w-5 h-5 transition-transform duration-200 ${
                          expandedItem === link.label ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                    <AnimatePresence>
                      {expandedItem === link.label && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden pl-4"
                        >
                          {link.children.map((child) => (
                            <Link
                              key={child.href}
                              href={child.href}
                              onClick={onClose}
                              className="block py-2.5 text-lg text-white/60 hover:text-white transition-colors"
                            >
                              {child.label}
                            </Link>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ) : (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={onClose}
                    className="block py-3 text-xl text-white/80 hover:text-white transition-colors"
                  >
                    {link.label}
                  </Link>
                )
              )}
            </div>

            {/* CTA */}
            <div className="mt-10">
              <Link href="/#solution-generator" onClick={onClose}>
                <Button variant="primary" size="lg" className="w-full">
                  Get Your Growth Plan
                </Button>
              </Link>
            </div>
          </motion.nav>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
