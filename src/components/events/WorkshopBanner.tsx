"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, MapPin, X } from "lucide-react";
import { setPublicDockVisibility } from "@/lib/navigation/public-chrome";
import styles from "./workshop-promotion.module.css";

export function WorkshopBanner({
  startsAt,
  date,
  headline,
  schedule,
  venue,
  presenters,
  href,
  price,
  available,
}: {
  startsAt: string;
  date: { month: string; day: string; label: string };
  headline: string;
  schedule: string;
  venue: string;
  presenters: { name: string; image: string }[];
  href: string;
  price: string;
  available?: number;
}) {
  const reducedMotion = useReducedMotion();
  const [now, setNow] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const banner = useRef<HTMLElement>(null);
  const start = Date.parse(startsAt);
  const visible = now !== null && now < start && !dismissed;

  useEffect(() => {
    if (dismissed) return;
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
    }, 1800);
    return () => {
      window.clearTimeout(entrance);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", updateClock);
    };
  }, [dismissed, start]);

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
        'header [data-workshop-link], header button[aria-controls="mobile-site-navigation"]',
      ),
    ).find((element) => element.getClientRects().length > 0);
    returnTo?.focus({ preventScroll: true });
    setDismissed(true);
  };
  const seconds = now === null ? 0 : Math.max(0, Math.ceil((start - now) / 1000));
  const countdown = [
    ["Days", Math.floor(seconds / 86400)],
    ["Hrs", Math.floor((seconds % 86400) / 3600)],
    ["Min", Math.floor((seconds % 3600) / 60)],
    ["Sec", seconds % 60],
  ] as const;

  return (
    <AnimatePresence>
      {visible && (
        <motion.aside
          ref={banner}
          aria-label="Upcoming workshop"
          data-workshop-announcement
          className={styles.banner}
          initial={reducedMotion ? false : { opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: reducedMotion ? 0 : 12, scale: reducedMotion ? 1 : 0.98 }}
          transition={{ duration: reducedMotion ? 0 : 0.4, ease: [0.16, 1, 0.3, 1] }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              dismiss();
            }
          }}
        >
          <time className={styles.date} dateTime={startsAt} aria-label={date.label}>
            <span>{date.month}</span>
            <strong>{date.day}</strong>
            <span>In person</span>
          </time>
          <div className={styles.copy}>
            <p className={styles.eyebrow}>Accelerate presents · Hands-on AI workshop</p>
            <h2>{headline}</h2>
            <p className={styles.schedule}>
              <MapPin size={13} aria-hidden="true" /> {venue}
              <span aria-hidden="true">·</span> {schedule}
            </p>
            {presenters.length > 0 && (
              <div className={styles.hosts}>
                <div className={styles.avatars} aria-hidden="true">
                  {presenters.map((presenter) => (
                    <Image
                      key={presenter.name}
                      src={presenter.image}
                      alt=""
                      width={40}
                      height={40}
                    />
                  ))}
                </div>
                <p>With {presenters.map((presenter) => presenter.name).join(" + ")}</p>
              </div>
            )}
          </div>
          <div className={styles.booking}>
            <div
              className={styles.countdown}
              role="timer"
              aria-label="Time until the workshop"
              aria-live="off"
            >
              <p className={styles.clockLabel}>Workshop begins in</p>
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
              <Link href={href} className={styles.cta}>
                {available === 0 ? "View workshop" : `View workshop · ${price}`}
                <span className={styles.ctaArrow} aria-hidden="true">
                  <ArrowUpRight size={17} />
                </span>
              </Link>
              <p>
                {available === undefined
                  ? "Secure checkout"
                  : available === 0
                    ? "Sold out"
                    : `${available} ${available === 1 ? "seat" : "seats"} available`}
              </p>
            </div>
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
