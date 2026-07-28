/**
 * POST /api/agent-tasks/[id]/approve
 *
 * Set task approval status to "approved".
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { globalTaskStore, AgentExecutorError } from "@/agents";
import { errorResponse, successResponse, validationErrorResponse, toFieldErrors } from "../../../agent-routes-helper";
import {
  requireAuthenticatedActor,
  recordAllow,
  recordDeny,
} from "@/lib/security/route-guards";
import {
  authorizeAgentTaskAction,
  resolveAgentTaskRunOwnership,
} from "@/lib/security/agent-task-authorization";
import {
  concealedNotFound,
  isSecurityRouteError,
  toSecurityErrorResponse,
} from "@/lib/security/security-response";

const ApproveBodySchema = z.object({
  reviewerNotes: z.string().optional(),
  reviewedBy: z.string().optional(),
});

function sanitizeTaskForResponse(task: Record<string, unknown>) {
  return {
    id: task.id,
    agentId: task.agentId,
    title: task.title,
    objective: task.objective,
    projectId: task.projectId ?? null,
    engagementId: task.engagementId ?? null,
    workflowRunId: task.workflowRunId ?? null,
    departmentId: task.departmentId ?? null,
    status: task.status,
    approvalStatus: task.approvalStatus,
    priority: task.priority,
    provider: task.provider,
    model: task.model,
    requestedBy: task.requestedBy,
    startedAt: task.startedAt,
    completedAt: task.completedAt,
    failedAt: task.failedAt,
    error: task.error,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let actor: Awaited<ReturnType<typeof requireAuthenticatedActor>> | null = null;
  const action = {
    action: "agent_task_approve",
    resourceType: "agent_task",
    resourceId: "unknown",
  };

  try {
    const { id } = await params;
    action.resourceId = id;

    actor = await requireAuthenticatedActor(request, action);

    // Load task
    let task;
    try {
      task = await globalTaskStore.loadTask(id);
    } catch (error) {
      if (error instanceof AgentExecutorError && error.code === "task_not_found") {
        concealedNotFound("agent_task_not_found");
      }
      throw error;
    }

    const ownership = await resolveAgentTaskRunOwnership(task);
    authorizeAgentTaskAction({
      actor,
      task,
      project: ownership.project,
      action: "approve",
    });

    const body = await request.json().catch(() => ({}));
    ApproveBodySchema.parse(body);

    // Update approval status
    const now = new Date().toISOString();
    const updated = {
      ...task,
      approvalStatus: "approved" as const,
      updatedAt: now,
    };

    await globalTaskStore.saveTask(updated);

    await recordAllow(actor, action, "agent_task_approved");

    return successResponse(sanitizeTaskForResponse(updated));
  } catch (error) {
    if (isSecurityRouteError(error)) {
      if (error.status !== 401) {
        await recordDeny(actor, action, error.reasonCode);
      }
      return toSecurityErrorResponse(error);
    }

    if (error instanceof z.ZodError) {
      return validationErrorResponse("Invalid request body.", toFieldErrors(error.issues));
    }

    return errorResponse(
      "INTERNAL_ERROR",
      "An unexpected error occurred while applying this approval action.",
      500,
    );
  }
}
