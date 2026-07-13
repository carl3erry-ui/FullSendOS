/**
 * Workflow Resume Service (Slice 7 + Slice 8)
 *
 * Handles resuming a paused workflow after an approval is granted.
 *
 * Flow (Slice 7):
 *   1. Caller finds the paused state (by project or task ID)
 *   2. Caller validates the approval was granted
 *   3. resumeWorkflowAfterApproval() executes the pending agent task
 *   4. Audit trail is updated with resume + completion events
 *   5. Pause state is marked "resumed"
 *
 * Flow (Slice 8 addition):
 *   6. If pendingStepIds contains PIPELINE departments, continuation is triggered
 *   7. continueWorkflowAfterResume() runs remaining departments
 *   8. Workflow reaches "needs-review" or "complete" when all steps finish
 *
 * Continuation is synchronous when invokeModel is provided (test path).
 * Without invokeModel, continuation fires in background (production path).
 */

import type { Project } from "../types/project";
import { AgentExecutor } from "../agents/executor";
import { globalTaskStore } from "../agents/task-store";
import { globalAgentRegistry, globalInstanceRegistry } from "../agents/registry";
import { globalExecutionStore } from "../agents/execution-store";
import { globalProviderRegistry } from "../ai/provider-registry";
import {
  loadPauseState,
  markPauseResumed,
  markPauseCancelled,
  type PausedWorkflowState,
} from "./workflow-pause-store";
import { continueWorkflowAfterResume, type ContinuationResult } from "./workflow-continuation";
import type { AuditRunEntry } from "../types/project";

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export type ResumeResult =
  | {
      ok: true;
      pauseState: PausedWorkflowState;
      taskStatus: string;
      auditEntry: AuditRunEntry;
      continuation: ContinuationResult | null;
    }
  | { ok: false; reason: string; code: ResumeErrorCode };

export type ResumeErrorCode =
  | "pause_not_found"
  | "already_resumed"
  | "approval_not_granted"
  | "task_not_found"
  | "execution_failed"
  | "invalid_state";

// ---------------------------------------------------------------------------
// Main resume function
// ---------------------------------------------------------------------------

/**
 * Resume a paused workflow after an approval is granted.
 *
 * @param pauseStateId - ID of the PausedWorkflowState record
 * @param options.resumedBy - Optional identifier of who triggered the resume
 * @param options.invokeModel - Optional mock AI caller (for testing continuation)
 * @param options.continuationModel - AI model name for continuation departments
 * @returns ResumeResult indicating success or failure with a clear reason
 */
