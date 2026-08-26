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
  assertResumeOperationOwner,
  claimResumeReconciliation,
  claimResumeOperation,
  getResumeRuntimeInstanceId,
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

type ResumeOptions = {
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
};

function buildResumeAuditEntry(input: {
  task: Awaited<ReturnType<typeof globalTaskStore.loadTask>>;
  pauseState: PausedWorkflowState;
  resumedAt: string;
  resumedBy?: string;
  status: "completed" | "failed";
  error?: string;
}): AuditRunEntry {
  return {
    department: "agent-step",
    type: "agent",
    agentId: input.task.agentId,
    taskId: input.task.id,
    status: input.status,
    pauseStateId: input.pauseState.id,
    workflowRunId: input.pauseState.workflowRunId,
    stepId: input.pauseState.currentStepId,
    resumedAt: input.resumedAt,
    resumedBy: input.resumedBy,
    startedAt: input.resumedAt,
    completedAt: new Date().toISOString(),
    ...(input.error && { error: input.error }),
  };
}

async function continueClaimedResume(input: {
  pauseState: PausedWorkflowState;
  task: Awaited<ReturnType<typeof globalTaskStore.loadTask>>;
  claimId: string;
  options: ResumeOptions;
}): Promise<{ continuation: ContinuationResult | null; phase: WorkflowResumeOperation["phase"] }> {
  const { pauseState, claimId, options } = input;
  if (pauseState.pendingStepIds.length === 0) {
    const completed = await advanceResumeOperation({
      pauseId: pauseState.id,
      claimId,
      expectedPhase: "pause_finalized",
      nextPhase: "completed",
    });
    return { continuation: null, phase: completed.phase };
  }

  let operation = await advanceResumeOperation({
    pauseId: pauseState.id,
    claimId,
    expectedPhase: "pause_finalized",
    nextPhase: "continuation_committed",
  });
  await options.transactionHooks?.afterContinuationCommitted?.(operation);

  if (options.invokeModel) {
    const continuation = await continueWorkflowAfterResume(pauseState.id, {
      invokeModel: options.invokeModel,
      model: options.continuationModel,
    });
    operation = await advanceResumeOperation({
      pauseId: pauseState.id,
      claimId,
      expectedPhase: "continuation_committed",
      nextPhase: continuation.ok ? "completed" : "failed",
      ...(!continuation.ok && { failureCode: "continuation_failed" }),
    });
    return { continuation, phase: operation.phase };
  }

  continueWorkflowAfterResume(pauseState.id, {
    model: options.continuationModel,
  }).then(async (result) => {
    await advanceResumeOperation({
      pauseId: pauseState.id,
      claimId,
      expectedPhase: "continuation_committed",
      nextPhase: result.ok ? "completed" : "failed",
      ...(!result.ok && { failureCode: "continuation_failed" }),
    });
  }).catch(async () => {
    await markResumeOperationRecoveryRequired({
      pauseId: pauseState.id,
      claimId,
      expectedPhase: "continuation_committed",
      failureCode: "continuation_outcome_ambiguous",
    }).catch(() => undefined);
  });
  return { continuation: null, phase: operation.phase };
}

