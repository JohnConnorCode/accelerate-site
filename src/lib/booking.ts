// Single source of truth for "where do I book the call." The chat bot, the
// contact page embed and any copy that hands out a link all read from here so
// they can never drift apart. The values themselves live in the tenant config,
// so a client installation changes them in one place.

import { tenant } from "@/config/tenant";

export type BookingMode = "embed" | "manual" | "disabled";

export type BookingModeInput = {
  publicBooking: boolean;
  schedulerUrl: string | null | undefined;
  /** Exact env value of CALENDLY_ENABLED. Only `"false"` is an emergency pause. */
  calendlyEnabledEnv?: string | null;
};

/**
 * Resolve public booking mode from tenant ownership plus the emergency pause.
 * `CALENDLY_ENABLED=true` is not an activation switch and is ignored.
 * This is not Calendly API or webhook health.
 */
export function resolveBookingMode(input: BookingModeInput): BookingMode {
  if (input.calendlyEnabledEnv === "false") return "disabled";
  if (input.publicBooking && input.schedulerUrl?.trim()) return "embed";
  return "manual";
}

/**
 * Public booking mode. Tenant config owns the default; CALENDLY_ENABLED=false
 * is the emergency pause. This is not Calendly API health.
 */
export function bookingMode(): BookingMode {
  return resolveBookingMode({
    publicBooking: tenant.capabilities.publicBooking,
    schedulerUrl: tenant.booking.schedulerUrl,
    calendlyEnabledEnv: process.env.CALENDLY_ENABLED,
  });
}

/** Whether a public scheduler embed should render. */
export function hasScheduler(): boolean {
  return bookingMode() === "embed";
}

/** Treat current and legacy API values as "show the public embed". */
export function showsPublicEmbed(mode: string | null | undefined): boolean {
  return mode === "embed" || mode === "calendly";
}

export function bookingModeTitle(mode: BookingMode): string {
  switch (mode) {
    case "embed":
      return "Public scheduler embed";
    case "disabled":
      return "Public booking paused";
    default:
      return "Manual scheduling";
  }
}

export function bookingModeSummary(mode: BookingMode, founderName: string): string {
  switch (mode) {
    case "embed":
      return "Qualified prospects can choose a time on the public scheduler. Webhook attribution is a separate Setup check and is not implied by the embed.";
    case "disabled":
      return `Public self-booking is paused. ${founderName} still schedules by reply.`;
    default:
      return `No public embed. Qualified prospects receive confirmation and wait for ${founderName}'s personal reply.`;
  }
}

/** External scheduler event, when one is configured. */
export const CALENDLY_URL = tenant.booking.schedulerUrl ?? "";

/** On-site booking page. The calendar is embedded at the top of it. */
export const BOOKING_PATH = tenant.booking.path;

/** Absolute booking URL, for copy that has to be readable outside the site
    (chat messages, emails). */
export const BOOKING_URL = tenant.booking.url;

export const CONTACT_EMAIL = tenant.founder.email;
