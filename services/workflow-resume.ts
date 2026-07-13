/**
 * Workflow Resume Service (Slice 7)
 *
 * Handles resuming a paused workflow after an approval is granted.
 *
 * Flow:
 *   1. Caller finds the paused state (by project or task ID)
 *   2. Caller validates the approval was granted
 *   3. resumeWorkflowAfterApproval() executes the pending agent task
 *   4. Audit trail is updated with resume + completion events
 *   5. Pause state is marked "resumed"
 *
 * Limitations (documented):
 *   - Only supports resuming agent-step approval paths (not full department runs)
 *   - Does not continue the broader orchestrator PIPELINE after resume —
 *     the resumed step executes and records its result; continuation of
 *     downstream pipeline steps requires Slice 8 orchestrator integration.
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
import type { AuditRunEntry } from "../types/project";

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export type ResumeResult =
  | { ok: true; pauseState: PausedWorkflowState; taskStatus: string; auditEntry: AuditRunEntry }
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
 * @returns ResumeResult indicating success or failure with a clear reason
 */
export async function resumeWorkflowAfterApproval(
  pauseStateId: string,
  options: {
    resumedBy?: string;
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
  await markPauseResumed(pauseStateId, options.resumedBy);

  return {
    ok: true,
    pauseState: { ...pauseState, status: "resumed", resumedAt, resumedBy: options.resumedBy },
    taskStatus: "completed",
    auditEntry,
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
