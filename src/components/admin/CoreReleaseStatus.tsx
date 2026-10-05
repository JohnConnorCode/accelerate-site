"use client";

import { useState } from "react";
import { AdminSurface } from "@/components/admin/AdminSurface";
import { AdminStatusMessage } from "@/components/admin/AdminStatusMessage";
import { fetchJson } from "@/lib/admin/fetchJson";

type ReleaseStatus = {
  status: string;
  message: string;
  checkedAt: string;
  installed: {
    coreVersion: string | null;
    coreCommit: string | null;
    forkCommit: string | null;
    customized: boolean | null;
  };
  path: string[];
  target: {
    version: string;
    url: string;
    runtime: { nodeMinimum: string; npmMinimum: string; postgresMinimum: string };
  } | null;
};

export function CoreReleaseStatus() {
  const [result, setResult] = useState<ReleaseStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function check() {
    setLoading(true);
    setError("");
    try {
      setResult(await fetchJson<ReleaseStatus>("/api/admin/setup/release"));
    } catch {
      setError("The release check failed. Try again when your connection is available.");
    } finally {
      setLoading(false);
    }
  }
  return (
    <AdminSurface padding="lg">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1 basis-64">
          <h2 className="text-lg font-semibold text-[var(--admin-ink)]">Core releases</h2>
          <p className="admin-copy mt-2 text-sm leading-6">
            Check the installed core and its supported path to a stable release before planning an
            upgrade.
          </p>
        </div>
        <button
          type="button"
          className="admin-button admin-button--secondary"
          disabled={loading}
          onClick={() => void check()}
        >
          {loading ? "Checking releases…" : "Check stable releases"}
        </button>
      </div>
      <div className="mt-4 space-y-3 text-sm" aria-live="polite" aria-busy={loading}>
        {error && <AdminStatusMessage tone="error">{error}</AdminStatusMessage>}
        {result && (
          <>
            <AdminStatusMessage
              tone={
                result.status === "unavailable" || result.status === "incompatible"
                  ? "warning"
                  : "info"
              }
            >
              {result.message}
            </AdminStatusMessage>
            <dl className="grid gap-3 sm:grid-cols-3">
              <div>
                <dt className="admin-copy text-xs">Core version</dt>
                <dd className="mt-1 font-mono">{result.installed.coreVersion ?? "Unversioned"}</dd>
              </div>
              <div>
                <dt className="admin-copy text-xs">Fork commit</dt>
                <dd className="mt-1 break-all font-mono">
                  {result.installed.forkCommit?.slice(0, 12) ?? "Unknown"}
                </dd>
              </div>
              <div>
                <dt className="admin-copy text-xs">Source changes</dt>
                <dd className="mt-1">
                  {result.installed.customized === null
                    ? "Unknown"
                    : result.installed.customized
                      ? "Fork changes present"
                      : "Matches recorded core"}
                </dd>
              </div>
            </dl>
            {result.path.length > 0 && (
              <p>
                Upgrade order: <span className="font-mono">{result.path.join(" → ")}</span>
              </p>
            )}
            {result.target && (
              <>
                <p className="admin-copy text-sm">
                  Target requirements: Node {result.target.runtime.nodeMinimum}+, npm{" "}
                  {result.target.runtime.npmMinimum}+ and PostgreSQL{" "}
                  {result.target.runtime.postgresMinimum}+.
                </p>
                <a
                  href={result.target.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-[var(--admin-ink)] underline underline-offset-4"
                >
                  Read {result.target.version} release notes
                </a>
              </>
            )}
            <p className="admin-copy text-xs">
              Checked {new Date(result.checkedAt).toLocaleString()}. Stable channel.
            </p>
          </>
        )}
      </div>
      <a
        href="/docs/self-hosting/installation#check-core-releases"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-block text-sm font-medium text-[var(--admin-ink)] underline underline-offset-4"
      >
        Version adoption and upgrade instructions
      </a>
    </AdminSurface>
  );
}
