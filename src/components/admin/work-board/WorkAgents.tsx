"use client";
import { useState } from "react";
import { useAdminQuery } from "@/lib/admin/useAdminQuery";
import { fetchJson } from "@/lib/admin/fetchJson";
import { toast } from "@/lib/admin/useToast";
export function WorkAgents() {
  const [open, setOpen] = useState(false),
    [name, setName] = useState(""),
    [projects, setProjects] = useState("accelerate"),
    [capabilities, setCapabilities] = useState("");
  const [mode, setMode] = useState("read"),
    [token, setToken] = useState("");
  const query = useAdminQuery<{
    agents: {
      id: string;
      name: string;
      projects: string[];
      scopes: string[];
      expires_at: string;
      revoked_at: string | null;
    }[];
  }>(["admin", "work-agents"], "/api/admin/features/agents", { enabled: open });
  const issue = async () => {
    try {
      const result = await fetchJson<{ token: string }>("/api/admin/features/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          projects: projects
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          capabilities: capabilities
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          scopes:
            mode === "read"
              ? ["read"]
              : ["read", "claim", "heartbeat", "progress", "block", "release", "submit"],
          days: 30,
        }),
      });
      setToken(result.token);
      await query.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not issue credential");
    }
  };
  return (
    <details
      onToggle={(e) => {
        setOpen(e.currentTarget.open);
        if (!e.currentTarget.open) setToken("");
      }}
      className="rounded-2xl border border-[var(--admin-border)] p-4"
    >
      <summary className="min-h-10 cursor-pointer py-2 text-sm font-semibold">Agent access</summary>
      <p className="mb-3 text-xs text-[var(--admin-muted)]">
        Scoped credentials connect agents through HTTP, MCP or the CLI. Review remains with the
        operator.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          { label: "Agent name", value: name, set: setName },
          { label: "Projects (comma separated)", value: projects, set: setProjects },
          {
            label: "Worker capabilities (comma separated)",
            value: capabilities,
            set: setCapabilities,
          },
        ].map((f) => (
          <label key={f.label} className="text-xs">
            {f.label}
            <input
              value={f.value}
              onChange={(e) => f.set(e.target.value)}
              className="mt-1 min-h-11 w-full rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3"
            />
          </label>
        ))}
        <label className="text-xs">
          Access
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            className="mt-1 min-h-11 w-full rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3"
          >
            <option value="read">Read only</option>
            <option value="execute">Claim and submit work</option>
          </select>
        </label>
      </div>
      <button
        type="button"
        disabled={!name.trim()}
        onClick={() => void issue()}
        className="mt-3 min-h-11 rounded-xl border border-[var(--admin-border)] px-4 text-xs font-semibold disabled:opacity-40"
      >
        Issue 30-day credential
      </button>
      {token && (
        <div className="mt-3 rounded-xl border border-[var(--admin-warning)]/30 p-3">
          <p className="text-xs">
            Copy this credential into your local secret manager now. It is shown once and cleared
            when this section closes.
          </p>
          <input
            aria-label="New agent credential"
            type="password"
            readOnly
            value={token}
            className="mt-2 min-h-11 w-full rounded-xl bg-[var(--admin-surface)] px-3"
          />
          <button
            type="button"
            className="min-h-11 px-3 text-xs font-semibold"
            onClick={() =>
              void navigator.clipboard
                .writeText(token)
                .then(() => toast.success("Credential copied"))
                .catch(() => toast.error("Clipboard unavailable"))
            }
          >
            Copy credential
          </button>
          <button type="button" className="min-h-11 px-3 text-xs" onClick={() => setToken("")}>
            Dismiss
          </button>
        </div>
      )}
      {query.error && (
        <p role="alert" className="mt-3 text-xs">
          {query.error.message}
        </p>
      )}
      <ul className="mt-4 space-y-2">
        {query.data?.agents.map((agent) => (
          <li
            key={agent.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--admin-border)] p-3 text-xs"
          >
            <div>
              <strong>{agent.name}</strong>
              <p className="mt-1">
                {agent.projects.join(", ")} · {agent.scopes.join(", ")}
              </p>
              <p className="mt-1">
                {agent.revoked_at
                  ? "Revoked"
                  : `Expires ${new Date(agent.expires_at).toLocaleDateString()}`}
              </p>
            </div>
            {!agent.revoked_at && (
              <button
                type="button"
                className="min-h-11 rounded-xl border border-[var(--admin-border)] px-4"
                onClick={() =>
                  void fetchJson("/api/admin/features/agents", {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: agent.id }),
                  })
                    .then(() => query.refetch())
                    .catch((e) => toast.error(e.message))
                }
              >
                Revoke
              </button>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}
