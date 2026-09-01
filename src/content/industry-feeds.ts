/* Shared per-industry "ops feed" data — the bespoke slice of a day Accelerate
   runs for each trade. Consumed by the homepage Industries switchboard
   (IndustryList) AND each vertical landing-page hero (VerticalPage), so the
   signature live-console motif stays consistent and DRY across the site.
   Keyed by the same slug used in /industries/[slug] and the switchboard. */

export type Channel = "capture" | "book" | "text" | "follow" | "review" | "won" | "paid";

/* Each channel carries its own color — same language as the hero ops feed. */
export const CHANNEL: Record<Channel, { glyph: string; rgb: string }> = {
  capture: { glyph: "◆", rgb: "96,165,250" }, // blue — captured
  book: { glyph: "✓", rgb: "190,242,100" }, // lime — booked
  text: { glyph: "→", rgb: "34,211,238" }, // cyan — messaged
  follow: { glyph: "↻", rgb: "167,139,250" }, // violet — followed up
  review: { glyph: "★", rgb: "251,191,36" }, // amber — reviews
  won: { glyph: "✦", rgb: "163,230,53" }, // bright lime — deals
  paid: { glyph: "＄", rgb: "52,211,153" }, // emerald — money in
};

export type FeedEvent = { time: string; channel: Channel; label: string };
export type IndustryFeed = { metric: string; feed: FeedEvent[] };

// Static timestamps keep the feed deterministic (no hydration drift) while
// still reading like a real, time-stamped operations log.
export const INDUSTRY_FEEDS: Record<string, IndustryFeed> = {
  "home-services": {
    metric: "Hours back to the crew",
    feed: [
      { time: "07:12:04", channel: "capture", label: "After-hours job request captured" },
      { time: "08:03:41", channel: "book", label: "Dispatch scheduled for Tue 9:00" },
      { time: "08:31:18", channel: "text", label: "“On my way” text sent to homeowner" },
      { time: "14:52:09", channel: "review", label: "5★ review request sent" },
      { time: "16:20:55", channel: "paid", label: "Invoice marked paid" },
    ],
  },
  "law-firms": {
    metric: "Less intake work, more signed cases",
    feed: [
      { time: "09:04:22", channel: "capture", label: "New case intake captured" },
      { time: "09:06:50", channel: "follow", label: "Conflict check: clear" },
      { time: "09:18:33", channel: "book", label: "Consultation scheduled for Thu 2:00" },
      { time: "11:47:01", channel: "text", label: "Intake docs requested" },
      { time: "15:33:40", channel: "won", label: "Engagement signed" },
    ],
  },
  "real-estate": {
    metric: "Less chasing, more closings",
    feed: [
      { time: "08:41:12", channel: "capture", label: "New buyer inquiry captured" },
      { time: "10:15:07", channel: "book", label: "Showing booked for Sat 11:00" },
      { time: "12:30:44", channel: "follow", label: "Post-showing follow-up sent" },
      { time: "13:58:19", channel: "text", label: "Offer status update to client" },
      { time: "17:02:36", channel: "won", label: "Offer accepted, closing on track" },
    ],
  },
  "professional-services": {
    metric: "Less admin, more billable work",
    feed: [
      { time: "09:22:50", channel: "capture", label: "Discovery request captured" },
      { time: "09:48:14", channel: "book", label: "Consult scheduled for Wed 10:30" },
      { time: "11:05:38", channel: "follow", label: "Proposal sent & tracked" },
      { time: "14:19:27", channel: "review", label: "Referral request sent" },
      { time: "16:44:03", channel: "paid", label: "Monthly retainer confirmed" },
    ],
  },
  manufacturing: {
    metric: "Less chasing, more shop time",
    feed: [
      { time: "07:48:15", channel: "capture", label: "New RFQ captured from portal" },
      { time: "08:02:40", channel: "text", label: "Quote acknowledgment sent to buyer" },
      { time: "10:15:22", channel: "follow", label: "Quote follow-up sent, no response yet" },
      { time: "13:40:07", channel: "won", label: "PO received, job scheduled" },
      { time: "16:05:51", channel: "follow", label: "Supplier ship-date check sent" },
    ],
  },
  startups: {
    metric: "Less admin, more building",
    feed: [
      { time: "08:10:00", channel: "capture", label: "New signup onboarded automatically" },
      { time: "09:32:14", channel: "text", label: "Day-3 check-in sent to new customer" },
      { time: "11:05:47", channel: "follow", label: "Support ticket routed to product" },
      { time: "14:20:03", channel: "book", label: "Investor update drafted for review" },
      { time: "16:48:29", channel: "won", label: "Renewal confirmed" },
    ],
  },
  "medical-dental": {
    metric: "Fewer no-shows, fuller chairs",
    feed: [
      { time: "07:55:10", channel: "capture", label: "New patient inquiry captured" },
      { time: "08:20:44", channel: "book", label: "Appointment booked for Thu 2:00" },
      { time: "09:10:33", channel: "text", label: "Reminder sent, 48 hours out" },
      { time: "13:44:18", channel: "follow", label: "Insurance verification completed" },
      { time: "16:30:02", channel: "review", label: "5★ review request sent" },
    ],
  },
  "insurance-agencies": {
    metric: "Less chasing, more policies bound",
    feed: [
      { time: "08:05:22", channel: "capture", label: "New quote request captured" },
      { time: "08:40:15", channel: "text", label: "Quote sent to prospect" },
      { time: "11:12:48", channel: "follow", label: "Renewal reminder sent, 30 days out" },
      { time: "14:05:36", channel: "won", label: "Policy bound" },
      { time: "16:22:09", channel: "follow", label: "Coverage-gap outreach sent" },
    ],
  },
  "auto-dealers": {
    metric: "Less chasing, more appointments",
    feed: [
      { time: "08:00:12", channel: "capture", label: "New internet inquiry captured" },
      { time: "08:14:50", channel: "text", label: "Response sent, appointment offered" },
      { time: "10:30:27", channel: "book", label: "Service appointment booked for Fri 9:00" },
      { time: "13:15:44", channel: "follow", label: "Unclosed deal follow-up sent" },
      { time: "16:40:19", channel: "won", label: "Vehicle sold" },
    ],
  },
};
