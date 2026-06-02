/* Shared per-industry "ops feed" data — the bespoke slice of a day Accelerate
   runs for each trade. Consumed by the homepage Industries switchboard
   (IndustryList) AND each vertical landing-page hero (VerticalPage), so the
   signature live-console motif stays consistent and DRY across the site.
   Keyed by the same slug used in /industries/[slug] and the switchboard. */

export type Channel =
  | "capture" | "book" | "text" | "follow" | "review" | "won" | "paid";

/* Each channel carries its own color — same language as the hero ops feed. */
export const CHANNEL: Record<Channel, { glyph: string; rgb: string }> = {
  capture: { glyph: "◆", rgb: "96,165,250" }, // blue — captured
  book:    { glyph: "✓", rgb: "190,242,100" }, // lime — booked
  text:    { glyph: "→", rgb: "34,211,238" },  // cyan — messaged
  follow:  { glyph: "↻", rgb: "167,139,250" }, // violet — followed up
  review:  { glyph: "★", rgb: "251,191,36" },  // amber — reviews
  won:     { glyph: "✦", rgb: "163,230,53" },  // bright lime — deals
  paid:    { glyph: "＄", rgb: "52,211,153" },  // emerald — money in
};

export type FeedEvent = { time: string; channel: Channel; label: string; value?: string };
export type IndustryFeed = { metric: string; feed: FeedEvent[] };

// Static timestamps keep the feed deterministic (no hydration drift) while
// still reading like a real, time-stamped operations log.
export const INDUSTRY_FEEDS: Record<string, IndustryFeed> = {
  "home-services": {
    metric: "+38% booked jobs",
    feed: [
      { time: "07:12:04", channel: "capture", label: "After-hours job request captured" },
      { time: "08:03:41", channel: "book", label: "Dispatch scheduled for Tue 9:00" },
      { time: "08:31:18", channel: "text", label: "“On my way” text sent to homeowner" },
      { time: "14:52:09", channel: "review", label: "5★ review request sent" },
      { time: "16:20:55", channel: "paid", label: "Invoice paid", value: "+$1,240" },
    ],
  },
  "law-firms": {
    metric: "2.1× signed cases",
    feed: [
      { time: "09:04:22", channel: "capture", label: "New case intake captured" },
      { time: "09:06:50", channel: "follow", label: "Conflict check: clear" },
      { time: "09:18:33", channel: "book", label: "Consultation scheduled for Thu 2:00" },
      { time: "11:47:01", channel: "text", label: "Intake docs requested" },
      { time: "15:33:40", channel: "won", label: "Engagement signed", value: "+$6,500" },
    ],
  },
  "real-estate": {
    metric: "Less chasing, more closings",
    feed: [
      { time: "08:41:12", channel: "capture", label: "New buyer inquiry captured" },
      { time: "10:15:07", channel: "book", label: "Showing booked for Sat 11:00" },
      { time: "12:30:44", channel: "follow", label: "Post-showing follow-up sent" },
      { time: "13:58:19", channel: "text", label: "Offer status update to client" },
      { time: "17:02:36", channel: "won", label: "Offer accepted, closing on track", value: "+$11,400" },
    ],
  },
  "professional-services": {
    metric: "Less admin, more billable work",
    feed: [
      { time: "09:22:50", channel: "capture", label: "Discovery request captured" },
      { time: "09:48:14", channel: "book", label: "Consult scheduled for Wed 10:30" },
      { time: "11:05:38", channel: "follow", label: "Proposal sent & tracked" },
      { time: "14:19:27", channel: "review", label: "Referral request sent" },
      { time: "16:44:03", channel: "paid", label: "Monthly retainer", value: "+$3,500" },
    ],
  },
};
