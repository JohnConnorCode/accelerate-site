"use client";

import { FormEvent, useCallback, useMemo, useState } from "react";
import {
  Archive,
  Building2,
  CheckCircle2,
  CirclePause,
  CirclePlay,
  ExternalLink,
  MailPlus,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  UserMinus,
  Users,
} from "lucide-react";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { AdminReadBody } from "@/components/admin/AdminReadBody";
import { AdminSurface } from "@/components/admin/AdminSurface";
import { LoadingSkeleton } from "@/components/admin/LoadingSkeleton";
import { PageHeader } from "@/components/admin/PageHeader";
import { fetchJson } from "@/lib/admin/fetchJson";
import { useAdminQuery } from "@/lib/admin/useAdminQuery";
import { toast } from "@/lib/admin/useToast";
import { cn } from "@/lib/utils";

type TenantStatus = "provisioning" | "active" | "suspended" | "archived";
type TenantFilter = "all" | TenantStatus;

interface TenantRow {
  id: string;
  slug: string;
  name: string;
  status: TenantStatus;
  created_at: string;
}
interface MembershipRow {
  id: string;
  tenant_id: string;
  user_id: string;
  invited_email: string;
  status: "invited" | "active" | "revoked";
  invited_at?: string;
}
interface TenantDirectory {
  isPlatformAdmin: boolean;
  platformOwnerUserId: string | null;
  tenants: TenantRow[];
  memberships: MembershipRow[];
}
interface Confirmation {
  title: string;
  detail: string;
  actionLabel: string;
  tone: "danger" | "warning";
  key: string;
  body: Record<string, unknown>;
  successMessage: string;
}
interface MutationResult {
  warning?: string | null;
  operatorMessage?: string;
}

const statusMeta: Record<
  TenantStatus,
  { label: string; dot: string; chip: string; description: string }
> = {
  active: {
    label: "Active",
    dot: "bg-emerald-500",
    chip: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    description: "Members and tenant operations are enabled.",
  },
  provisioning: {
    label: "Provisioning",
    dot: "bg-sky-500",
    chip: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
    description: "Configuration is being reviewed before activation.",
  },
  suspended: {
    label: "Suspended",
    dot: "bg-amber-500",
    chip: "bg-amber-500/12 text-amber-800 dark:text-amber-300",
    description: "Access, jobs, ingest, and provider effects are paused.",
  },
  archived: {
    label: "Archived",
    dot: "bg-black/25 dark:bg-white/30",
    chip: "bg-black/[0.05] text-[var(--admin-muted)] dark:bg-white/[0.06]",
    description: "Data is retained, but this workspace cannot operate.",
  },
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
function formatDate(value?: string) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? "Date unavailable"
    : new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(date);
}

