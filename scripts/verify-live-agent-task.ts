import {
  AgentExecutor,
  globalAgentRegistry,
  globalExecutionStore,
  globalInstanceRegistry,
  globalTaskStore,
  type AgentTask,
} from "../agents";
import { AIProviderRegistry } from "../ai/provider-registry";
import { createXAIProvider } from "../ai/xai-provider";
import { evaluateLiveVerificationGuard, redactSecrets } from "../services/live-verification-utils";

function buildTask(agentId: string, model: string): AgentTask {
  const now = new Date().toISOString();
  const id = `verify-live-${agentId}-${Date.now()}`;

  return {
    id,
    agentId,
    title: "Live verification task",
    objective: "Create a concise structured output for live verification.",
    status: "queued",
    priority: "medium",
    provider: "xai",
    model,
    approvalStatus: "not_required",
    createdAt: now,
    updatedAt: now,
    requestedBy: "verification-script",
  };
}

async function main() {
  const guard = evaluateLiveVerificationGuard();
  if (!guard.ok) {
    console.error("NOT RUN - live verification guard failed.");
    for (const reason of guard.reasons) {
      console.error(`- ${reason}`);
    }
    process.exit(1);
  }

  const xai = createXAIProvider();
  if (!xai.ok) {
    console.error(`Provider init failed: ${redactSecrets(xai.error.message)}`);
    process.exit(1);
  }

  const providerRegistry = new AIProviderRegistry();
  providerRegistry.register("xai", xai.provider);

  const agentId = "orchestrator";
  const task = buildTask(agentId, guard.config.defaultModel);
  await globalTaskStore.saveTask(task);

  const executor = new AgentExecutor({
    taskStore: globalTaskStore,
    executionStore: globalExecutionStore,
    agentRegistry: globalAgentRegistry,
    instanceRegistry: globalInstanceRegistry,
    providerRegistry,
  });

  const result = await executor.execute(task.id);
  const executions = await globalExecutionStore.listByTaskId(task.id);
  const latest = executions[executions.length - 1];

  if (!result.ok) {
    console.error(
      JSON.stringify(
        {
          verification: "live-agent-task",
          status: "failed",
          taskId: task.id,
          agentId,
          provider: "xai",
          model: guard.config.defaultModel,
          error: redactSecrets(result.error.message),
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }

  console.log(
    JSON.stringify(
      {
        verification: "live-agent-task",
        status: "ok",
        taskId: result.task.id,
        agentId: result.task.agentId,
        provider: latest?.provider || result.task.provider,
        model: latest?.model || result.task.model,
        executionStatus: latest?.status || "completed",
        startedAt: latest?.startedAt || result.task.startedAt || null,
        completedAt: latest?.completedAt || result.task.completedAt || null,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`Verification failed: ${redactSecrets(message)}`);
  process.exit(1);
});