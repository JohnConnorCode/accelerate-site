import { NextRequest, NextResponse } from "next/server";
import { resolveKanbanBoardAuth } from "@/lib/kanban/auth";
import { KANBAN_DEFAULT_COLUMNS } from "@/lib/kanban/defaults";
import { isKanbanBoardKey, type KanbanColumnMetadata } from "@/lib/kanban/types";

function cleanLabel(value: unknown, max = 60): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function slugifyColumnKey(label: string): string {
  const base = label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return base || "column";
}

function cleanMetadata(value: unknown): KanbanColumnMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as KanbanColumnMetadata;
}

export async function GET(request: NextRequest) {
  const boardKeyParam = new URL(request.url).searchParams.get("board_key");
  if (!isKanbanBoardKey(boardKeyParam)) {
    return NextResponse.json({ error: "A valid board_key is required" }, { status: 400 });
  }
  const auth = await resolveKanbanBoardAuth(boardKeyParam);
  if (!auth.ok) return auth.response;
  const { supabase, tenantId, tenantConfig } = auth;

  const baseQuery = () => {
    const query = supabase.from("kanban_columns").select("*").eq("board_key", boardKeyParam);
    return tenantId ? query.eq("tenant_id", tenantId) : query.is("tenant_id", null);
  };

  const { data, error } = await baseQuery().order("sort_order", { ascending: true });
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") {
      return NextResponse.json({ columns: [] });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if ((data ?? []).length > 0) {
    return NextResponse.json({ columns: data });
  }

  // Lazy-seed: `features` should always come from the migration, so this only
  // ever fires for a tenant created after that migration ran.
  const defaults = KANBAN_DEFAULT_COLUMNS[boardKeyParam];
  const stageLabels =
    boardKeyParam === "pipeline" &&
    tenantConfig &&
    typeof tenantConfig.pipeline === "object" &&
    tenantConfig.pipeline !== null
      ? ((tenantConfig.pipeline as Record<string, unknown>).stageLabels as
          | Record<string, string>
          | undefined)
      : undefined;
  const rows = defaults.map((column) => ({
    board_key: boardKeyParam,
    tenant_id: tenantId,
    column_key: column.column_key,
    label: stageLabels?.[column.column_key] || column.label,
    color: column.color,
    sort_order: column.sort_order,
    is_default: column.is_default,
    metadata: column.metadata,
  }));

  const { data: seeded, error: seedError } = await supabase
    .from("kanban_columns")
    .insert(rows)
    .select();
  if (seedError) {
    // A concurrent request may have seeded first; re-read instead of failing.
    const retry = await baseQuery().order("sort_order", { ascending: true });
    if (retry.error || !(retry.data ?? []).length) {
      return NextResponse.json({ error: seedError.message }, { status: 500 });
    }
    return NextResponse.json({ columns: retry.data });
  }
  return NextResponse.json({ columns: seeded ?? [] });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as Record<string, unknown>;
  const boardKeyParam = body.board_key;
  if (!isKanbanBoardKey(boardKeyParam)) {
    return NextResponse.json({ error: "A valid board_key is required" }, { status: 400 });
  }
  const auth = await resolveKanbanBoardAuth(boardKeyParam);
  if (!auth.ok) return auth.response;
  const { supabase, tenantId } = auth;

  const label = cleanLabel(body.label);
  if (!label) return NextResponse.json({ error: "Label is required" }, { status: 400 });
  const metadata = cleanMetadata(body.metadata);

  const scoped = () => {
    const query = supabase
      .from("kanban_columns")
      .select("column_key,sort_order")
      .eq("board_key", boardKeyParam);
    return tenantId ? query.eq("tenant_id", tenantId) : query.is("tenant_id", null);
  };

  const { data: existing, error: existingError } = await scoped();
  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });

  const existingKeys = new Set((existing ?? []).map((row) => row.column_key as string));
  const base = slugifyColumnKey(label);
  let columnKey = base;
  let suffix = 2;
  while (existingKeys.has(columnKey)) {
    columnKey = `${base}_${suffix}`;
    suffix += 1;
  }
  const maxSortOrder = (existing ?? []).reduce(
    (max, row) => Math.max(max, Number(row.sort_order) || 0),
    0,
  );

  const insertRow = {
    board_key: boardKeyParam,
    tenant_id: tenantId,
    column_key: columnKey,
    label,
    color: typeof body.color === "string" ? body.color : null,
    sort_order: maxSortOrder + 1000,
    is_default: false,
    metadata,
  };
  const { data, error } = await supabase
    .from("kanban_columns")
    .insert(insertRow)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