async function reconcileResumeOperation(input: {
  operation: WorkflowResumeOperation;
  pauseState: PausedWorkflowState;
  task: Awaited<ReturnType<typeof globalTaskStore.loadTask>>;
  options: ResumeOptions;
}): Promise<ResumeResult> {
  if (input.operation.ownerInstanceId === getResumeRuntimeInstanceId()) {
    return { ok: false, reason: "Workflow resume is already active in this process.", code: "already_resumed" };
  }
  const lock = await claimResumeReconciliation(input.pauseState.id);
  if (!lock.ok) {
    return { ok: false, reason: "Workflow resume reconciliation is already active.", code: "already_resumed" };
  }

  try {
    let operation = await assertResumeOperationOwner({
      pauseId: input.pauseState.id,
      claimId: input.operation.claimId,
    });
    let pauseState = await loadPauseState(input.pauseState.id);
    let task = await globalTaskStore.loadTask(input.task.id);
    if (
      operation.projectId !== pauseState.projectId
      || operation.engagementId !== pauseState.engagementId
      || operation.workflowRunId !== pauseState.workflowRunId
      || operation.taskId !== task.id
      || pauseState.agentTaskId !== task.id
      || (input.options.expectedContext && (
        pauseState.projectId !== input.options.expectedContext.projectId
        || pauseState.engagementId !== input.options.expectedContext.engagementId
        || pauseState.workflowRunId !== input.options.expectedContext.workflowRunId
        || task.projectId !== input.options.expectedContext.projectId
        || task.engagementId !== input.options.expectedContext.engagementId
        || (task.workflowRunId && task.workflowRunId !== input.options.expectedContext.workflowRunId)
      ))
    ) {
      return { ok: false, reason: "Stored workflow recovery linkage is invalid.", code: "invalid_state" };
    }

    if (operation.phase === "claimed") {
      const executions = await globalExecutionStore.listByTaskId(task.id);
      if (
        executions.length === 0
        && pauseState.status === "waiting_for_approval"
        && task.approvalStatus === "approved"
        && (task.status === "queued" || task.status === "waiting_for_approval")
      ) {
        await releaseResumeOperationBeforeExecution({ pauseId: pauseState.id, claimId: operation.claimId });
      }
      return { ok: false, reason: "Workflow resume claim was reconciled without execution.", code: "already_resumed" };
    }

    if (operation.phase === "execution_committed") {
      await markResumeOperationRecoveryRequired({
        pauseId: pauseState.id,
        claimId: operation.claimId,
        expectedPhase: "execution_committed",
        failureCode: "restart_execution_outcome_ambiguous",
      });
      return { ok: false, reason: "Workflow resume requires recovery review.", code: "already_resumed" };
    }

    if (operation.phase === "task_completed") {
      if (!operation.executionId || task.status !== "completed") {
        await markResumeOperationRecoveryRequired({
          pauseId: pauseState.id,
          claimId: operation.claimId,
          expectedPhase: "task_completed",
          failureCode: "restart_task_completion_evidence_invalid",
        });
        return { ok: false, reason: "Workflow resume requires recovery review.", code: "already_resumed" };
      }
      try {
        const execution = await globalExecutionStore.loadExecution(operation.executionId);
        if (execution.agentTaskId !== task.id || execution.status !== "completed") throw new Error("invalid execution evidence");
      } catch {
        await markResumeOperationRecoveryRequired({
          pauseId: pauseState.id,
          claimId: operation.claimId,
          expectedPhase: "task_completed",
          failureCode: "restart_execution_evidence_invalid",
        });
        return { ok: false, reason: "Workflow resume requires recovery review.", code: "already_resumed" };
      }

      if (pauseState.status === "waiting_for_approval") {
        pauseState = await markPauseResumedWithClaim({
          id: pauseState.id,
          claimId: operation.claimId,
          resumedBy: input.options.resumedBy ?? operation.actorId,
        });
      } else if (pauseState.status !== "resumed") {
        await markResumeOperationRecoveryRequired({
          pauseId: pauseState.id,
          claimId: operation.claimId,
          expectedPhase: "task_completed",
          failureCode: "restart_pause_state_invalid",
        });
        return { ok: false, reason: "Workflow resume requires recovery review.", code: "already_resumed" };
      }
      operation = await advanceResumeOperation({
        pauseId: pauseState.id,
        claimId: operation.claimId,
        expectedPhase: "task_completed",
        nextPhase: "pause_finalized",
      });
    }

    if (operation.phase === "pause_finalized") {
      if (pauseState.status !== "resumed" || task.status !== "completed") {
        await markResumeOperationRecoveryRequired({
          pauseId: pauseState.id,
          claimId: operation.claimId,
          expectedPhase: "pause_finalized",
          failureCode: "restart_pause_finalization_evidence_invalid",
        });
        return { ok: false, reason: "Workflow resume requires recovery review.", code: "already_resumed" };
      }
      const continued = await continueClaimedResume({
        pauseState,
        task,
        claimId: operation.claimId,
        options: input.options,
      });
      return {
        ok: true,
        pauseState,
        taskStatus: "completed",
        auditEntry: buildResumeAuditEntry({
          task,
          pauseState,
          resumedAt: pauseState.resumedAt ?? operation.updatedAt,
          resumedBy: pauseState.resumedBy,
          status: "completed",
        }),
        continuation: continued.continuation,
      };
    }

    if (operation.phase === "continuation_committed") {
      await markResumeOperationRecoveryRequired({
        pauseId: pauseState.id,
        claimId: operation.claimId,
        expectedPhase: "continuation_committed",
        failureCode: "restart_continuation_outcome_ambiguous",
      });
    }
    return { ok: false, reason: "Workflow resume is already completed or requires recovery review.", code: "already_resumed" };
  } catch {
    const latest = await loadResumeOperation(input.pauseState.id).catch(() => null);
    if (
      latest
      && latest.claimId === input.operation.claimId
      && ["execution_committed", "task_completed", "pause_finalized", "continuation_committed"].includes(latest.phase)
    ) {
      await markResumeOperationRecoveryRequired({
        pauseId: latest.pauseId,
        claimId: latest.claimId,
        expectedPhase: latest.phase,
        failureCode: `restart_${latest.phase}_reconciliation_failed`,
      }).catch(() => undefined);
    }
    return { ok: false, reason: "Workflow resume requires recovery review.", code: "already_resumed" };
  } finally {
    await lock.release();
  }
}

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
  options: ResumeOptions = {},
): Promise<ResumeResult> {
  let pauseState: PausedWorkflowState;
  try {
    pauseState = await loadPauseState(pauseStateId);
  } catch {
    return { ok: false, reason: `Paused workflow state not found: "${pauseStateId}"`, code: "pause_not_found" };
  }

  let existingOperation: WorkflowResumeOperation | null = null;
  if (pauseState.status !== "waiting_for_approval") {
    existingOperation = await loadResumeOperation(pauseStateId).catch(() => null);
    if (!existingOperation) {
      return {
        ok: false,
        reason: `Pause state "${pauseStateId}" has status "${pauseState.status}" — expected "waiting_for_approval".`,
        code: "already_resumed",
      };
    }
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

  if (existingOperation) {
    return reconcileResumeOperation({ operation: existingOperation, pauseState, task, options });
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
    if (claim.operation) {
      return reconcileResumeOperation({ operation: claim.operation, pauseState, task, options });
    }
    return { ok: false, reason: "Workflow resume is already in progress or completed.", code: "already_resumed" };
  }

  const { claimId } = claim.operation;
  let currentPhase = claim.operation.phase;

  const failRecoveryRequired = async (failureCode: string) => {
    const durableOperation = await loadResumeOperation(pauseStateId).catch(() => null);
    if (durableOperation?.claimId === claimId) {
      currentPhase = durableOperation.phase;
    }
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

  const auditEntry = buildResumeAuditEntry({
    task,
    pauseState,
    resumedAt,
    resumedBy: options.resumedBy,
    status: execution.ok ? "completed" : "failed",
    ...(execution.ok ? {} : { error: execution.error?.message }),
  });

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

  const continued = await continueClaimedResume({ pauseState, task, claimId, options });
  currentPhase = continued.phase;

  return {
    ok: true,
    pauseState: { ...pauseState, status: "resumed", resumedAt, resumedBy: options.resumedBy },
    taskStatus: "completed",
    auditEntry,
    continuation: continued.continuation,
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
