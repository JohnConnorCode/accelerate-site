"use client";

import { FormEvent, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { CalendarDays, Check, Clipboard, Eye, EyeOff, KeyRound, Mail, PlugZap, RefreshCw, Unplug, type LucideIcon } from "lucide-react";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { AdminReadBody } from "@/components/admin/AdminReadBody";
import { AdminSurface } from "@/components/admin/AdminSurface";
import { LoadingSkeleton } from "@/components/admin/LoadingSkeleton";
import { fetchJson } from "@/lib/admin/fetchJson";
import { useAdminQuery } from "@/lib/admin/useAdminQuery";
import { toast } from "@/lib/admin/useToast";
import { cn } from "@/lib/utils";

type Provider = "resend" | "calendly";
interface ProviderConnection { id: string; provider: string; account_email: string | null; reply_to_email: string | null; status: string; credential_version: number; connected_at: string | null }

function formatConnectedAt(value: string | null | undefined) {
  if (!value) return "No successful connection yet";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "Connection time unavailable";
  return `Connected ${new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(date)}`;
}

export function TenantProviderControls() {
  const pathname = usePathname();
  const workspaceSlug = pathname.match(/^\/t\/([^/]+)\/admin/)?.[1] || "accelerate";
  const query = useAdminQuery<{ providers: ProviderConnection[] }>(["tenant", "providers"], "/api/admin/tenant/providers");
  const [busy, setBusy] = useState<Provider | null>(null);
  const [resendKey, setResendKey] = useState("");
  const [resendFromEmail, setResendFromEmail] = useState("");
  const [resendReplyToEmail, setResendReplyToEmail] = useState("");
  const [resendWebhook, setResendWebhook] = useState("");
  const [calendlyWebhook, setCalendlyWebhook] = useState("");
  const [disconnecting, setDisconnecting] = useState<Provider | null>(null);
  const [copied, setCopied] = useState<Provider | null>(null);
  const connection = (provider: Provider) => query.data?.providers.find((item) => item.provider === provider);

  const configure = async (event: FormEvent, provider: Provider) => {
    event.preventDefault();
    if (busy) return;
    setBusy(provider);
    try {
      await fetchJson("/api/admin/tenant/providers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(provider === "resend" ? { action: "configure_resend", apiKey: resendKey, fromEmail: resendFromEmail, replyToEmail: resendReplyToEmail, webhookSecret: resendWebhook || undefined } : { action: "configure_calendly", webhookSecret: calendlyWebhook }) });
      if (provider === "resend") { setResendKey(""); setResendFromEmail(""); setResendReplyToEmail(""); setResendWebhook(""); } else setCalendlyWebhook("");
      await query.refetch();
      toast.success(`${provider === "resend" ? "Resend" : "Calendly"} credentials saved for this workspace`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Provider configuration failed"); }
    finally { setBusy(null); }
  };

  const disconnect = async () => {
    if (!disconnecting || busy) return;
    const provider = disconnecting;
    setBusy(provider);
    try {
      await fetchJson("/api/admin/tenant/providers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "disconnect", provider }) });
      await query.refetch();
      setDisconnecting(null);
      toast.success(`${provider === "resend" ? "Resend" : "Calendly"} disconnected from this workspace`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Provider disconnect failed"); }
    finally { setBusy(null); }
  };

  const copyEndpoint = async (provider: Provider) => {
    const endpoint = `${window.location.origin}/api/public/${workspaceSlug}/webhooks/${provider}`;
    try {
      await navigator.clipboard.writeText(endpoint);
      setCopied(provider);
      window.setTimeout(() => setCopied((current) => current === provider ? null : current), 1800);
      toast.success(`${provider === "resend" ? "Resend" : "Calendly"} endpoint copied`);
    } catch { toast.error("Could not copy the webhook endpoint"); }
  };

  return <section aria-labelledby="workspace-provider-heading" className="space-y-4">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p className="admin-eyebrow">Workspace boundary</p><h2 id="workspace-provider-heading" className="mt-1 text-balance text-xl font-semibold tracking-[-0.025em] text-[var(--admin-ink)]">Provider credentials</h2><p className="admin-copy mt-1 max-w-2xl text-pretty text-sm">Encrypted credentials belong only to this workspace. Saved values never return to the browser, and every rotation creates a new version.</p></div><span className="w-fit rounded-[9px] bg-[var(--admin-soft)] px-2.5 py-1.5 font-mono text-[9px] text-[var(--admin-muted)] shadow-[var(--admin-shadow-border)]">{workspaceSlug}</span></div>
    <AdminReadBody loading={query.isLoading} hasData={Boolean(query.data)} error={query.error?.message} onRetry={() => void query.refetch()} refreshing={query.isFetching} loadingFallback={<div className="grid gap-4 xl:grid-cols-2"><LoadingSkeleton rows={4} /><LoadingSkeleton rows={4} /></div>} label="Loading workspace credentials">
      {query.data && <div className="grid gap-4 xl:grid-cols-2">
        <ProviderCard icon={Mail} name="Resend" detail="Outbound mail and signed delivery receipts" connection={connection("resend")} endpoint={`/api/public/${workspaceSlug}/webhooks/resend`} copied={copied === "resend"} onCopy={() => void copyEndpoint("resend")}>
          <form onSubmit={(event) => void configure(event, "resend")} className="space-y-4"><label className="block"><span className="text-xs font-medium text-[var(--admin-ink)]">Verified sender email</span><span className="admin-copy mt-0.5 block text-pretty text-[10px] leading-4">The Resend-verified identity recipients see in campaign email.</span><input required type="email" autoComplete="email" value={resendFromEmail} onChange={(event) => setResendFromEmail(event.target.value)} placeholder={connection("resend")?.account_email || "campaigns@yourdomain.com"} className="admin-field mt-1.5 min-h-11" /></label><label className="block"><span className="text-xs font-medium text-[var(--admin-ink)]">Reply-to inbox</span><span className="admin-copy mt-0.5 block text-pretty text-[10px] leading-4">A monitored inbox for prospect responses. Connect that inbox to Google Workspace so replies enter the recovery queue.</span><input required type="email" autoComplete="email" value={resendReplyToEmail} onChange={(event) => setResendReplyToEmail(event.target.value)} placeholder={connection("resend")?.reply_to_email || "owner@yourdomain.com"} className="admin-field mt-1.5 min-h-11" /></label><SecretField label="API key" description="Required for workspace-owned outbound sends." value={resendKey} onChange={setResendKey} placeholder="re_…" /><SecretField label="Webhook signing secret" description="Optional now; add it before enabling delivery receipts." value={resendWebhook} onChange={setResendWebhook} placeholder="Paste the signing secret" required={false} /><ProviderActions provider="resend" connected={connection("resend")?.status === "connected"} busy={busy === "resend"} disabled={Boolean(busy) || resendKey.length < 10 || !resendFromEmail.includes("@") || !resendReplyToEmail.includes("@") } onDisconnect={() => setDisconnecting("resend")} /></form>
        </ProviderCard>
        <ProviderCard icon={CalendarDays} name="Calendly" detail="Tenant-qualified booking events" connection={connection("calendly")} endpoint={`/api/public/${workspaceSlug}/webhooks/calendly`} copied={copied === "calendly"} onCopy={() => void copyEndpoint("calendly")}>
          <form onSubmit={(event) => void configure(event, "calendly")} className="space-y-4"><SecretField label="Webhook signing secret" description="Verifies every booking event before tenant lookup or mutation." value={calendlyWebhook} onChange={setCalendlyWebhook} placeholder="Paste the signing secret" /><ProviderActions provider="calendly" connected={connection("calendly")?.status === "connected"} busy={busy === "calendly"} disabled={Boolean(busy) || calendlyWebhook.length < 10} onDisconnect={() => setDisconnecting("calendly")} /></form>
        </ProviderCard>
      </div>}
    </AdminReadBody>

    <AdminDialog open={Boolean(disconnecting)} onClose={() => { if (!busy) setDisconnecting(null); }} title={`Disconnect ${disconnecting === "resend" ? "Resend" : "Calendly"}?`} maxWidth="sm">
      {disconnecting && <AdminSurface padding="lg" className="shadow-2xl"><span className="grid size-11 place-items-center rounded-[13px] bg-rose-500/10 text-rose-700 dark:text-rose-300"><Unplug className="size-5" /></span><h2 className="mt-4 text-balance text-lg font-semibold tracking-[-0.02em] text-[var(--admin-ink)]">Disconnect {disconnecting === "resend" ? "Resend" : "Calendly"}?</h2><p className="admin-copy mt-2 text-pretty text-sm leading-6">The encrypted credential will be revoked for this workspace. Historical provider receipts remain intact, and no other tenant is affected.</p><div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" disabled={Boolean(busy)} onClick={() => setDisconnecting(null)} className="admin-secondary-control min-h-11 px-4">Cancel</button><button type="button" disabled={Boolean(busy)} onClick={() => void disconnect()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[11px] bg-rose-700 px-4 text-xs font-semibold text-white transition-[background-color,opacity,transform] duration-150 hover:bg-rose-800 active:scale-[0.96] disabled:opacity-50">{busy === disconnecting && <RefreshCw className="size-3.5 animate-spin motion-reduce:animate-none" />}Disconnect provider</button></div></AdminSurface>}
    </AdminDialog>
  </section>;
}

function ProviderCard({ icon: Icon, name, detail, connection, endpoint, copied, onCopy, children }: { icon: LucideIcon; name: string; detail: string; connection?: ProviderConnection; endpoint: string; copied: boolean; onCopy: () => void; children: React.ReactNode }) {
  const connected = connection?.status === "connected";
  return <AdminSurface padding="none" className="overflow-hidden"><div className="p-5 sm:p-6"><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-start gap-3"><span className="relative grid size-11 shrink-0 place-items-center rounded-[13px] bg-[var(--admin-soft)] shadow-sm"><Icon className="size-[18px]" /><span className={cn("absolute -bottom-0.5 -right-0.5 size-3 rounded-full ring-[3px] ring-[var(--admin-surface)]", connected ? "bg-emerald-500" : "bg-black/25 dark:bg-white/30")} /></span><div className="min-w-0"><h3 className="text-balance font-semibold text-[var(--admin-ink)]">{name}</h3><p className="admin-copy mt-0.5 text-pretty text-xs">{detail}</p></div></div><span className={cn("shrink-0 rounded-full px-2.5 py-1 font-mono text-[9px] font-semibold uppercase tracking-[0.08em]", connected ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-black/[0.05] text-[var(--admin-muted)] dark:bg-white/[0.06]")}>{connected ? "Connected" : "Not connected"}</span></div>
      <div className="mt-4 grid grid-cols-[1fr_auto] items-center gap-2 rounded-[13px] bg-[var(--admin-soft)] p-2 pl-3 shadow-[var(--admin-shadow-border)]"><div className="min-w-0"><p className="font-mono text-[8px] font-semibold uppercase tracking-[0.11em] text-[var(--admin-muted)]">Signed webhook endpoint</p><p className="mt-1 truncate font-mono text-[10px] text-[var(--admin-ink)]">{endpoint}</p></div><button type="button" onClick={onCopy} className="grid size-10 place-items-center rounded-[10px] text-[var(--admin-muted)] transition-[background-color,color,transform] duration-150 hover:bg-[var(--admin-surface)] hover:text-[var(--admin-ink)] active:scale-[0.96]" aria-label={`Copy ${name} webhook endpoint`}><AnimatePresence initial={false} mode="popLayout"><motion.span key={copied ? "copied" : "copy"} initial={{ opacity: 0, scale: 0.25, filter: "blur(4px)" }} animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }} exit={{ opacity: 0, scale: 0.25, filter: "blur(4px)" }} transition={{ type: "spring", duration: 0.3, bounce: 0 }}>{copied ? <Check className="size-4 text-emerald-600" /> : <Clipboard className="size-4" />}</motion.span></AnimatePresence></button></div>
      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[9px] text-[var(--admin-muted)]"><span>{formatConnectedAt(connection?.connected_at)}</span>{connection && <><span className="size-1 rounded-full bg-current opacity-35" /><span className="tabular-nums">Credential v{connection.credential_version}</span></>}</div>
      <div className="mt-5">{children}</div></div></AdminSurface>;
}

function SecretField({ label, description, value, onChange, placeholder, required = true }: { label: string; description: string; value: string; onChange: (value: string) => void; placeholder: string; required?: boolean }) {
  const [visible, setVisible] = useState(false);
  return <label className="block"><span className="text-xs font-medium text-[var(--admin-ink)]">{label}</span><span className="admin-copy mt-0.5 block text-pretty text-[10px] leading-4">{description}</span><span className="relative mt-1.5 block"><KeyRound className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[var(--admin-muted)]" /><input type={visible ? "text" : "password"} autoComplete="new-password" required={required} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="admin-field min-h-11 !pl-10 !pr-11" /><button type="button" onClick={() => setVisible((current) => !current)} className="absolute right-0 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-[10px] text-[var(--admin-muted)] transition-[color,transform] duration-150 hover:text-[var(--admin-ink)] active:scale-[0.96]" aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`}>{visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></span></label>;
}

function ProviderActions({ provider, connected, busy, disabled, onDisconnect }: { provider: Provider; connected: boolean; busy: boolean; disabled: boolean; onDisconnect: () => void }) {
  return <div className="flex flex-col gap-2 sm:flex-row"><button disabled={disabled} className="admin-action-control min-h-11 flex-1 px-3.5">{busy ? <RefreshCw className="size-3.5 animate-spin motion-reduce:animate-none" /> : <PlugZap className="size-3.5" />}{connected ? "Rotate credentials" : `Connect ${provider === "resend" ? "Resend" : "Calendly"}`}</button>{connected && <button type="button" disabled={Boolean(busy)} onClick={onDisconnect} className="admin-secondary-control min-h-11 px-3.5"><Unplug className="size-3.5" />Disconnect</button>}</div>;
}