export async function resumeWorkflowAfterApproval(
  pauseStateId: string,
  options: {
    resumedBy?: string;
    invokeModel?: (args: { department: string; prompt: string; model: string }) => Promise<{ text: string }>;
    continuationModel?: string;
  } = {},
): Promise<ResumeResult> {
  // 1. Load the paused state
  let pauseState: PausedWorkflowState;
  try {
    pauseState = await loadPauseState(pauseStateId);
  } catch {
    return { ok: false, reason: `Paused workflow state not found: "${pauseStateId}"`, code: "pause_not_found" };
  }

  // 2. Validate it is still waiting
  if (pauseState.status !== "waiting_for_approval") {
    return {
      ok: false,
      reason: `Pause state "${pauseStateId}" has status "${pauseState.status}" — expected "waiting_for_approval".`,
      code: "already_resumed",
    };
  }

  // 3. Validate there is an agent task associated
  if (!pauseState.agentTaskId) {
    return {
      ok: false,
      reason: `Pause state "${pauseStateId}" has no agentTaskId — cannot resume agent-step path.`,
      code: "invalid_state",
    };
  }

  // 4. Load and validate the task
  let task;
  try {
    task = await globalTaskStore.loadTask(pauseState.agentTaskId);
  } catch {
    return {
      ok: false,
      reason: `Agent task "${pauseState.agentTaskId}" not found.`,
      code: "task_not_found",
    };
  }

  // 5. Validate approval was granted
  if (task.approvalStatus !== "approved") {
    return {
      ok: false,
      reason: `Agent task "${task.id}" has approvalStatus "${task.approvalStatus}" — must be "approved" before resuming.`,
      code: "approval_not_granted",
    };
  }

  const resumedAt = new Date().toISOString();

  // 6. Execute the task via AgentExecutor
  const executor = new AgentExecutor({
    taskStore: globalTaskStore,
    executionStore: globalExecutionStore,
    agentRegistry: globalAgentRegistry,
    instanceRegistry: globalInstanceRegistry,
    providerRegistry: globalProviderRegistry,
  });

  const execution = await executor.execute(task.id);

  const completedAt = new Date().toISOString();

  // 7. Build audit entry for the resume event
  const auditEntry: AuditRunEntry = {
    department: "agent-step",
    type: "agent",
    agentId: task.agentId,
    taskId: task.id,
    status: execution.ok ? "completed" : "failed",
    pauseStateId,
    workflowRunId: pauseState.workflowRunId,
    stepId: pauseState.currentStepId,
    resumedAt,
    resumedBy: options.resumedBy,
    startedAt: resumedAt,
    completedAt,
    ...(execution.ok ? {} : { error: execution.error?.message }),
  };

  if (!execution.ok) {
    // Task execution failed after approval — mark pause cancelled
    await markPauseCancelled(
      pauseStateId,
      `Execution failed after approval: ${execution.error?.message}`,
    );

    // Update task status to failed
    await globalTaskStore.saveTask({
      ...task,
      status: "failed",
      error: execution.error?.message,
      updatedAt: completedAt,
    });

    return {
      ok: false,
      reason: `Agent task execution failed: ${execution.error?.message}`,
      code: "execution_failed",
    };
  }

  // 8. Update task to completed
  await globalTaskStore.saveTask({
    ...task,
    status: "completed",
    output: JSON.stringify(execution.output),
    updatedAt: completedAt,
  });

  // 9. Mark pause state as resumed
  const resumedPause = await markPauseResumed(pauseStateId, options.resumedBy);

  // 10. Trigger pipeline continuation if there are pending PIPELINE departments
  let continuation: ContinuationResult | null = null;

  if (pauseState.pendingStepIds.length > 0) {
    if (options.invokeModel) {
      // Synchronous continuation (test path — invokeModel controls AI calls)
      continuation = await continueWorkflowAfterResume(pauseStateId, {
        invokeModel: options.invokeModel,
        model: options.continuationModel,
      });
    } else {
      // Asynchronous background continuation (production path)
      continueWorkflowAfterResume(pauseStateId, {
        model: options.continuationModel,
      }).then((result) => {
        if (!result.ok) {
          console.error(
            "workflow-continuation-failed",
            pauseStateId,
            result.reason,
          );
        } else {
          console.log(
            "workflow-continuation-complete",
            pauseStateId,
            result.projectStatus,
          );
        }
      }).catch((err: unknown) => {
        console.error(
          "workflow-continuation-error",
          pauseStateId,
          err instanceof Error ? err.message : String(err),
        );
      });
      // Continuation started in background — not yet complete
      continuation = null;
    }
  }

  return {
    ok: true,
    pauseState: { ...pauseState, status: "resumed", resumedAt, resumedBy: options.resumedBy },
    taskStatus: "completed",
    auditEntry,
    continuation,
  };
}

// ---------------------------------------------------------------------------
// Helper: build a pause state from an agent step that returned waiting-for-approval
// ---------------------------------------------------------------------------

export function buildPauseState(options: {
  pauseId: string;
  workflowRunId: string;
  projectId: string;
  engagementId: string;
  stepId: string;
  agentTaskId: string;
  completedStepIds?: string[];
  failedStepIds?: string[];
  pendingStepIds?: string[];
}): import("./workflow-step-schema").PausedWorkflowState {
  const now = new Date().toISOString();
  return {
    id: options.pauseId,
    workflowRunId: options.workflowRunId,
    projectId: options.projectId,
    engagementId: options.engagementId,
    currentStepId: options.stepId,
    pausedAt: now,
    pauseReason: `Agent step "${options.stepId}" requires approval before execution.`,
    agentTaskId: options.agentTaskId,
    requiredApprovalTarget: `agent_task:${options.agentTaskId}`,
    status: "waiting_for_approval",
    completedStepIds: options.completedStepIds ?? [],
    failedStepIds: options.failedStepIds ?? [],
    pendingStepIds: options.pendingStepIds ?? [],
  };
}
