/**
 * POST /api/agent-tasks/[id]/request-revision
 *
 * Set task approval status to "revision_requested" and record reviewer notes.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { globalTaskStore, AgentExecutorError } from "@/agents";
import { errorResponse, successResponse, validationErrorResponse, toFieldErrors } from "../../../agent-routes-helper";

const RequestRevisionBodySchema = z.object({
  reviewerNotes: z.string().optional(),
  reviewedBy: z.string().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    const validated = RequestRevisionBodySchema.parse(body);

    // Load task
    let task;
    try {
      task = await globalTaskStore.loadTask(id);
    } catch (error) {
      if (error instanceof AgentExecutorError && error.code === "task_not_found") {
        return errorResponse("TASK_NOT_FOUND", "Agent task not found.", 404);
      }
      throw error;
    }

    // Update approval status
    const now = new Date().toISOString();
    const updated = {
      ...task,
      approvalStatus: "revision_requested" as const,
      updatedAt: now,
    };

    await globalTaskStore.saveTask(updated);

    return successResponse(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return validationErrorResponse("Invalid request body.", toFieldErrors(error.issues));
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    return errorResponse("INTERNAL_ERROR", message, 500);
  }
}
