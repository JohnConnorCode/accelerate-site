"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, CalendarDays, X } from "lucide-react";
import { setPublicDockVisibility } from "@/lib/navigation/public-chrome";
import styles from "./workshop-promotion.module.css";

export function WorkshopBanner({
  eventId,
  startsAt,
  headline,
  schedule,
  href,
  price,
  available,
}: {
  eventId: string;
  startsAt: string;
  headline: string;
  schedule: string;
  href: string;
  price: string;
  available?: number;
}) {
  const reducedMotion = useReducedMotion();
  const [now, setNow] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const banner = useRef<HTMLElement>(null);
  const storageKey = `accelerate:workshop-announcement:${eventId}`;
  const start = Date.parse(startsAt);
  const visible = now !== null && now < start && !dismissed;

  useEffect(() => {
    if (dismissed) return;
    let saved: string | null = null;
    try {
      saved = sessionStorage.getItem(storageKey);
    } catch {
      // Storage restrictions leave the announcement available for this visit.
      saved = null;
    }
    if (saved === startsAt) return;
    let interval = 0;
    const tick = () => {
      const current = Date.now();
      setNow(current);
      if (current >= start) {
        window.clearInterval(interval);
        document.removeEventListener("visibilitychange", updateClock);
      }
    };
    const updateClock = () => {
      window.clearInterval(interval);
      if (document.hidden) return;
      tick();
      if (Date.now() < start) interval = window.setInterval(tick, 1000);
    };
    const entrance = window.setTimeout(() => {
      document.addEventListener("visibilitychange", updateClock);
      updateClock();
    }, 2400);
    return () => {
      window.clearTimeout(entrance);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", updateClock);
    };
  }, [dismissed, start, startsAt, storageKey]);

  useLayoutEffect(() => {
    if (!visible) return;
    const node = banner.current;
    document.body.dataset.workshopPromotion = "on";
    setPublicDockVisibility(false);
    return () => {
      if (node) {
        const focused = document.activeElement;
        if (focused instanceof HTMLElement && node.contains(focused)) focused.blur();
        node.inert = true;
      }
      delete document.body.dataset.workshopPromotion;
    };
  }, [visible]);

  const dismiss = () => {
    if (banner.current) banner.current.inert = true;
    const returnTo = Array.from(
      document.querySelectorAll<HTMLElement>(
        'header a[href="/workshop"], header button[aria-controls="mobile-site-navigation"]',
      ),
    ).find((element) => element.getClientRects().length > 0);
    returnTo?.focus({ preventScroll: true });
    setDismissed(true);
    try {
      sessionStorage.setItem(storageKey, startsAt);
    } catch {
      // The current visit stays dismissed even when tab storage is unavailable.
      return;
    }
  };
  const seconds = now === null ? 0 : Math.max(0, Math.ceil((start - now) / 1000));
  const countdown = [
    ["Days", Math.floor(seconds / 86400)],
    ["Hrs", Math.floor((seconds % 86400) / 3600)],
    ["Min", Math.floor((seconds % 3600) / 60)],
    ["Sec", seconds % 60],
  ] as const;

  return (
    <AnimatePresence initial={false}>
      {visible && (
        <motion.aside
          ref={banner}
          aria-label="Upcoming workshop"
          data-workshop-announcement
          className={styles.banner}
          initial={reducedMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: reducedMotion ? 0 : 8 }}
          transition={{ duration: reducedMotion ? 0 : 0.28, ease: [0.2, 0, 0, 1] }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              dismiss();
            }
          }}
        >
          <div className={styles.copy}>
            <p className={styles.eyebrow}>
              <CalendarDays size={13} aria-hidden="true" /> In-person workshop
            </p>
            <h2>{headline}</h2>
            <p className={styles.schedule}>{schedule}</p>
          </div>
          <div
            className={styles.countdown}
            role="timer"
            aria-label="Time until the workshop"
            aria-live="off"
          >
            <p className={styles.clockLabel}>Starts in</p>
            <dl>
              {countdown.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{String(value).padStart(2, "0")}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className={styles.action}>
            <Link href={available === 0 ? href : `${href}#tickets`} className={styles.cta}>
              {available === 0 ? "View workshop" : `Get tickets · ${price}`}
              <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
            <p>
              {available === undefined
                ? "Secure checkout"
                : available === 0
                  ? "Sold out"
                  : `${available} ${available === 1 ? "seat" : "seats"} available`}
            </p>
          </div>
          <button
            type="button"
            aria-label="Dismiss workshop announcement"
            className={styles.close}
            onClick={dismiss}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
