"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "@/components/admin/AdminLink";
import { PageHeader } from "@/components/admin/PageHeader";
import { fetchJson } from "@/lib/admin/fetchJson";
import { useAdminQuery } from "@/lib/admin/useAdminQuery";
import { toast } from "@/lib/admin/useToast";
import { DEBATE_MILESTONES, type DebateMilestone } from "@/lib/revenue-os/debate-booking-contract";

type Contact = { id: string; full_name: string; primary_email: string | null };
type Milestone = {
  milestone: DebateMilestone;
  status: string;
  value: string;
  source_type: string;
  source_id: string;
  observed_at: string;
  claim_id: string;
};
type Booking = {
  production: {
    id: string; title: string; lead_contact_id: string; counterpart_contact_id: string | null;
    target_at: string | null; revision: number; calendar_event_id: string | null; updated_at: string;
  };
  contacts: Contact[];
  milestones: Milestone[];
  claims: Array<{ id: string; status: string }>;
  calendar: { html_link: string | null; attendees: Array<{ email: string; responseStatus?: string }>;
    status: string; synced_at: string; metadata?: { debate_verified_at?: string } } | null;
  nextAction: { kind: string; milestone: DebateMilestone | null; reason: string; booked: boolean };
  acceptanceMessages?: Array<{ id: string; sender_email: string; body_text: string | null;
    received_at: string | null; conversation_id: string }>;
  sourceLinks?: Record<string, string>;
};

function label(value: string) { return value.replaceAll("_", " "); }
function dateInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}
function ContactField({ title, value, onChange }: {
  title: string; value: string; onChange: (value: string) => void;
}) {
  const [search, setSearch] = useState("");
  const contacts = useAdminQuery<{ contacts: Contact[] }>(
    ["debate-contact-search", title, search],
    `/api/admin/contacts/directory?${new URLSearchParams({ search })}`,
  );
  return <label className="grid gap-1 text-sm font-medium">
    {title}
    <input className="admin-input" value={search} onChange={(event) => setSearch(event.target.value)}
      placeholder="Search a name or email" />
    <select className="admin-input" value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">Select a contact</option>
      {(contacts.data?.contacts ?? []).map((contact) => <option key={contact.id} value={contact.id}>
        {contact.full_name} · {contact.primary_email || "No email"}
      </option>)}
      {value && !(contacts.data?.contacts ?? []).some((contact) => contact.id === value) &&
        <option value={value}>Current contact</option>}
    </select>
  </label>;
}

