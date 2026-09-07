# Roofing opportunity machine setup

The roofing funnel launches in manual-review mode by default. Qualified prospects submit an audit request, receive confirmation, appear in the admin opportunity pipeline, and get a personal reply from John. Calendly is optional and can be enabled later without changing the campaign page.

## 1. Database

Run `migrations/roofing-booking-machine.sql` in the Accelerate Supabase SQL editor after the existing business operating system and UTM migrations.

## 2. Required launch configuration

The `/admin/setup` page checks the running deployment and gives the exact next step for each item. Required configuration is:

- Supabase URL, anonymous key, and service-role key
- `migrations/roofing-booking-machine.sql`
- Resend API key and verified sender
- Owner notification email
- Production site URL
- Plausible domain and API key

Use `/admin/setup` as the source of truth after every deploy. It reports whether the environment is actually ready without exposing credential values.

## 3. Tenant-owned booking mode

`src/lib/booking.ts` is the one public booking mode. Tenant config owns the default:

- **embed** when `tenant.capabilities.publicBooking` is true and `tenant.booking.schedulerUrl` is set
- **manual** when public booking is off or no scheduler URL is configured
- **disabled** only when `CALENDLY_ENABLED=false` (emergency pause of an existing embed)

`CALENDLY_ENABLED=true` is not an activation switch and is ignored. Leaving the variable unset does not force manual mode.

In **manual** or **disabled**, the qualified flow is:

1. Prospect completes the fit gate on `/roofing`.
2. The system creates or updates one canonical opportunity with campaign attribution.
3. The prospect receives a confirmation email.
4. `ADMIN_EMAIL` receives the new request and the opportunity appears in `/admin/bookings`.
5. The founder reviews the company and replies personally with a recommendation and meeting times.

## 4. Optional Calendly attribution

The public embed does not require a Calendly API token. Attribution is a separate optional path. Do not describe the embed as verified attribution.

1. Keep the tenant scheduler URL and `publicBooking` on if the public embed should render.
2. Create a long random value for `CALENDLY_WEBHOOK_SECRET` and add it to Vercel.
3. Create a user-scoped webhook subscription for `invitee.created` and `invitee.canceled` using this callback:

   `https://www.acceleratewith.us/api/webhooks/calendly?secret=<CALENDLY_WEBHOOK_SECRET>`

4. Submit a qualified test request at `/roofing`, book and cancel a test event, and confirm the single opportunity progresses through `qualified → calendar_viewed → booked → qualified` in `/admin/bookings`.
5. Setup Center marks Calendly attribution Ready only after a fresh signed booking or cancellation receipt. A personal access token without that receipt is not Ready.

Calendly sends both a cancel and a create event during rescheduling. The webhook matches the invitee URI so a late cancellation for the old event cannot overwrite the new booking.

To pause the public embed without changing tenant config, set `CALENDLY_ENABLED=false` and redeploy. Manual scheduling stays usable.

## Campaign links

Use a distinct campaign and message variant in founder outreach. Example:

`https://www.acceleratewith.us/roofing?utm_source=founder_outbound&utm_medium=email&utm_campaign=chicago_roofing_q3&utm_content=slow_response_v1`

Keep one variable per experiment. The admin booking view reports the source and campaign stored when the prospect first enters the funnel.
