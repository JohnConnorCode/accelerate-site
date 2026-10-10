import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin/auth";
import { discoverCoreReleases } from "@/lib/revenue-os/core-release.mjs";

export async function GET() {
  const auth = await requirePlatformAdmin();
  if (auth instanceof NextResponse) return auth;
  const identity = JSON.parse(process.env.ACCELERATE_CORE_IDENTITY || "null") || {
    core: null,
    forkCommit: null,
    customized: null,
    nodeVersion: process.versions.node,
  };
  // Runtime Node can differ from the build host. No database or provider keys enter discovery.
  identity.nodeVersion = process.versions.node;
  const result = await discoverCoreReleases(identity);
  return NextResponse.json(
    {
      ...result,
      installed: {
        coreVersion: identity.core?.version ?? null,
        coreCommit: identity.core?.sourceCommit ?? null,
        forkCommit: identity.forkCommit,
        customized: identity.customized,
        nodeVersion: identity.nodeVersion,
      },
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
