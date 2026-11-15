import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { createManualContact } from "@/lib/revenue-os/identity";
import { listContacts } from "@/lib/revenue-os/records";

const newContact = z
  .object({
    name: z.string().trim().min(1).max(200),
    email: z.string().trim().toLowerCase().email().max(254),
    phone: z.string().trim().max(80).optional(),
  })
  .strict();

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const params = request.nextUrl.searchParams;
  const page = Math.max(1, Math.min(10000, Number(params.get("page")) || 1));
  const search = params.get("search")?.trim().slice(0, 100) ?? "";
  try {
    const { contacts, total } = await listContacts(auth.database, { page, search });
    return NextResponse.json({ contacts, total, page, pageSize: 50 });
  } catch (error) {
    console.error(
      "[contacts/directory] read failed",
      error instanceof Error ? error.message : "unknown error",
    );
    return NextResponse.json({ error: "Contacts could not be loaded" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  let payload: unknown;
  try {
    payload = await request.json();
  } catch (error) {
    console.warn(
      "[contacts/directory] invalid JSON",
      error instanceof Error ? error.name : "unknown",
    );
    return NextResponse.json({ error: "Enter a name and valid email address" }, { status: 400 });
  }
  const body = newContact.safeParse(payload);
  if (!body.success)
    return NextResponse.json({ error: "Enter a name and valid email address" }, { status: 400 });

  const result = await createManualContact(auth.database, {
    ...body.data,
    actorEmail: auth.user.email,
  });
  if (result.status === "duplicate")
    return NextResponse.json(
      { error: "A contact with this email already exists" },
      { status: 409 },
    );
  return NextResponse.json({ contact: result.contact }, { status: 201 });
}
