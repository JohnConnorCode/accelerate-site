"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  heroReveal,
  heroStaggerDramatic,
} from "@/lib/animations";
import { StarField } from "@/components/ui/StarField";
import { AmbientOrbs } from "@/components/ui/AmbientOrbs";
import { BokehField } from "@/components/ui/BokehField";

type HeroVariant = "centered" | "split" | "immersive" | "editorial";
type HeroBackground = "starfield" | "orbs" | "none";

interface PageHeroProps {
  label: string;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  className?: string;
  /** Hero layout variant. Default: "centered" */
  variant?: HeroVariant;
  /** ReactNode for split right column or immersive background layers */
  visual?: ReactNode;
  /** Background layers for immersive variant */
  backgroundLayers?: ReactNode;
  /** Large accent watermark text for editorial variant */
  accentText?: string;
  /** Custom animation variants for child stagger items */
  itemAnimation?: import("framer-motion").Variants;
  /** Background treatment. "starfield" = StarField + AmbientOrbs, "orbs" = AmbientOrbs only, "none" = gradient mesh (default) */
  background?: HeroBackground;
}

function HeroBackground({ type }: { type: HeroBackground }) {
  if (type === "starfield") {
    return (
      <>
        <StarField />
        <AmbientOrbs count={2} />
      </>
    );
  }
  if (type === "orbs") {
    return <BokehField />;
  }
  return null;
}

function DefaultBackground() {
  return (
    <>
      <div className="absolute inset-0 gradient-mesh opacity-40" />
      <div className="absolute inset-0 grid-overlay opacity-20" />
      <div className="hero-glow-orb hero-glow-orb-gold absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2" />
    </>
  );
}

