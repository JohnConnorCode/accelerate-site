// Single source of truth for "where do I book the call." The chat bot, the
// contact page embed and any copy that hands out a link all read from here so
// they can never drift apart.

/** Calendly event used for the free 30-minute strategy call. */
export const CALENDLY_URL = "https://calendly.com/john-superdebate/30min";

/** On-site booking page. The calendar is embedded at the top of it. */
export const BOOKING_PATH = "/contact";

/** Absolute booking URL, for copy that has to be readable outside the site
    (chat messages, emails). */
export const BOOKING_URL = "https://acceleratewith.us/contact";

export const CONTACT_EMAIL = "john@acceleratewith.us";
