import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import {
  createOpportunityFromConversation,
  createTaskFromConversation,
} from "@/lib/revenue-os/conversations";

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json()) as {
    actionType?: "create_opportunity" | "create_task";
    conversationId?: string;
    // create_opportunity params
    opportunityName?: string;
    estimatedValue?: number;
    nextAction?: string;
    // create_task params
    taskTitle?: string;
    taskDueDate?: string;
    taskPriority?: "high" | "medium" | "low";
    taskDescription?: string;
  };

  if (!body.conversationId) {
    return NextResponse.json({ error: "Conversation id is required" }, { status: 400 });
  }

  const supabase = auth.database;
  const actorEmail = auth.user.email || "founder@revenue-os.local";

  try {
    if (body.actionType === "create_opportunity") {
      if (!body.opportunityName?.trim()) {
        return NextResponse.json({ error: "Opportunity name is required" }, { status: 400 });
      }

      const result = await createOpportunityFromConversation(supabase, {
        conversationId: body.conversationId,
        name: body.opportunityName.trim(),
        estimatedValue: body.estimatedValue,
        nextAction: body.nextAction,
        actorEmail,
      });

      return NextResponse.json({ success: true, ...result });
    }

    if (body.actionType === "create_task") {
      if (!body.taskTitle?.trim()) {
        return NextResponse.json({ error: "Task title is required" }, { status: 400 });
      }

      const result = await createTaskFromConversation(supabase, {
        conversationId: body.conversationId,
        title: body.taskTitle.trim(),
        dueDate: body.taskDueDate,
        priority: body.taskPriority,
        description: body.taskDescription,
        actorEmail,
      });

      return NextResponse.json({ success: true, ...result });
    }

    return NextResponse.json({ error: "Unknown action type" }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Action failed" },
      { status: 400 },
    );
  }
}
