/**
 * POST /api/engagements/[id]/workflow/resume
 *
 * Resume a paused workflow for an engagement after an approval is granted.
 *
 * Request body:
 *   {
 *     pauseStateId: string   // required — the ID of the paused workflow state
 *     resumedBy?: string     // optional — identifier of who triggered the resume
 *   }
 *
 * Success response (200):
 *   {
 *     engagementId: string
 *     pauseStateId: string
 *     taskStatus: string
 *     resumedAt: string
 *     auditEntry: { ... }
 *   }
 *
 * Error responses:
 *   400 — missing pauseStateId
 *   404 — engagement or pause state not found
 *   409 — pause state is not waiting_for_approval (already resumed/cancelled)
 *   422 — approval not yet granted
 *   500 — internal error
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { loadProject } from "@/src/storage/projectStore.js";
import { resumeWorkflowAfterApproval } from "@/services/workflow-resume";
import { findActivePauseForProject, loadPauseState } from "@/services/workflow-pause-store";
import { globalTaskStore, AgentExecutorError } from "@/agents";
import { requireAuthenticatedActor, recordAllow, recordDeny } from "@/lib/security/route-guards";
import { authorizeWorkflowAction, validateWorkflowResumeLinkage } from "@/lib/security/workflow-authorization";
import {
  concealedNotFound,
  isSecurityRouteError,
  toSecurityErrorResponse,
} from "@/lib/security/security-response";

const ResumeBodySchema = z.object({
  pauseStateId: z.string().min(1).optional(),
  resumedBy: z.string().optional(),
});

function err(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let actor: Awaited<ReturnType<typeof requireAuthenticatedActor>> | null = null;
  const action = {
    action: "workflow_resume",
    resourceType: "workflow_pause",
    resourceId: "unknown",
  };

  try {
    const { id: engagementId } = await params;
    action.resourceId = engagementId;

    actor = await requireAuthenticatedActor(request, action);

    let project;
    try {
      project = await loadProject(engagementId);
    } catch (error) {
      if (typeof error === "object" && error && "code" in error && error.code === "ENOENT") {
        concealedNotFound("workflow_project_not_found");
      }
      throw error;
    }

    authorizeWorkflowAction({ actor, project, engagementId, action: "resume" });

    const body = await request.json().catch(() => ({}));
    const parsed = ResumeBodySchema.safeParse(body);
    if (!parsed.success) {
      await recordDeny(actor, action, "workflow_resume_invalid_body");
      return err("Invalid request body.", 400);
    }

    const { pauseStateId: explicitPauseId } = parsed.data;

    let pauseState;
    if (explicitPauseId) {
      try {
        pauseState = await loadPauseState(explicitPauseId);
      } catch {
        concealedNotFound("workflow_pause_not_found");
      }
    } else {
      const active = await findActivePauseForProject(project.id);
      if (!active) {
        concealedNotFound("workflow_pause_not_found");
      }
      pauseState = active;
    }

    action.resourceId = pauseState.id;

    let task;
    try {
      if (!pauseState.agentTaskId) concealedNotFound("workflow_pause_task_not_found");
      task = await globalTaskStore.loadTask(pauseState.agentTaskId);
    } catch (error) {
      if (error instanceof AgentExecutorError && error.code === "task_not_found") {
        concealedNotFound("workflow_pause_task_not_found");
      }
      throw error;
    }

    validateWorkflowResumeLinkage({ project, pauseState, task });

    const result = await resumeWorkflowAfterApproval(pauseState.id, {
      resumedBy: actor.id,
      expectedContext: {
        projectId: project.id,
        engagementId,
        workflowRunId: pauseState.workflowRunId,
        agentTaskId: task.id,
      },
    });

    if (!result.ok) {
      const statusCode =
        result.code === "pause_not_found" ? 404
        : result.code === "already_resumed" ? 409
        : result.code === "approval_not_granted" ? 422
        : result.code === "task_not_found" ? 404
        : result.code === "invalid_state" ? 409
        : 500;

      await recordDeny(actor, action, `workflow_resume_${result.code}`);
      const message =
        statusCode === 404 ? "Not found."
        : statusCode === 409 ? "Workflow cannot be resumed from its current state."
        : statusCode === 422 ? "Approval is required before this workflow can resume."
        : "Workflow resume failed.";
      return err(message, statusCode);
    }

    // Determine continuation status for the response
    const continuationStatus =
      result.continuation === null && result.pauseState.pendingStepIds.length > 0
        ? "started_in_background"
        : result.continuation?.ok
          ? "completed"
          : result.continuation && !result.continuation.ok
            ? "failed"
            : "not_needed";

    await recordAllow(actor, action, "workflow_resumed");

    return NextResponse.json(
      {
        engagementId,
        pauseStateId: pauseState.id,
        taskStatus: result.taskStatus,
        resumedAt: result.pauseState.resumedAt,
        continuation: {
          status: continuationStatus,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    if (isSecurityRouteError(error)) {
      if (error.status !== 401) await recordDeny(actor, action, error.reasonCode);
      return toSecurityErrorResponse(error);
    }
    return NextResponse.json({ error: "An unexpected error occurred while resuming the workflow." }, { status: 500 });
  }
}
