import type { AgentTask } from "../agents/types";
import type { Project } from "../types/project";
import { AgentExecutor } from "../agents/executor";
import { globalTaskStore } from "../agents/task-store";
import { globalAgentRegistry, globalInstanceRegistry } from "../agents/registry";
import { globalExecutionStore } from "../agents/execution-store";
import { globalProviderRegistry } from "../ai/provider-registry";
import { savePauseState } from "./workflow-pause-store";
import { buildPauseState } from "./workflow-resume";

export type WorkflowAgentStepConfig = {
  agentId: string;
  title: string;
  objective: string;
  instructions?: string;
  requiresApproval?: boolean;
  provider?: string;
  model?: string;
};

export type WorkflowAgentAuditEntry = {
  type: "agent";
  agentId: string;
  taskId: string;
  title: string;
  status: "running" | "completed" | "failed" | "waiting-for-approval";
  startedAt: string;
  completedAt?: string;
  provider?: string;
  model?: string;
  error?: string;
  pauseStateId?: string;  // set when status is waiting-for-approval
};

function now() {
  return new Date().toISOString();
}

/**
 * Execute an agent step within a workflow.
 * Creates an AgentTask, runs it, and returns the audit entry.
 * Does not fail the workflow on error - returns error status for workflow to handle.
 */
export async function executeWorkflowAgentStep(options: {
  project: Project;
  step: WorkflowAgentStepConfig;
  workflowRunId?: string;
  departmentId?: string;
}): Promise<WorkflowAgentAuditEntry> {
  const { project, step, workflowRunId, departmentId } = options;
  const startedAt = now();

  try {
    // Verify agent exists and is enabled
    const agentDef = globalAgentRegistry.getById(step.agentId);
    if (!agentDef) {
      return {
        type: "agent",
        agentId: step.agentId,
        taskId: "unknown",
        title: step.title,
        status: "failed",
        startedAt,
        completedAt: now(),
        error: `Agent "${step.agentId}" not found.`,
      };
    }

    if (!agentDef.enabled) {
      return {
        type: "agent",
        agentId: step.agentId,
        taskId: "unknown",
        title: step.title,
        status: "failed",
        startedAt,
        completedAt: now(),
        error: `Agent "${step.agentId}" is disabled.`,
      };
    }

    // Create the task
    const taskId = `task-${step.agentId}-${Date.now()}`;
    const provider = step.provider || agentDef.defaultProvider;
    const task: AgentTask = {
      id: taskId,
      agentId: step.agentId,
      title: step.title,
      objective: step.objective,
      projectId: project.id,
      engagementId: project.id, // Link to engagement via project ID
      workflowRunId,
      departmentId,
      instructions: step.instructions,
      status: "queued",
      approvalStatus: step.requiresApproval ? "pending" : "not_required",
      priority: "high",
      provider: provider as "xai" | "mock",
      model: step.model || agentDef.defaultModel,
      createdAt: startedAt,
      updatedAt: startedAt,
    };

    // Save task to store
    await globalTaskStore.saveTask(task);

    // If approval required, persist pause state and return without executing
    if (step.requiresApproval) {
      const pauseId = `pause-${task.id}-${Date.now()}`;
      const pause = buildPauseState({
        pauseId,
        workflowRunId: workflowRunId ?? `run-${project.id}`,
        projectId: project.id,
        engagementId: project.id,
        stepId: departmentId ?? step.agentId,
        agentTaskId: task.id,
        completedStepIds: [],
        failedStepIds: [],
        pendingStepIds: [],
      });
      // Persist to disk — non-blocking failure: log and continue
      savePauseState(pause).catch((e: unknown) => {
        console.warn(
          "workflow-pause-persist-failed",
          pause.id,
          e instanceof Error ? e.message : String(e),
        );
      });

      return {
        type: "agent",
        agentId: step.agentId,
        taskId: task.id,
        title: step.title,
        status: "waiting-for-approval",
        startedAt,
        provider: task.provider,
        model: task.model,
        pauseStateId: pauseId,
      };
    }

    // Execute the task
    const executor = new AgentExecutor({
      taskStore: globalTaskStore,
      executionStore: globalExecutionStore,
      agentRegistry: globalAgentRegistry,
      instanceRegistry: globalInstanceRegistry,
      providerRegistry: globalProviderRegistry,
    });
    const execution = await executor.execute(task.id);

    if (!execution.ok) {
      // Mark task as failed and return error
      const failedTask = {
        ...task,
        status: "failed" as const,
        error: execution.error.message,
        updatedAt: now(),
      };
      await globalTaskStore.saveTask(failedTask);

      return {
        type: "agent",
        agentId: step.agentId,
        taskId: task.id,
        title: step.title,
        status: "failed",
        startedAt,
        completedAt: now(),
        provider: task.provider,
        model: task.model,
        error: execution.error.message,
      };
    }

    // Update task to completed
    const completedTask = {
      ...task,
      status: "completed" as const,
      output: JSON.stringify(execution.output),
      updatedAt: now(),
    };
    await globalTaskStore.saveTask(completedTask);

    return {
      type: "agent",
      agentId: step.agentId,
      taskId: task.id,
      title: step.title,
      status: "completed",
      startedAt,
      completedAt: now(),
      provider: task.provider,
      model: task.model,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const taskId = `task-${step.agentId}-error-${Date.now()}`;
    return {
      type: "agent",
      agentId: step.agentId,
      taskId,
      title: step.title,
      status: "failed",
      startedAt,
      completedAt: now(),
      error: message,
    };
  }
}
