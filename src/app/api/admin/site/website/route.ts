import { createBundledWebsite } from "@/lib/site-studio/website-seed";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireAdminForModule } from "@/lib/admin/module-guard";
import { readBoundedJson } from "@/lib/http/bounded-json";
import { MAX_WEBSITE_BYTES } from "@/lib/site-studio/website-document";
import { parseWebsiteCommand } from "@/lib/site-studio/website-commands";
import {
  assertWebsiteOwner,
  readWebsite,
  readWebsiteHistory,
  writeWebsite,
  WebsiteConflictError,
} from "@/lib/site-studio/website-store";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };

async function authorize() {
  const auth = await requireAdminForModule("site-studio");
  if (auth instanceof NextResponse) return auth;
  try {
    assertWebsiteOwner(auth);
    return auth;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Website access denied" },
      { status: 403, headers },
    );
  }
}

export async function GET(request: Request) {
  const auth = await authorize();
  if (auth instanceof NextResponse) return auth;
  try {
    if (new URL(request.url).searchParams.get("history") === "1")
      return NextResponse.json({ revisions: await readWebsiteHistory(auth) }, { headers });
    return NextResponse.json(
      { website: await readWebsite(auth), bundled: createBundledWebsite() },
      { headers },
    );
  } catch {
    console.warn("[site-studio] Installation website read unavailable");
    return NextResponse.json(
      { error: "Website storage is unavailable. Check installation migrations and retry." },
      { status: 503, headers },
    );
  }
}

export async function POST(request: Request) {
  const auth = await authorize();
  if (auth instanceof NextResponse) return auth;
  // Browsers must originate writes on this installation. Non-browser governed
  // adapters still authenticate through the same installation-owner boundary.
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    return NextResponse.json(
      { error: "Website changes must originate on this installation" },
      { status: 403, headers },
    );
  let command;
  try {
    command = parseWebsiteCommand(await readBoundedJson(request, MAX_WEBSITE_BYTES + 1000));
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof ZodError
            ? error.issues
                .slice(0, 8)
                .map((issue) => `${issue.path.join(".") || "Website"}: ${issue.message}`)
                .join("; ")
            : "Use a valid website command within the 8 MB limit",
      },
      { status: 400, headers },
    );
  }
  try {
    // Return the immutable receipt directly. A second read can fail after a
    // successful commit and must never turn a completed write into a false error.
    return NextResponse.json({ receipt: await writeWebsite(auth, command) }, { headers });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Website change unavailable" },
      { status: error instanceof WebsiteConflictError ? 409 : 503, headers },
    );
  }
}
