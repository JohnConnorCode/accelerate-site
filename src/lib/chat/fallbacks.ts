import { tenant } from "@/config/tenant";
import { BOOKING_URL, CONTACT_EMAIL } from "@/lib/booking";

// What the bot says when it can't actually think: no API key configured, or
// the request blew up. Both are moments where the visitor is still interested
// and we have nothing to give them, so they get the real offer instead of an
// apology. Written as plain text with bare URLs; ChatMessage linkifies them.

export const DEMO_MODE_REPLY = `I'm running in demo mode right now, so I can't dig into your business the way I normally would.

Here's the better version of this conversation anyway: 30 minutes with ${tenant.founder.name}, free. They'll look at how work comes into your business today, where it's leaking, and which parts a few AI teammates could take off your plate. You'll leave knowing what to do first, whether or not you ever hire us.

No catch. Nothing to buy, no contract, no pitch deck. Worst case, you understand your own business, and where AI actually fits in it, a lot better than you did this morning.

Pick a time: ${BOOKING_URL}
Or email ${tenant.founder.name} directly: ${CONTACT_EMAIL}`;

export const ERROR_REPLY = `Something went wrong on my end. Give it another try in a moment.

Or skip me entirely and take 30 minutes with ${tenant.founder.name}: ${BOOKING_URL}. It's free, there's no catch, and you'll leave with a plan for where AI fits in your business. Email works too: ${CONTACT_EMAIL}`;
