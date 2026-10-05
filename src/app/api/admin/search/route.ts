import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { isModuleEnabled } from "@/lib/revenue-os/modules";
import { formatSearchRecords, normalizeSearchQuery } from "@/lib/admin/workspace-search";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const rawQ = searchParams.get("q");
  const q = normalizeSearchQuery(rawQ || "");
  if (q.length < 3) {
    return NextResponse.json({ results: [], records: [] });
  }

  const supabase = auth.database;
  const pattern = `%${q.replaceAll("_", "\\_")}%`;
  const modules = {
    modules: auth.tenant.config?.modules as Partial<Record<string, boolean>> | undefined,
  };
  const skipped = { data: [], error: null };

  const [
    canonicalRes,
    leadsRes,
    contactsRes,
    subscribersRes,
    chatRes,
    tasksRes,
    opportunitiesRes,
    clientsRes,
    proposalsRes,
  ] = await Promise.all([
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
    supabase.from("subscribers").select("email").ilike("email", pattern).limit(5),
    supabase
      .from("chat_leads")
      .select("name, email")
      .or(`name.ilike.${pattern},email.ilike.${pattern}`)
      .limit(5),
    supabase
      .from("tasks")
      .select("id, title, status, related_name")
      .or(`title.ilike.${pattern},related_name.ilike.${pattern}`)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("opportunities")
      .select("id, name, stage")
      .ilike("name", pattern)
      .order("created_at", { ascending: false })
      .limit(5),
    isModuleEnabled("clients", modules)
      ? supabase
          .from("clients")
          .select("id, business_name, contact_name, status")
          .or(
            `business_name.ilike.${pattern},contact_name.ilike.${pattern},contact_email.ilike.${pattern}`,
          )
          .order("created_at", { ascending: false })
          .limit(5)
      : skipped,
    isModuleEnabled("proposals", modules)
      ? supabase
          .from("proposals")
          .select("id, title, client_name, status")
          .or(`title.ilike.${pattern},client_name.ilike.${pattern}`)
          .order("created_at", { ascending: false })
          .limit(5)
      : skipped,
  ]);

  // A failed read cannot establish that the workspace has no matching records.
  if (
    [
      canonicalRes,
      leadsRes,
      contactsRes,
      subscribersRes,
      chatRes,
      tasksRes,
      opportunitiesRes,
      clientsRes,
      proposalsRes,
    ].some((result) => result.error)
  ) {
    return NextResponse.json(
      { error: "Workspace search is temporarily unavailable. Try again." },
      { status: 503 },
    );
  }

  interface SearchResult {
    name: string;
    email: string;
    type: string;
  }

  const results: SearchResult[] = [];
  const seenEmails = new Set<string>();

  const addResult = (name: string | null, email: string, type: string) => {
    if (email && !seenEmails.has(email.toLowerCase())) {
      seenEmails.add(email.toLowerCase());
      results.push({ name: name?.trim() || email, email, type });
    }
  };

  // Canonical results win deduplication so quick actions never attach to a
  // legacy-only person when the shared identity already exists.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (canonicalRes.data || []).forEach((r: any) => {
    if (r.primary_email) addResult(r.full_name, r.primary_email, "Canonical contact");
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (leadsRes.data || []).forEach((r: any) => addResult(r.contact_name, r.contact_email, "Lead"));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (contactsRes.data || []).forEach((r: any) => addResult(r.name, r.email, "Contact"));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (subscribersRes.data || []).forEach((r: any) => addResult(r.email, r.email, "Subscriber"));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (chatRes.data || []).forEach((r: any) => addResult(r.name, r.email, "Chat Lead"));

  return NextResponse.json({
    results: results.slice(0, 10),
    records: formatSearchRecords({
      tasks: tasksRes.data ?? [],
      opportunities: opportunitiesRes.data ?? [],
      clients: clientsRes.data ?? [],
      proposals: proposalsRes.data ?? [],
    }),
  });
}
