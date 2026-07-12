/**
 * GET /api/agent-tasks/[id]
 *
 * Return task detail with associated executions, approval status, and output.
 * Redacts unsafe raw provider data.
 */

import { NextResponse } from "next/server";
import { globalTaskStore, globalExecutionStore, AgentExecutorError } from "@/agents";
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
      ...exec,
      // Don't include rawResponse in API response - it may contain logs with secrets
      rawResponse: undefined,
    }));

    return successResponse({
      task,
      executions: safeExecutions,
      approvalStatus: task.approvalStatus,
      output: task.structuredOutput || task.output,
      evidence: task.evidence,
      usage: task.usage,
      cost: task.cost,
      error: task.error,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return errorResponse("INTERNAL_ERROR", message, 500);
  }
}
