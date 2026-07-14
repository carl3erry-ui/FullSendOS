/**
 * POST /api/agent-tasks/[id]/run
 *
 * Execute the agent task through AgentExecutor.
 * Maps executor errors to appropriate HTTP statuses.
 */

import { NextResponse } from "next/server";
import {
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

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

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

    return successResponse({
      task: result.task,
      execution: result.execution,
      output: result.output,
    });
  } catch (error) {
    if (error instanceof AgentExecutorError) {
      return mapExecutorErrorToResponse(error);
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    return errorResponse("INTERNAL_ERROR", message, 500);
  }
}