export default function DebateProductionsPage() {
  const router = useRouter();
  const selectedId = useSearchParams().get("production");
  const list = useAdminQuery<Booking[]>(["debate-productions"], "/api/admin/revenue-os/debates");
  const detail = useAdminQuery<Booking>(["debate-production", selectedId],
    `/api/admin/revenue-os/debates?id=${encodeURIComponent(selectedId ?? "")}`,
    { enabled: Boolean(selectedId) });
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [leadId, setLeadId] = useState("");
  const [counterpartId, setCounterpartId] = useState("");
  const [targetAt, setTargetAt] = useState("");
  const [editCounterpartId, setEditCounterpartId] = useState("");
  const [editTargetAt, setEditTargetAt] = useState("");
  const [milestone, setMilestone] = useState<DebateMilestone>("topic_interest");
  const [status, setStatus] = useState("verified");
  const [value, setValue] = useState("");
  const [sourceType, setSourceType] = useState("gmail_message");
  const [sourceId, setSourceId] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [timeZone, setTimeZone] = useState("");
  const [description, setDescription] = useState("");
  const [firstAcceptance, setFirstAcceptance] = useState("");
  const [secondAcceptance, setSecondAcceptance] = useState("");
  const [createMeet, setCreateMeet] = useState(true);
  const booking = detail.data;
  useEffect(() => {
    setEditCounterpartId(booking?.production.counterpart_contact_id ?? "");
    setEditTargetAt(dateInput(booking?.production.target_at ?? null));
  }, [booking?.production.id, booking?.production.revision, booking?.production.counterpart_contact_id,
    booking?.production.target_at]);
  useEffect(() => {
    setStartAt("");
    setEndAt("");
    setDescription("");
    setFirstAcceptance("");
    setSecondAcceptance("");
  }, [selectedId]);
  useEffect(() => { setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone); }, []);
  const lead = booking?.contacts.find((contact) => contact.id === booking.production.lead_contact_id);
  const counterpart = booking?.contacts.find((contact) => contact.id === booking.production.counterpart_contact_id);
  const claimStatus = new Map(booking?.claims.map((claim) => [claim.id, claim.status]));

  async function submit(operation: () => Promise<unknown>, success: string) {
    setBusy(true);
    try {
      await operation();
      toast.success(success);
      await Promise.all([list.refetch(), detail.refetch()]);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not save booking"); }
    finally { setBusy(false); }
  }
  function patch(body: Record<string, unknown>) {
    return fetchJson("/api/admin/revenue-os/debates", {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
  }
  const messages = booking?.acceptanceMessages ?? [];
  function messagesFor(email: string | null | undefined) {
    return messages.filter((message) => message.sender_email?.toLowerCase() === email?.toLowerCase());
  }
  return <div className="space-y-5 pb-10">
    <PageHeader title="Debate productions" subtitle="One record for each commitment, source, invitation and next blocker." />
    <div className="grid gap-5 xl:grid-cols-[minmax(260px,1fr)_minmax(0,2fr)]">
      <section className="admin-surface space-y-4 p-5">
        <h2 className="text-lg font-semibold">Productions</h2>
        {list.isPending && <p>Loading productions…</p>}
        {list.error && <p role="alert">{list.error.message}</p>}
        {(list.data ?? []).map((item) => <Link key={item.production.id}
          href={`/admin/debates?production=${item.production.id}`}
          className="block rounded-lg border border-[var(--admin-border)] p-3 hover:shadow-sm">
          <strong className="block">{item.production.title}</strong>
          <span className="text-sm text-[var(--admin-muted)]">{item.nextAction.reason}</span>
        </Link>)}
        <form className="space-y-3 border-t border-[var(--admin-border)] pt-4" onSubmit={(event) => {
          event.preventDefault();
          void submit(async () => {
            const result = await fetchJson<{ id: string }>("/api/admin/revenue-os/debates", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ requestKey: crypto.randomUUID(), title, leadContactId: leadId,
                counterpartContactId: counterpartId || null,
                targetAt: targetAt ? new Date(targetAt).toISOString() : null }),
            });
            router.push(`/admin/debates?production=${result.id}`);
          }, "Production created");
        }}>
          <h3 className="font-semibold">New production</h3>
          <label className="grid gap-1 text-sm">Question or working title
            <input className="admin-input" required value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <ContactField title="Lead participant" value={leadId} onChange={setLeadId} />
          <ContactField title="Counterpart, if known" value={counterpartId} onChange={setCounterpartId} />
          <label className="grid gap-1 text-sm">Proposed date and time
            <input className="admin-input" type="datetime-local" value={targetAt}
              onChange={(event) => setTargetAt(event.target.value)} />
          </label>
          <button className="admin-button admin-button--primary" disabled={busy || !leadId}>Create production</button>
        </form>
      </section>
      <main className="space-y-5">
        {!selectedId && <section className="admin-surface p-6">Select a production to inspect its commitments.</section>}
        {selectedId && detail.error && <section className="admin-surface p-6" role="alert">{detail.error.message}</section>}
        {booking && <>
          <section className="admin-surface space-y-3 p-6">
            <h2 className="text-xl font-semibold">{booking.production.title}</h2>
            <p>{lead?.full_name} ({lead?.primary_email || "address missing"}) and {counterpart?.full_name || "counterpart undecided"}{counterpart?.primary_email ? ` (${counterpart.primary_email})` : ""}</p>
            <p className="font-medium">Next: {booking.nextAction.reason}</p>
            <p className="text-sm text-[var(--admin-muted)]">{booking.nextAction.booked ? "Booking confirmed" : "Booking incomplete"} · Target {booking.production.target_at ? new Date(booking.production.target_at).toLocaleString() : "not set"}</p>
            {booking.calendar && <p className="text-sm">Calendar: {booking.calendar.status} · checked {booking.calendar.metadata?.debate_verified_at
              ? new Date(booking.calendar.metadata.debate_verified_at).toLocaleString() : "not yet"}
              {booking.calendar.html_link && <> · <a href={booking.calendar.html_link} target="_blank" rel="noreferrer" className="underline">Open event</a></>}
              <br />{booking.calendar.attendees.map((attendee) => `${attendee.email}: ${attendee.responseStatus || "unknown"}`).join(" · ")}</p>}
            {booking.calendar && <button type="button" className="admin-button admin-button--secondary" disabled={busy}
              onClick={() => void submit(() => patch({ operation: "verify_calendar", productionId: booking.production.id }),
                "Current Google invitation verified")}>
              Check invitation in Google Calendar
            </button>}
            {booking.calendar?.status === "cancelled" && <button type="button"
              className="admin-button admin-button--secondary" disabled={busy}
              onClick={() => void submit(() => patch({ operation: "reopen_cancelled_invitation",
                productionId: booking.production.id, expectedRevision: booking.production.revision }),
              "Canceled invitation recorded; prepare a replacement")}>
              Reopen canceled invitation
            </button>}
          </section>
          <section className="admin-surface space-y-3 p-6">
            <h2 className="text-lg font-semibold">Pairing and date</h2>
            <p className="text-sm text-[var(--admin-muted)]">Confirmed milestones protect the pairing and date. Record a cited cancellation before changing either.</p>
            <form className="grid gap-3 md:grid-cols-2" onSubmit={(event) => {
              event.preventDefault();
              void submit(() => patch({ operation: "update", productionId: booking.production.id,
                expectedRevision: booking.production.revision,
                counterpartContactId: editCounterpartId || null,
                targetAt: editTargetAt ? new Date(editTargetAt).toISOString() : null }),
              "Pairing and date saved");
            }}>
              <ContactField title="Counterpart" value={editCounterpartId} onChange={setEditCounterpartId} />
              <label className="grid gap-1 text-sm">Debate date and time
                <input className="admin-input" type="datetime-local" value={editTargetAt}
                  onChange={(event) => setEditTargetAt(event.target.value)} /></label>
              <button className="admin-button admin-button--secondary md:col-span-2" disabled={busy}>Save pairing and date</button>
            </form>
          </section>
          <section className="admin-surface space-y-3 p-6">
            <h2 className="text-lg font-semibold">Commitments and evidence</h2>
            <div className="grid gap-2 md:grid-cols-2">
              {DEBATE_MILESTONES.map((key) => {
                const item = booking.milestones.find((row) => row.milestone === key);
                return <div key={key} className="rounded-lg border border-[var(--admin-border)] p-3 text-sm">
                  <strong className="capitalize">{label(key)}</strong> · {item?.status || "missing"}
                  {item && <><p>{item.value}</p><p className="text-[var(--admin-muted)]">{item.source_type}: {item.source_id} · {new Date(item.observed_at).toLocaleString()} · claim {claimStatus.get(item.claim_id) || "unavailable"}</p>
                    {booking.sourceLinks?.[item.source_id] && <a href={booking.sourceLinks[item.source_id]}
                      className="underline" target="_blank" rel="noreferrer">Open source</a>}</>}
                </div>;
              })}
            </div>
            <form className="grid gap-3 border-t border-[var(--admin-border)] pt-4 md:grid-cols-2" onSubmit={(event) => {
              event.preventDefault();
              void submit(() => patch({ operation: "milestone", productionId: booking.production.id,
                milestone, status, value, sourceType, sourceId,
                observedAt: new Date().toISOString() }), "Milestone recorded");
            }}>
              <select className="admin-input" value={milestone} onChange={(event) => setMilestone(event.target.value as DebateMilestone)}>
                {DEBATE_MILESTONES.filter((key) => key !== "invitation").map((key) => <option key={key} value={key}>{label(key)}</option>)}
              </select>
              <select className="admin-input" value={status} onChange={(event) => setStatus(event.target.value)}>
                {["proposed", "verified", "declined", "cancelled"].map((item) => <option key={item}>{item}</option>)}
              </select>
              <input className="admin-input md:col-span-2" required placeholder="Exact commitment or decision" value={value} onChange={(event) => setValue(event.target.value)} />
              <select className="admin-input" value={sourceType} onChange={(event) => setSourceType(event.target.value)}>
                {["gmail_message", "drive_document", "founder_note", "uploaded_document", "founder_confirmation"].map((item) => <option key={item} value={item}>{label(item)}</option>)}
              </select>
              <input className="admin-input" required={sourceType !== "founder_confirmation"}
                placeholder={sourceType === "founder_confirmation" ? "Reviewer identity added automatically" : "Source record ID"}
                disabled={sourceType === "founder_confirmation"} value={sourceId} onChange={(event) => setSourceId(event.target.value)} />
              <button className="admin-button admin-button--primary md:col-span-2" disabled={busy}>Record cited milestone</button>
            </form>
          </section>
          {!booking.production.calendar_event_id && <section className="admin-surface space-y-3 p-6">
            <h2 className="text-lg font-semibold">Prepare exact invitation</h2>
            <p className="text-sm">The <Link href="/admin/today" className="underline">Today approval queue</Link> will show the time, recipients, message and both acceptance sources. Approval sends the invitation.</p>
            <form className="grid gap-3 md:grid-cols-2" onSubmit={(event) => {
              event.preventDefault();
              void submit(() => patch({ operation: "invite", productionId: booking.production.id,
                expectedRevision: booking.production.revision, summary: booking.production.title,
                description, startAt: new Date(startAt || dateInput(booking.production.target_at)).toISOString(), endAt: new Date(endAt).toISOString(),
                timeZone, createMeet, acceptanceMessageIds: [firstAcceptance, secondAcceptance] }),
              "Exact invitation staged in Today for approval");
            }}>
              <label className="grid gap-1 text-sm">Start
                <input className="admin-input" type="datetime-local" required value={startAt || dateInput(booking.production.target_at)}
                  onChange={(event) => setStartAt(event.target.value)} /></label>
              <label className="grid gap-1 text-sm">End
                <input className="admin-input" type="datetime-local" required value={endAt}
                  onChange={(event) => setEndAt(event.target.value)} /></label>
              <label className="grid gap-1 text-sm">Timezone
                <output className="admin-input">{timeZone} (your local time)</output></label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={createMeet}
                onChange={(event) => setCreateMeet(event.target.checked)} /> Add Google Meet</label>
              <label className="grid gap-1 text-sm md:col-span-2">Invitation details
                <textarea className="admin-input min-h-28" required value={description}
                  onChange={(event) => setDescription(event.target.value)} /></label>
              {[lead, counterpart].map((person, index) => <label key={index} className="grid gap-1 text-sm">
                {person?.full_name || "Missing participant"} acceptance message
                <select className="admin-input" required value={index === 0 ? firstAcceptance : secondAcceptance}
                  onChange={(event) => index === 0 ? setFirstAcceptance(event.target.value) : setSecondAcceptance(event.target.value)}>
                  <option value="">Select a cited inbound message</option>
                  {messagesFor(person?.primary_email).map((message) => <option key={message.id} value={message.id}>
                    {message.received_at ? new Date(message.received_at).toLocaleDateString() : "Date unknown"} · {message.body_text?.slice(0, 100)}
                  </option>)}
                </select>
              </label>)}
              <button className="admin-button admin-button--primary md:col-span-2" disabled={busy || !lead || !counterpart || !timeZone}>Stage invitation for approval</button>
            </form>
          </section>}
        </>}
      </main>
    </div>
  </div>;
}