export function PageHero({
  label,
  title,
  description,
  children,
  className,
  variant = "centered",
  visual,
  backgroundLayers,
  accentText,
  itemAnimation,
  background = "none",
}: PageHeroProps) {
  const itemVariant = itemAnimation || heroReveal;
  const hasCustomBg = background !== "none";
  if (variant === "split") {
    return (
      <section
        className={cn(
          "relative py-20 sm:py-28 min-h-[50vh] sm:min-h-[60vh] overflow-hidden",
          className
        )}
      >
        {/* Atmospheric background */}
        <div className="absolute inset-0 pointer-events-none">
          {hasCustomBg ? (
            <HeroBackground type={background} />
          ) : (
            <>
              <div className="absolute inset-0 gradient-mesh opacity-40" />
              <div className="absolute inset-0 grid-overlay opacity-20" />
              <div className="hero-glow-orb hero-glow-orb-gold absolute top-1/4 left-1/3 -translate-x-1/2 -translate-y-1/2" />
            </>
          )}
        </div>

        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-10 lg:gap-16 items-center">
            {/* Text — 3 cols */}
            <motion.div
              variants={heroStaggerDramatic}
              initial="hidden"
              animate="visible"
              className="lg:col-span-3"
            >
              <motion.p variants={itemVariant} className="section-label">
                {label}
              </motion.p>
              <motion.h1
                variants={itemVariant}
                className="page-heading leading-[1.1] mb-6 text-left"
              >
                {title}
              </motion.h1>
              {description && (
                <motion.p
                  variants={itemVariant}
                  className="text-lg sm:text-xl text-white-secondary max-w-xl leading-relaxed"
                >
                  {description}
                </motion.p>
              )}
              {children && (
                <motion.div variants={itemVariant}>{children}</motion.div>
              )}
            </motion.div>

            {/* Visual — 2 cols */}
            {visual && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, delay: 0.3, ease: [0.25, 0.4, 0.25, 1] }}
                className="lg:col-span-2"
              >
                {visual}
              </motion.div>
            )}
          </div>
        </div>
      </section>
    );
  }

  if (variant === "immersive") {
    return (
      <section
        className={cn(
          "relative flex items-center justify-center min-h-[50vh] sm:min-h-[60vh] overflow-hidden",
          className
        )}
      >
        {/* Background layers */}
        <div className="absolute inset-0 pointer-events-none">
          {hasCustomBg ? (
            <HeroBackground type={background} />
          ) : (
            <>
              <div className="absolute inset-0 gradient-mesh opacity-40" />
              <div className="absolute inset-0 grid-overlay opacity-15" />
              <div className="hero-glow-orb hero-glow-orb-gold absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </>
          )}
          {backgroundLayers}
        </div>

        {/* Bottom gradient fade */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[var(--bg-base)] to-transparent pointer-events-none z-[5]" />

        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 text-center py-20 sm:py-28">
          <motion.div
            variants={heroStaggerDramatic}
            initial="hidden"
            animate="visible"
          >
            <motion.p variants={itemVariant} className="section-label">
              {label}
            </motion.p>
            <motion.h1
              variants={itemVariant}
              className="page-heading leading-[1.1] mb-6"
            >
              {title}
            </motion.h1>
            {description && (
              <motion.p
                variants={itemVariant}
                className="text-lg sm:text-xl text-white-secondary max-w-2xl mx-auto leading-relaxed"
              >
                {description}
              </motion.p>
            )}
            {children && (
              <motion.div variants={itemVariant}>{children}</motion.div>
            )}
          </motion.div>
        </div>
      </section>
    );
  }

  if (variant === "editorial") {
    return (
      <section
        className={cn(
          "relative py-20 sm:py-28 min-h-[50vh] sm:min-h-[60vh] flex items-center overflow-hidden",
          className
        )}
      >
        {/* Sparse background */}
        <div className="absolute inset-0 pointer-events-none">
          {hasCustomBg ? (
            <HeroBackground type={background} />
          ) : (
            <div className="absolute inset-0 gradient-mesh opacity-25" />
          )}
        </div>

        {/* Accent watermark */}
        {accentText && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden" aria-hidden="true">
            <span className="font-display font-bold text-[15vw] leading-none text-white/[0.03] tracking-tight whitespace-nowrap">
              {accentText}
            </span>
          </div>
        )}

        <div className="relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            variants={heroStaggerDramatic}
            initial="hidden"
            animate="visible"
          >
            <motion.p variants={itemVariant} className="section-label">
              {label}
            </motion.p>
            <motion.h1
              variants={itemVariant}
              className="page-heading leading-[1.05] mb-8 max-w-3xl"
              style={{ fontSize: "clamp(2.5rem, 5vw, 4rem)" }}
            >
              {title}
            </motion.h1>
            {description && (
              <motion.p
                variants={itemVariant}
                className="text-lg sm:text-xl text-white-secondary max-w-xl ml-auto leading-relaxed text-right"
              >
                {description}
              </motion.p>
            )}
            {children && (
              <motion.div variants={itemVariant}>{children}</motion.div>
            )}
          </motion.div>
        </div>
      </section>
    );
  }

  // Default: "centered" — upgraded with heroReveal animation
  return (
    <section
      className={cn("relative py-20 sm:py-28 min-h-[50vh] sm:min-h-[60vh] flex items-center justify-center overflow-hidden", className)}
    >
      {/* Atmospheric background */}
      <div className="absolute inset-0 pointer-events-none">
        {hasCustomBg ? (
          <HeroBackground type={background} />
        ) : (
          <DefaultBackground />
        )}
      </div>

      <div className="relative z-10 w-full max-w-4xl mx-auto px-4 sm:px-6 text-center">
        <motion.div
          variants={heroStaggerDramatic}
          initial="hidden"
          animate="visible"
        >
          <motion.p variants={itemVariant} className="section-label">
            {label}
          </motion.p>
          <motion.h1
            variants={itemVariant}
            className="page-heading leading-[1.1] mb-6"
          >
            {title}
          </motion.h1>
          {description && (
            <motion.p
              variants={itemVariant}
              className="text-lg sm:text-xl text-white-secondary max-w-2xl mx-auto leading-relaxed"
            >
              {description}
            </motion.p>
          )}
          {children && (
            <motion.div variants={itemVariant}>{children}</motion.div>
          )}
        </motion.div>
      </div>
    </section>
  );
}
