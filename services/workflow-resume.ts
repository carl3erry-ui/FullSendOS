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
  markPauseResumedWithClaim,
  markPauseCancelled,
  type PausedWorkflowState,
} from "./workflow-pause-store";
import { continueWorkflowAfterResume, type ContinuationResult } from "./workflow-continuation";
import type { AuditRunEntry } from "../types/project";
import {
  advanceResumeOperation,
  claimResumeOperation,
  loadResumeOperation,
  markResumeOperationRecoveryRequired,
  releaseResumeOperationBeforeExecution,
  type WorkflowResumeOperation,
} from "./workflow-resume-operation-store";

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
    expectedContext?: {
      projectId: string;
      engagementId: string;
      workflowRunId: string;
      agentTaskId: string;
    };
    transactionHooks?: Partial<Record<
      "afterClaim" | "afterExecutionCommitted" | "afterTaskCompleted" | "afterPauseFinalized" | "afterContinuationCommitted",
      (operation: WorkflowResumeOperation) => void | Promise<void>
    >>;
  } = {},
): Promise<ResumeResult> {
  let pauseState: PausedWorkflowState;
  try {
    pauseState = await loadPauseState(pauseStateId);
  } catch {
    return { ok: false, reason: `Paused workflow state not found: "${pauseStateId}"`, code: "pause_not_found" };
  }

  if (pauseState.status !== "waiting_for_approval") {
    return {
      ok: false,
      reason: `Pause state "${pauseStateId}" has status "${pauseState.status}" — expected "waiting_for_approval".`,
      code: "already_resumed",
    };
  }

  if (!pauseState.agentTaskId) {
    return {
      ok: false,
      reason: `Pause state "${pauseStateId}" has no agentTaskId — cannot resume agent-step path.`,
      code: "invalid_state",
    };
  }

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

  if (task.approvalStatus !== "approved") {
    return {
      ok: false,
      reason: `Agent task "${task.id}" has approvalStatus "${task.approvalStatus}" — must be "approved" before resuming.`,
      code: "approval_not_granted",
    };
  }

  if (
    options.expectedContext
    && (
      pauseState.projectId !== options.expectedContext.projectId
      || pauseState.engagementId !== options.expectedContext.engagementId
      || pauseState.workflowRunId !== options.expectedContext.workflowRunId
      || pauseState.agentTaskId !== options.expectedContext.agentTaskId
      || task.projectId !== options.expectedContext.projectId
      || task.engagementId !== options.expectedContext.engagementId
      || (task.workflowRunId && task.workflowRunId !== options.expectedContext.workflowRunId)
    )
  ) {
    return { ok: false, reason: "Stored workflow linkage is invalid.", code: "invalid_state" };
  }

  const claim = await claimResumeOperation({
    pauseId: pauseState.id,
    projectId: pauseState.projectId,
    engagementId: pauseState.engagementId,
    workflowRunId: pauseState.workflowRunId,
    taskId: task.id,
    actorId: options.resumedBy ?? "system",
  });
  if (!claim.ok) {
    return { ok: false, reason: "Workflow resume is already in progress or completed.", code: "already_resumed" };
  }

  const { claimId } = claim.operation;
  let currentPhase = claim.operation.phase;

  const failRecoveryRequired = async (failureCode: string) => {
    if (currentPhase === "claimed") {
      await releaseResumeOperationBeforeExecution({ pauseId: pauseStateId, claimId });
      return;
    }
    try {
      const operation = await markResumeOperationRecoveryRequired({
        pauseId: pauseStateId,
        claimId,
        expectedPhase: currentPhase,
        failureCode,
      });
      currentPhase = operation.phase;
    } catch {
      // Existing durable evidence is retained; never delete or replay after execution commitment.
    }
  };

  try {
    await options.transactionHooks?.afterClaim?.(claim.operation);

    pauseState = await loadPauseState(pauseStateId);
    task = await globalTaskStore.loadTask(pauseState.agentTaskId ?? "");
    if (
      pauseState.status !== "waiting_for_approval"
      || task.approvalStatus !== "approved"
      || pauseState.agentTaskId !== claim.operation.taskId
      || pauseState.projectId !== claim.operation.projectId
      || pauseState.engagementId !== claim.operation.engagementId
      || pauseState.workflowRunId !== claim.operation.workflowRunId
      || (
        options.expectedContext
        && (
          task.projectId !== claim.operation.projectId
          || task.engagementId !== claim.operation.engagementId
          || (task.workflowRunId && task.workflowRunId !== claim.operation.workflowRunId)
        )
      )
    ) {
      await releaseResumeOperationBeforeExecution({ pauseId: pauseStateId, claimId });
      return { ok: false, reason: "Workflow resume preconditions changed.", code: "invalid_state" };
    }

    let operation = await advanceResumeOperation({
      pauseId: pauseStateId,
      claimId,
      expectedPhase: "claimed",
      nextPhase: "execution_committed",
    });
    currentPhase = operation.phase;
    await options.transactionHooks?.afterExecutionCommitted?.(operation);

  const resumedAt = new Date().toISOString();

  const executor = new AgentExecutor({
    taskStore: globalTaskStore,
    executionStore: globalExecutionStore,
    agentRegistry: globalAgentRegistry,
    instanceRegistry: globalInstanceRegistry,
    providerRegistry: globalProviderRegistry,
  });

  const execution = await executor.execute(task.id);

  const completedAt = new Date().toISOString();

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
    await markPauseCancelled(
      pauseStateId,
      "Agent task execution failed after approval.",
    );
    operation = await advanceResumeOperation({
      pauseId: pauseStateId,
      claimId,
      expectedPhase: "execution_committed",
      nextPhase: "failed",
      failureCode: "task_execution_failed",
      ...(execution.execution?.id && { executionId: execution.execution.id }),
    });
    currentPhase = operation.phase;

    return {
      ok: false,
      reason: "Agent task execution failed.",
      code: "execution_failed",
    };
  }

  await globalTaskStore.saveTask({
    ...execution.task,
    status: "completed",
    output: JSON.stringify(execution.output),
    updatedAt: completedAt,
  });

    operation = await advanceResumeOperation({
      pauseId: pauseStateId,
      claimId,
      expectedPhase: "execution_committed",
      nextPhase: "task_completed",
      executionId: execution.execution.id,
    });
    currentPhase = operation.phase;
    await options.transactionHooks?.afterTaskCompleted?.(operation);

    const resumedPause = await markPauseResumedWithClaim({
      id: pauseStateId,
      claimId,
      resumedBy: options.resumedBy ?? "system",
    });
    operation = await advanceResumeOperation({
      pauseId: pauseStateId,
      claimId,
      expectedPhase: "task_completed",
      nextPhase: "pause_finalized",
    });
    currentPhase = operation.phase;
    await options.transactionHooks?.afterPauseFinalized?.(operation);

  let continuation: ContinuationResult | null = null;

  if (pauseState.pendingStepIds.length > 0) {
      operation = await advanceResumeOperation({
        pauseId: pauseStateId,
        claimId,
        expectedPhase: "pause_finalized",
        nextPhase: "continuation_committed",
      });
      currentPhase = operation.phase;
      await options.transactionHooks?.afterContinuationCommitted?.(operation);

    if (options.invokeModel) {
      continuation = await continueWorkflowAfterResume(pauseStateId, {
        invokeModel: options.invokeModel,
        model: options.continuationModel,
      });
        operation = await advanceResumeOperation({
          pauseId: pauseStateId,
          claimId,
          expectedPhase: "continuation_committed",
          nextPhase: continuation.ok ? "completed" : "failed",
          ...(!continuation.ok && { failureCode: "continuation_failed" }),
        });
        currentPhase = operation.phase;
    } else {
      continueWorkflowAfterResume(pauseStateId, {
        model: options.continuationModel,
      }).then(async (result) => {
        await advanceResumeOperation({
          pauseId: pauseStateId,
          claimId,
          expectedPhase: "continuation_committed",
          nextPhase: result.ok ? "completed" : "failed",
          ...(!result.ok && { failureCode: "continuation_failed" }),
        });
      }).catch(async () => {
        await markResumeOperationRecoveryRequired({
          pauseId: pauseStateId,
          claimId,
          expectedPhase: "continuation_committed",
          failureCode: "continuation_outcome_ambiguous",
        }).catch(() => undefined);
      });
      continuation = null;
    }
    } else {
      operation = await advanceResumeOperation({
        pauseId: pauseStateId,
        claimId,
        expectedPhase: "pause_finalized",
        nextPhase: "completed",
      });
      currentPhase = operation.phase;
  }

  return {
    ok: true,
    pauseState: { ...pauseState, status: "resumed", resumedAt, resumedBy: options.resumedBy },
    taskStatus: "completed",
    auditEntry,
    continuation,
  };
  } catch {
    await failRecoveryRequired(`resume_${currentPhase}_interrupted`);
    return {
      ok: false,
      reason: currentPhase === "claimed"
        ? "Workflow resume preconditions failed."
        : "Workflow resume requires recovery review.",
      code: currentPhase === "claimed" ? "invalid_state" : "execution_failed",
    };
  }
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
