// Single source of truth for "where do I book the call." The chat bot, the
// contact page embed and any copy that hands out a link all read from here so
// they can never drift apart. The values themselves live in the tenant config,
// so a client installation changes them in one place.

import { tenant } from "@/config/tenant";

/** External scheduler event, when one is configured. */
export const CALENDLY_URL = tenant.booking.schedulerUrl ?? "";

/** Whether to render a scheduler embed at all. With no event configured the
 *  booking surfaces fall back to the contact form rather than embedding an
 *  empty or foreign calendar. */
export const HAS_SCHEDULER = Boolean(tenant.booking.schedulerUrl);

/** On-site booking page. The calendar is embedded at the top of it. */
export const BOOKING_PATH = tenant.booking.path;

/** Absolute booking URL, for copy that has to be readable outside the site
    (chat messages, emails). */
export const BOOKING_URL = tenant.booking.url;

export const CONTACT_EMAIL = tenant.founder.email;