export default function TenantDirectoryPage() {
  const query = useAdminQuery<TenantDirectory>(["platform", "tenants"], "/api/admin/tenants");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [inviteEmails, setInviteEmails] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<TenantFilter>("all");
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);

  const mutate = useCallback(
    async (body: Record<string, unknown>, key: string, successMessage: string) => {
      if (busy) return false;
      setBusy(key);
      try {
        const result = await fetchJson<MutationResult>("/api/admin/tenants", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        await query.refetch();
        if (result.warning) toast.warning(result.warning);
        else toast.success(result.operatorMessage || successMessage);
        return result;
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Tenant action failed. Try again.");
        return null;
      } finally {
        setBusy(null);
      }
    },
    [busy, query],
  );

  const createTenant = async (event: FormEvent) => {
    event.preventDefault();
    const created = await mutate(
      {
        action: "create",
        name,
        slug,
        adminEmail: adminEmail || undefined,
        requestId: crypto.randomUUID(),
      },
      "create",
      `${name} was created in provisioning`,
    );
    if (!created) return;
    setName("");
    setSlug("");
    setSlugEdited(false);
    setAdminEmail("");
  };

  const membershipsByTenant = useMemo(() => {
    const grouped = new Map<string, MembershipRow[]>();
    for (const membership of query.data?.memberships || [])
      grouped.set(membership.tenant_id, [...(grouped.get(membership.tenant_id) || []), membership]);
    return grouped;
  }, [query.data?.memberships]);

  const counts = useMemo(() => {
    const tenants = query.data?.tenants || [];
    return {
      total: tenants.length,
      active: tenants.filter((item) => item.status === "active").length,
      review: tenants.filter((item) => item.status === "provisioning").length,
      paused: tenants.filter((item) => item.status === "suspended" || item.status === "archived")
        .length,
      admins: (query.data?.memberships || []).filter((item) => item.status === "active").length,
    };
  }, [query.data]);

  const visibleTenants = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (query.data?.tenants || []).filter((tenant) => {
      const members = membershipsByTenant.get(tenant.id) || [];
      const haystack = [tenant.name, tenant.slug, ...members.map((item) => item.invited_email)]
        .join(" ")
        .toLowerCase();
      return (
        (filter === "all" || tenant.status === filter) && (!needle || haystack.includes(needle))
      );
    });
  }, [filter, membershipsByTenant, query.data?.tenants, search]);

  const confirmAction = async () => {
    if (!confirmation) return;
    const completed = await mutate(
      confirmation.body,
      confirmation.key,
      confirmation.successMessage,
    );
    if (completed) setConfirmation(null);
  };

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        eyebrow="Platform control"
        title="Tenant operations"
        subtitle="Provision shared-database workspaces, govern access, and pause every tenant-owned effect from one control plane."
      />
      <AdminReadBody
        loading={query.isLoading}
        hasData={Boolean(query.data)}
        error={query.error?.message}
        onRetry={() => void query.refetch()}
        refreshing={query.isFetching}
        loadingFallback={<LoadingSkeleton variant="page" />}
      >
        {query.data ? (
          !query.data.isPlatformAdmin ? (
            <AdminSurface padding="lg">
              <p className="admin-copy">Platform access is restricted.</p>
            </AdminSurface>
          ) : (
            <>
              <section
                aria-label="Tenant summary"
                className="grid grid-cols-2 gap-3 lg:grid-cols-4"
              >
                {[
                  {
                    label: "Active workspaces",
                    value: counts.active,
                    detail: `${counts.total} total`,
                    tone: "text-emerald-700 dark:text-emerald-300",
                  },
                  {
                    label: "Awaiting review",
                    value: counts.review,
                    detail: "Provisioning",
                    tone: "text-sky-700 dark:text-sky-300",
                  },
                  {
                    label: "Paused",
                    value: counts.paused,
                    detail: "Suspended or archived",
                    tone: counts.paused
                      ? "text-amber-700 dark:text-amber-300"
                      : "text-[var(--admin-ink)]",
                  },
                  {
                    label: "Active admins",
                    value: counts.admins,
                    detail: "Across all tenants",
                    tone: "text-[var(--admin-ink)]",
                  },
                ].map((metric) => (
                  <AdminSurface key={metric.label} padding="md">
                    <p className="admin-eyebrow">{metric.label}</p>
                    <p
                      className={cn(
                        "mt-2 font-mono text-3xl font-semibold tabular-nums tracking-[-0.045em]",
                        metric.tone,
                      )}
                    >
                      {metric.value}
                    </p>
                    <p className="admin-copy mt-1 text-xs">{metric.detail}</p>
                  </AdminSurface>
                ))}
              </section>

              <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_23rem]">
                <section
                  aria-labelledby="workspace-directory-heading"
                  className="min-w-0 space-y-3"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2
                        id="workspace-directory-heading"
                        className="text-balance text-lg font-semibold tracking-[-0.02em] text-[var(--admin-ink)]"
                      >
                        Workspace directory
                      </h2>
                      <p className="admin-copy mt-1 text-xs">
                        Search by workspace, slug, or administrator.
                      </p>
                    </div>
                    <label className="relative block w-full sm:max-w-xs">
                      <span className="sr-only">Search tenants</span>
                      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--admin-muted)]" />
                      <input
                        type="search"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        className="admin-field min-h-11 !pl-10"
                        placeholder="Search workspaces"
                      />
                    </label>
                  </div>
                  <div
                    className="scrollbar-hide flex gap-1 overflow-x-auto pb-1"
                    aria-label="Filter tenants"
                  >
                    {(
                      [
                        ["all", "All", counts.total],
                        ["active", "Active", counts.active],
                        ["provisioning", "Provisioning", counts.review],
                        [
                          "suspended",
                          "Suspended",
                          query.data.tenants.filter((item) => item.status === "suspended").length,
                        ],
                        [
                          "archived",
                          "Archived",
                          query.data.tenants.filter((item) => item.status === "archived").length,
                        ],
                      ] as Array<[TenantFilter, string, number]>
                    ).map(([id, label, count]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setFilter(id)}
                        aria-pressed={filter === id}
                        className={cn(
                          "inline-flex min-h-10 shrink-0 items-center gap-2 rounded-[10px] px-3 text-xs font-semibold transition-[background-color,color,box-shadow,transform] duration-150 active:scale-[0.96]",
                          filter === id
                            ? "bg-[var(--admin-ink)] text-[var(--admin-surface)] shadow-sm"
                            : "text-[var(--admin-muted)] shadow-[var(--admin-shadow-border)] hover:text-[var(--admin-ink)] hover:shadow-[var(--admin-shadow-border-hover)]",
                        )}
                      >
                        <span>{label}</span>
                        <span className="font-mono text-[9px] tabular-nums opacity-70">
                          {count}
                        </span>
                      </button>
                    ))}
                  </div>

                  {visibleTenants.map((tenant) => {
                    const members = membershipsByTenant.get(tenant.id) || [];
                    const activeMembers = members.filter((item) => item.status === "active").length;
                    const invitedMembers = members.filter(
                      (item) => item.status === "invited",
                    ).length;
                    const meta = statusMeta[tenant.status];
                    const canInvite =
                      tenant.status === "active" || tenant.status === "provisioning";
                    return (
                      <AdminSurface
                        key={tenant.id}
                        padding="none"
                        className="overflow-hidden transition-[box-shadow] duration-200 hover:shadow-[var(--admin-shadow-hover)]"
                      >
                        <div className="p-4 sm:p-5">
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div className="flex min-w-0 items-start gap-3.5">
                              <span className="relative grid size-11 shrink-0 place-items-center rounded-[13px] bg-[var(--admin-soft)] shadow-sm">
                                <Building2 className="size-[18px]" />
                                <span
                                  className={cn(
                                    "absolute -bottom-0.5 -right-0.5 size-3 rounded-full ring-[3px] ring-[var(--admin-surface)]",
                                    meta.dot,
                                  )}
                                  aria-hidden="true"
                                />
                              </span>
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h3 className="text-balance text-base font-semibold tracking-[-0.02em] text-[var(--admin-ink)]">
                                    {tenant.name}
                                  </h3>
                                  <span
                                    className={cn(
                                      "rounded-full px-2.5 py-1 font-mono text-[9px] font-semibold uppercase tracking-[0.08em]",
                                      meta.chip,
                                    )}
                                  >
                                    {meta.label}
                                  </span>
                                </div>
                                <p className="mt-1 font-mono text-[10px] text-[var(--admin-muted)]">
                                  /t/{tenant.slug}/admin
                                </p>
                                <p className="admin-copy mt-2 text-pretty text-xs">
                                  {meta.description}
                                </p>
                              </div>
                            </div>
                            <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                              {tenant.status === "active" && (
                                <a
                                  href={`/t/${tenant.slug}/admin/today`}
                                  className="admin-action-control min-h-10 px-3.5"
                                >
                                  Enter workspace <ExternalLink className="size-3.5" />
                                </a>
                              )}
                              {tenant.status === "active" && tenant.slug !== "accelerate" && (
                                <button
                                  type="button"
                                  disabled={Boolean(busy)}
                                  onClick={() =>
                                    setConfirmation({
                                      title: `Suspend ${tenant.name}?`,
                                      detail:
                                        "Members will lose access immediately. Scheduled jobs, public ingest, and provider effects will pause while all data and receipts remain intact.",
                                      actionLabel: "Suspend workspace",
                                      tone: "warning",
                                      key: tenant.id,
                                      body: { action: "suspend", tenantId: tenant.id },
                                      successMessage: `${tenant.name} was suspended`,
                                    })
                                  }
                                  className="admin-secondary-control min-h-10 px-3"
                                >
                                  <CirclePause className="size-3.5" />
                                  Suspend
                                </button>
                              )}
                              {(tenant.status === "provisioning" ||
                                tenant.status === "suspended") && (
                                <button
                                  type="button"
                                  disabled={Boolean(busy)}
                                  onClick={() =>
                                    void mutate(
                                      { action: "activate", tenantId: tenant.id },
                                      tenant.id,
                                      `${tenant.name} is active`,
                                    )
                                  }
                                  className="admin-secondary-control min-h-10 px-3"
                                >
                                  <CirclePlay className="size-3.5" />
                                  Activate
                                </button>
                              )}
                              {(tenant.status === "provisioning" ||
                                tenant.status === "suspended") &&
                                tenant.slug !== "accelerate" && (
                                  <button
                                    type="button"
                                    disabled={Boolean(busy)}
                                    onClick={() =>
                                      setConfirmation({
                                        title: `Archive ${tenant.name}?`,
                                        detail:
                                          "The workspace will remain preserved for audit and recovery, but it cannot be reactivated from this control plane.",
                                        actionLabel: "Archive workspace",
                                        tone: "danger",
                                        key: tenant.id,
                                        body: { action: "archive", tenantId: tenant.id },
                                        successMessage: `${tenant.name} was archived`,
                                      })
                                    }
                                    className="admin-secondary-control min-h-10 px-3"
                                  >
                                    <Archive className="size-3.5" />
                                    Archive
                                  </button>
                                )}
                            </div>
                          </div>
                          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[var(--admin-line)] pt-3 text-xs text-[var(--admin-muted)]">
                            <span className="inline-flex items-center gap-1.5">
                              <Users className="size-3.5" />
                              {activeMembers} active admin{activeMembers === 1 ? "" : "s"}
                            </span>
                            {invitedMembers > 0 && (
                              <span className="inline-flex items-center gap-1.5">
                                <MailPlus className="size-3.5" />
                                {invitedMembers} invitation{invitedMembers === 1 ? "" : "s"} pending
                              </span>
                            )}
                            <span className="ml-auto font-mono text-[9px] tabular-nums">
                              Created {formatDate(tenant.created_at)}
                            </span>
                          </div>
                        </div>
                        <div className="bg-black/[0.018] px-4 py-4 dark:bg-white/[0.018] sm:px-5">
                          {members.length > 0 && (
                            <div className="grid gap-2 sm:grid-cols-2">
                              {members.map((membership) => (
                                <div
                                  key={membership.id}
                                  className="flex min-h-11 items-center justify-between gap-3 rounded-[12px] bg-[var(--admin-surface)] py-1 pl-3 pr-1 shadow-[var(--admin-shadow-border)]"
                                >
                                  <span className="min-w-0 truncate text-xs font-medium">
                                    {membership.invited_email}
                                  </span>
                                  <div className="flex shrink-0 items-center gap-1">
                                    <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-[var(--admin-muted)]">
                                      {membership.status}
                                    </span>
                                    {membership.status === "invited" && (
                                      <button
                                        type="button"
                                        disabled={Boolean(busy)}
                                        onClick={() =>
                                          void mutate(
                                            {
                                              action: "invite",
                                              tenantId: tenant.id,
                                              adminEmail: membership.invited_email,
                                              requestId: crypto.randomUUID(),
                                            },
                                            `resend-${membership.id}`,
                                            `Invitation sent to ${membership.invited_email}`,
                                          )
                                        }
                                        className="grid size-10 place-items-center rounded-[10px] text-[var(--admin-muted)] transition-[background-color,color,transform] duration-150 hover:bg-[var(--admin-soft)] hover:text-[var(--admin-ink)] active:scale-[0.96] disabled:opacity-50"
                                        aria-label={`Resend invitation to ${membership.invited_email}`}
                                      >
                                        {busy === `resend-${membership.id}` ? (
                                          <RefreshCw className="size-3.5 animate-spin motion-reduce:animate-none" />
                                        ) : (
                                          <MailPlus className="size-3.5" />
                                        )}
                                      </button>
                                    )}
                                    {membership.user_id !== query.data?.platformOwnerUserId &&
                                      membership.status !== "revoked" && (
                                        <button
                                          type="button"
                                          disabled={Boolean(busy)}
                                          onClick={() =>
                                            setConfirmation({
                                              title: `Revoke ${membership.invited_email}?`,
                                              detail: `This administrator will immediately lose access to ${tenant.name}. Historical audit records remain unchanged.`,
                                              actionLabel: "Revoke access",
                                              tone: "danger",
                                              key: membership.id,
                                              body: {
                                                action: "revoke",
                                                membershipId: membership.id,
                                              },
                                              successMessage: `Access revoked for ${membership.invited_email}`,
                                            })
                                          }
                                          className="grid size-10 place-items-center rounded-[10px] text-[var(--admin-muted)] transition-[background-color,color,transform] duration-150 hover:bg-rose-500/10 hover:text-rose-600 active:scale-[0.96]"
                                          aria-label={`Revoke ${membership.invited_email}`}
                                        >
                                          <UserMinus className="size-3.5" />
                                        </button>
                                      )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          {canInvite ? (
                            <form
                              className={cn(
                                "flex flex-col gap-2 sm:flex-row",
                                members.length > 0 && "mt-3",
                              )}
                              onSubmit={async (event) => {
                                event.preventDefault();
                                const email = inviteEmails[tenant.id]?.trim();
                                if (!email) return;
                                const invited = await mutate(
                                  {
                                    action: "invite",
                                    tenantId: tenant.id,
                                    adminEmail: email,
                                    requestId: crypto.randomUUID(),
                                  },
                                  `invite-${tenant.id}`,
                                  `Invitation sent to ${email}`,
                                );
                                if (invited)
                                  setInviteEmails((current) => ({ ...current, [tenant.id]: "" }));
                              }}
                            >
                              <input
                                type="email"
                                required
                                value={inviteEmails[tenant.id] || ""}
                                onChange={(event) =>
                                  setInviteEmails((current) => ({
                                    ...current,
                                    [tenant.id]: event.target.value,
                                  }))
                                }
                                className="admin-field min-h-11 flex-1"
                                placeholder="admin@client.com"
                                aria-label={`Admin email for ${tenant.name}`}
                              />
                              <button
                                type="submit"
                                disabled={Boolean(busy)}
                                className="admin-secondary-control min-h-11 px-3.5"
                              >
                                {busy === `invite-${tenant.id}` ? (
                                  <RefreshCw className="size-3.5 animate-spin motion-reduce:animate-none" />
                                ) : (
                                  <MailPlus className="size-3.5" />
                                )}
                                Invite admin
                              </button>
                            </form>
                          ) : (
                            <p className="text-pretty text-xs text-[var(--admin-muted)]">
                              Invitations are disabled while this workspace is {tenant.status}.
                            </p>
                          )}
                        </div>
                      </AdminSurface>
                    );
                  })}
                  {visibleTenants.length === 0 && (
                    <AdminSurface padding="lg" className="py-12 text-center">
                      <Search className="mx-auto size-5 text-[var(--admin-muted)]" />
                      <h3 className="mt-3 text-balance text-sm font-semibold text-[var(--admin-ink)]">
                        No workspaces match
                      </h3>
                      <p className="admin-copy mx-auto mt-1 max-w-sm text-pretty text-xs">
                        Clear the search or choose another lifecycle filter.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setSearch("");
                          setFilter("all");
                        }}
                        className="admin-secondary-control mx-auto mt-4 min-h-10 px-3.5"
                      >
                        Clear filters
                      </button>
                    </AdminSurface>
                  )}
                </section>

                <AdminSurface padding="lg" className="h-fit xl:sticky xl:top-5">
                  <div className="mb-5 flex items-start gap-3">
                    <span className="grid size-11 shrink-0 place-items-center rounded-[13px] bg-[var(--admin-soft)] shadow-sm">
                      <Plus className="size-[18px]" />
                    </span>
                    <div>
                      <h2 className="text-balance font-semibold text-[var(--admin-ink)]">
                        Create a workspace
                      </h2>
                      <p className="admin-copy mt-0.5 text-pretty text-xs">
                        Starts safely in provisioning.
                      </p>
                    </div>
                  </div>
                  <form onSubmit={createTenant} className="space-y-4">
                    <label className="block text-xs font-medium">
                      Workspace name
                      <input
                        value={name}
                        onChange={(event) => {
                          const value = event.target.value;
                          setName(value);
                          if (!slugEdited) setSlug(slugify(value));
                        }}
                        required
                        maxLength={120}
                        className="admin-field mt-1.5 min-h-11"
                        placeholder="Acme Roofing"
                      />
                    </label>
                    <label className="block text-xs font-medium">
                      URL slug
                      <input
                        value={slug}
                        onChange={(event) => {
                          setSlugEdited(true);
                          setSlug(slugify(event.target.value));
                        }}
                        required
                        pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                        className="admin-field mt-1.5 min-h-11 font-mono"
                        placeholder="acme-roofing"
                      />
                      {slug && (
                        <span className="mt-1.5 block truncate font-mono text-[9px] text-[var(--admin-muted)]">
                          /t/{slug}/admin
                        </span>
                      )}
                    </label>
                    <label className="block text-xs font-medium">
                      First client admin{" "}
                      <span className="font-normal text-[var(--admin-muted)]">(optional)</span>
                      <input
                        value={adminEmail}
                        onChange={(event) => setAdminEmail(event.target.value)}
                        type="email"
                        className="admin-field mt-1.5 min-h-11"
                        placeholder="owner@client.com"
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={Boolean(busy)}
                      className="admin-action-control min-h-11 w-full px-4"
                    >
                      {busy === "create" ? (
                        <RefreshCw className="size-4 animate-spin motion-reduce:animate-none" />
                      ) : (
                        <ShieldCheck className="size-4" />
                      )}
                      Create workspace
                    </button>
                  </form>
                  <div className="mt-5 rounded-[14px] bg-[var(--admin-soft)] p-3.5 shadow-[var(--admin-shadow-border)]">
                    <div className="flex gap-2.5">
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-700 dark:text-emerald-300" />
                      <p className="text-pretty text-xs leading-5 text-[var(--admin-muted)]">
                        Creation never activates operations. Review configuration and provider
                        boundaries before explicitly activating the workspace.
                      </p>
                    </div>
                  </div>
                </AdminSurface>
              </div>
            </>
          )
        ) : null}
      </AdminReadBody>
      <AdminDialog
        open={Boolean(confirmation)}
        onClose={() => {
          if (!busy) setConfirmation(null);
        }}
        title={confirmation?.title || "Confirm tenant action"}
        maxWidth="sm"
      >
        {confirmation && (
          <AdminSurface padding="lg" className="shadow-2xl">
            <span
              className={cn(
                "grid size-11 place-items-center rounded-[13px]",
                confirmation.tone === "danger"
                  ? "bg-rose-500/10 text-rose-700 dark:text-rose-300"
                  : "bg-amber-500/12 text-amber-800 dark:text-amber-300",
              )}
            >
              <ShieldCheck className="size-5" />
            </span>
            <h2 className="mt-4 text-balance text-lg font-semibold tracking-[-0.02em] text-[var(--admin-ink)]">
              {confirmation.title}
            </h2>
            <p className="admin-copy mt-2 text-pretty text-sm leading-6">{confirmation.detail}</p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={() => setConfirmation(null)}
                className="admin-secondary-control min-h-11 px-4"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={() => void confirmAction()}
                className={cn(
                  "inline-flex min-h-11 items-center justify-center gap-2 rounded-[11px] px-4 text-xs font-semibold text-white transition-[background-color,opacity,transform] duration-150 active:scale-[0.96] disabled:opacity-50",
                  confirmation.tone === "danger"
                    ? "bg-rose-700 hover:bg-rose-800"
                    : "bg-amber-700 hover:bg-amber-800",
                )}
              >
                {busy === confirmation.key && (
                  <RefreshCw className="size-3.5 animate-spin motion-reduce:animate-none" />
                )}
                {confirmation.actionLabel}
              </button>
            </div>
          </AdminSurface>
        )}
      </AdminDialog>
    </div>
  );
}
