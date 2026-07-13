/**
 * GET /api/agent-tasks/[id]
 *
 * Return task detail with associated executions, approval status, and output.
 * Redacts unsafe raw provider data.
 */

import { NextResponse } from "next/server";
import { globalTaskStore, globalExecutionStore, globalAgentRegistry, AgentExecutorError } from "@/agents";
import { errorResponse, successResponse } from "../../agent-routes-helper";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

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

    // Load executions for this task
    const executions = await globalExecutionStore.listByTaskId(id);

    // Redact unsafe data: remove rawResponse from executions before sending
    const safeExecutions = executions.map((exec) => ({
      id: exec.id,
      agentTaskId: exec.agentTaskId,
      agentId: exec.agentId,
      provider: exec.provider,
      model: exec.model,
      status: exec.status,
      attempt: exec.attempt,
      validationResult: exec.validationResult,
      usage: exec.usage,
      estimatedCost: exec.estimatedCost ?? null,
      error: exec.error,
      startedAt: exec.startedAt,
      completedAt: exec.completedAt,
    }));

    const agent = globalAgentRegistry.getPublicMetadata(task.agentId);

    return successResponse({
      task: {
        ...task,
        output: task.structuredOutput || task.output,
        usage: task.usage
          ? {
              input_tokens: task.usage.inputTokens,
              output_tokens: task.usage.outputTokens,
              total_tokens: task.usage.totalTokens,
            }
          : undefined,
        estimatedCost: task.cost ?? safeExecutions.at(-1)?.estimatedCost ?? null,
        error: task.error ?? null,
      },
      agent: {
        name: agent?.name ?? task.agentId,
        role: agent?.role ?? "unknown",
      },
      executions: safeExecutions,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return errorResponse("INTERNAL_ERROR", message, 500);
  }
}
