import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { WorkBoardError } from "./work-board";
export function workError(error: unknown) {
  if (error instanceof ZodError)
    return NextResponse.json(
      {
        error: "Invalid work request",
        issues: error.issues.map(({ path, message }) => ({ path, message })),
      },
      { status: 400 },
    );
  return NextResponse.json(
    { error: error instanceof Error ? error.message : "Work request failed" },
    { status: error instanceof WorkBoardError ? error.status : 500 },
  );
}
export async function readWorkBody(request: Request) {
  const text = await request.text();
  if (text.length > 350000) throw new WorkBoardError("Request too large", 413);
  try {
    return JSON.parse(text);
  } catch {
    throw new WorkBoardError("Invalid JSON");
  }
}
