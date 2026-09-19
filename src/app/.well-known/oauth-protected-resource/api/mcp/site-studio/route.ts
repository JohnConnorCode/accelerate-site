import { NextResponse } from "next/server";
import { siteEditorOAuthConfig } from "@/lib/site-studio/delegation";
export const dynamic = "force-dynamic";
export function GET() {
  try {
    const config = siteEditorOAuthConfig();
    return NextResponse.json(
      {
        resource: config.resource,
        authorization_servers: [config.issuer],
        scopes_supported: ["openid", "email"],
        bearer_methods_supported: ["header"],
        resource_name: "Site Studio editor",
      },
      { headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" } },
    );
  } catch {
    return NextResponse.json({ error: "Site Studio OAuth is not configured" }, { status: 503 });
  }
}
