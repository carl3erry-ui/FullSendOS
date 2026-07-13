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
  try {
    const { id: engagementId } = await params;

    // Parse body
    const body = await request.json().catch(() => ({}));
    const parsed = ResumeBodySchema.safeParse(body);
    if (!parsed.success) {
      return err("Invalid request body.", 400);
    }

    const { pauseStateId: explicitPauseId, resumedBy } = parsed.data;

    // Validate engagement/project exists
    let project;
    try {
      project = await loadProject(engagementId);
    } catch {
      return err(`Engagement not found: "${engagementId}"`, 404);
    }

    // Resolve which pause state to resume
    let pauseStateId: string;
    if (explicitPauseId) {
      // Validate it belongs to this engagement
      try {
        const state = await loadPauseState(explicitPauseId);
        if (state.projectId !== project.id && state.engagementId !== engagementId) {
          return err(`Pause state "${explicitPauseId}" does not belong to this engagement.`, 404);
        }
        pauseStateId = explicitPauseId;
      } catch {
        return err(`Pause state not found: "${explicitPauseId}"`, 404);
      }
    } else {
      // Auto-discover the active pause for this engagement
      const active = await findActivePauseForProject(project.id);
      if (!active) {
        return err(`No active paused workflow found for engagement "${engagementId}".`, 404);
      }
      pauseStateId = active.id;
    }

    // Resume the workflow
    const result = await resumeWorkflowAfterApproval(pauseStateId, { resumedBy });

    if (!result.ok) {
      const statusCode =
        result.code === "pause_not_found" ? 404
        : result.code === "already_resumed" ? 409
        : result.code === "approval_not_granted" ? 422
        : result.code === "task_not_found" ? 404
        : 500;

      return err(result.reason, statusCode);
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

    return NextResponse.json(
      {
        engagementId,
        pauseStateId,
        taskStatus: result.taskStatus,
        resumedAt: result.pauseState.resumedAt,
        auditEntry: result.auditEntry,
        continuation: {
          status: continuationStatus,
          ...(result.continuation?.ok && {
            ranDepartments: result.continuation.ranDepartments,
            projectStatus: result.continuation.projectStatus,
          }),
          ...(result.continuation && !result.continuation.ok && {
            reason: result.continuation.reason,
          }),
        },
      },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
