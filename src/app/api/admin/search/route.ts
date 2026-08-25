import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/auth";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const rawQ = searchParams.get("q");
  // Strip characters that are meaningful in the PostgREST .or() filter DSL
  // (commas, parentheses, backslash, quotes) so a crafted q cannot inject
  // extra filter conditions. Dots, @, _, - are kept so name/email search works.
  const q = (rawQ || "").replace(/[,()\\"]/g, "").trim();

  if (q.length < 3) {
    return NextResponse.json({ results: [] });
  }

  const supabase = createServiceRoleClient();
  const pattern = `%${q}%`;

  const [canonicalRes, leadsRes, contactsRes, subscribersRes, chatRes] = await Promise.all([
    supabase
      .from("contacts")
      .select("full_name, primary_email")
      .or(`full_name.ilike.${pattern},primary_email.ilike.${pattern}`)
      .limit(5),
    supabase
      .from("solution_requests")
      .select("contact_name, contact_email, industry")
      .or(`contact_name.ilike.${pattern},contact_email.ilike.${pattern}`)
      .limit(5),
    supabase
      .from("contact_submissions")
      .select("name, email")
      .or(`name.ilike.${pattern},email.ilike.${pattern}`)
      .limit(5),
    supabase
      .from("subscribers")
      .select("email")
      .ilike("email", pattern)
      .limit(5),
    supabase
      .from("chat_leads")
      .select("name, email")
      .or(`name.ilike.${pattern},email.ilike.${pattern}`)
      .limit(5),
  ]);

  interface SearchResult {
    name: string;
    email: string;
    type: string;
  }

  const results: SearchResult[] = [];
  const seenEmails = new Set<string>();

  const addResult = (name: string, email: string, type: string) => {
    if (!seenEmails.has(email)) {
      seenEmails.add(email);
      results.push({ name, email, type });
    }
  };

  // Canonical results win deduplication so quick actions never attach to a
  // legacy-only person when the shared identity already exists.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (canonicalRes.data || []).forEach((r: any) => { if (r.primary_email) addResult(r.full_name, r.primary_email, "Canonical contact"); });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (leadsRes.data || []).forEach((r: any) => addResult(r.contact_name, r.contact_email, "Lead"));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (contactsRes.data || []).forEach((r: any) => addResult(r.name, r.email, "Contact"));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (subscribersRes.data || []).forEach((r: any) => addResult(r.email, r.email, "Subscriber"));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (chatRes.data || []).forEach((r: any) => addResult(r.name, r.email, "Chat Lead"));

  return NextResponse.json({ results: results.slice(0, 10) });
}
