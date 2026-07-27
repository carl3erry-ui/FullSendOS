/**
 * POST /api/agent-tasks/[id]/run
 *
 * Execute the agent task through AgentExecutor.
 * Maps executor errors to appropriate HTTP statuses.
 */

import { NextResponse } from "next/server";
import {
  type AgentExecution,
  type AgentTask,
  globalTaskStore,
  globalExecutionStore,
  globalAgentRegistry,
  globalInstanceRegistry,
  AgentExecutor,
  AgentExecutorError,
} from "@/agents";
import { AIProviderRegistry } from "@/ai/provider-registry";
import { createMockProvider } from "@/ai/mock-provider";
import { createXAIProvider } from "@/ai/xai-provider";
import {
  errorResponse,
  successResponse,
  mapExecutorErrorToResponse,
} from "../../../agent-routes-helper";
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

/**
 * Initialize provider registry with configured providers.
 * Respects AI_PROVIDER_MODE environment variable.
 */
function createProviderRegistry(): AIProviderRegistry {
  const registry = new AIProviderRegistry();
  registry.register("mock", createMockProvider());

  const xaiResult = createXAIProvider();
  if (xaiResult.ok) {
    registry.register("xai", xaiResult.provider);
  }

  return registry;
}

function sanitizeExecutionForResponse(execution: AgentExecution) {
  return {
    id: execution.id,
    agentTaskId: execution.agentTaskId,
    agentId: execution.agentId,
    provider: execution.provider,
    model: execution.model,
    status: execution.status,
    attempt: execution.attempt,
    validationResult: execution.validationResult,
    usage: execution.usage,
    estimatedCost: execution.estimatedCost ?? null,
    error: execution.error,
    startedAt: execution.startedAt,
    completedAt: execution.completedAt,
  };
}

function sanitizeTaskForResponse(task: AgentTask) {
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
    action: "agent_task_run",
    resourceType: "agent_task",
    resourceId: "unknown",
  };

  try {
    const { id } = await params;
    action.resourceId = id;

    actor = await requireAuthenticatedActor(request, action);

    let task: AgentTask;
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
      action: "run",
    });

    const providerRegistry = createProviderRegistry();

    const executor = new AgentExecutor({
      taskStore: globalTaskStore,
      executionStore: globalExecutionStore,
      agentRegistry: globalAgentRegistry,
      instanceRegistry: globalInstanceRegistry,
      providerRegistry,
    });

    const result = await executor.execute(id);

    if (!result.ok) {
      return mapExecutorErrorToResponse(result.error);
    }

    await recordAllow(actor, action, "agent_task_run_executed");

    return successResponse({
      task: sanitizeTaskForResponse(result.task),
      execution: sanitizeExecutionForResponse(result.execution),
      output: result.output,
    });
  } catch (error) {
    if (isSecurityRouteError(error)) {
      if (error.status !== 401) {
        await recordDeny(actor, action, error.reasonCode);
      }
      return toSecurityErrorResponse(error);
    }

    if (error instanceof AgentExecutorError) {
      return mapExecutorErrorToResponse(error);
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    return errorResponse("INTERNAL_ERROR", message, 500);
  }
}
