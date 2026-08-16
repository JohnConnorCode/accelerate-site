"use client";

import { useState } from "react";
import { Check, Loader2, X } from "lucide-react";

export function ProposalDecision({ token, status }: { token: string; status: string }) {
  const [decision, setDecision] = useState<"accepted" | "declined" | null>(["accepted", "declined"].includes(status) ? status as "accepted" | "declined" : null);
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const respond = async (next: "accepted" | "declined") => {
    if (next === "declined" && !reason.trim()) { setError("Please share a short reason so we can close the loop properly."); return; }
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/proposal/${encodeURIComponent(token)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision: next, reason: reason.trim() || undefined }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not record your response");
      setDecision(next); setDeclining(false);
    } catch (responseError) { setError(responseError instanceof Error ? responseError.message : "Could not record your response"); }
    finally { setLoading(false); }
  };
  if (decision) return <section className={`mt-12 rounded-2xl border p-6 text-center ${decision === "accepted" ? "border-emerald-400/25 bg-emerald-400/10" : "border-white/10 bg-white/[0.035]"}`}><span className={`mx-auto grid size-11 place-items-center rounded-full ${decision === "accepted" ? "bg-emerald-400 text-black" : "bg-white/10 text-white"}`}>{decision === "accepted" ? <Check className="size-5" /> : <X className="size-5" />}</span><h2 className="mt-4 text-xl font-semibold text-white">Proposal {decision}</h2><p className="mt-2 text-sm text-white/60">{decision === "accepted" ? "Thank you. John has been notified and will contact you with next steps." : "Thank you for the feedback. John has been notified and will close the loop personally."}</p></section>;
  return <section className="mt-12 rounded-2xl border border-white/10 bg-white/[0.035] p-6 sm:p-8"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-gold-light">Your decision</p><h2 className="mt-2 text-2xl font-semibold text-white">Ready to move forward?</h2><p className="mt-2 text-sm leading-6 text-white/60">Accepting confirms the proposed scope and starts a direct next-steps conversation. No payment is collected here.</p>{declining && <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} placeholder="What made this proposal not the right fit?" className="mt-5 w-full rounded-xl border border-white/15 bg-black/20 px-4 py-3 text-sm text-white outline-none transition-[border-color,box-shadow] focus:border-gold-light focus:ring-2 focus:ring-gold-light/10" />}{error && <p className="mt-3 text-sm text-rose-300">{error}</p>}<div className="mt-6 flex flex-col gap-3 sm:flex-row"><button type="button" onClick={() => void respond("accepted")} disabled={loading} className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-gold px-5 text-sm font-semibold text-black transition-[filter,transform,opacity] hover:brightness-105 active:scale-[0.96] disabled:opacity-50">{loading ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Accept proposal</button><button type="button" onClick={() => declining ? void respond("declined") : setDeclining(true)} disabled={loading} className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-white/15 px-5 text-sm font-semibold text-white transition-[background-color,transform,opacity] hover:bg-white/[0.06] active:scale-[0.96] disabled:opacity-50"><X className="size-4" /> {declining ? "Confirm decline" : "Decline"}</button></div></section>;
}
