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
import {
  buildCollaborationTraceSummary,
  evaluateLiveVerificationGuard,
  redactSecrets,
  type CollaborationTraceStep,
} from "../services/live-verification-utils";

function makeTask(input: {
  id: string;
  agentId: string;
  objective: string;
  instructions?: string;
  workflowRunId: string;
  model: string;
}): AgentTask {
  const now = new Date().toISOString();
  return {
    id: input.id,
    workflowRunId: input.workflowRunId,
    agentId: input.agentId,
    title: `Collaboration verification - ${input.agentId}`,
    objective: input.objective,
    instructions: input.instructions,
    status: "queued",
    priority: "medium",
    provider: "xai",
    model: input.model,
    approvalStatus: "not_required",
    requestedBy: "verification-script",
    createdAt: now,
    updatedAt: now,
  };
}

function toStep(task: AgentTask, status: "completed" | "failed", completedAt: string): CollaborationTraceStep {
  return {
    taskId: task.id,
    agentId: task.agentId,
    provider: task.provider,
    model: task.model,
    status,
    startedAt: task.startedAt || task.createdAt,
    completedAt,
    summary: task.structuredOutput ? JSON.stringify(task.structuredOutput).slice(0, 200) : undefined,
    error: task.error,
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

  const workflowRunId = `verify-collab-${Date.now()}`;
  const model = guard.config.defaultModel;

  const taskA = makeTask({
    id: `${workflowRunId}-orchestrator`,
    workflowRunId,
    agentId: "orchestrator",
    model,
    objective: "Create a compact project plan for collaboration smoke verification.",
  });

  const taskB = makeTask({
    id: `${workflowRunId}-researcher`,
    workflowRunId,
    agentId: "researcher",
    model,
    objective: "Create a compact research output for collaboration smoke verification.",
    instructions: `Use handoff context from previous task: ${taskA.id}`,
  });

  const executor = new AgentExecutor({
    taskStore: globalTaskStore,
    executionStore: globalExecutionStore,
    agentRegistry: globalAgentRegistry,
    instanceRegistry: globalInstanceRegistry,
    providerRegistry,
  });

  await globalTaskStore.saveTask(taskA);
  const runA = await executor.execute(taskA.id);
  const loadedA = await globalTaskStore.loadTask(taskA.id);

  if (!runA.ok) {
    const summary = buildCollaborationTraceSummary({
      workflowRunId,
      steps: [
        {
          taskId: taskA.id,
          agentId: taskA.agentId,
          provider: taskA.provider,
          model: taskA.model,
          status: "failed",
          startedAt: taskA.createdAt,
          completedAt: new Date().toISOString(),
          error: runA.error.message,
        },
      ],
    });
    console.log(JSON.stringify({ verification: "agent-collaboration", status: "failed", summary }, null, 2));
    process.exit(1);
  }

  await globalTaskStore.saveTask(taskB);
  const runB = await executor.execute(taskB.id);
  const loadedB = await globalTaskStore.loadTask(taskB.id);

  const steps: CollaborationTraceStep[] = [
    toStep(loadedA, runA.ok ? "completed" : "failed", new Date().toISOString()),
    toStep(loadedB, runB.ok ? "completed" : "failed", new Date().toISOString()),
  ];

  const summary = buildCollaborationTraceSummary({
    workflowRunId,
    steps,
  });

  const status = runA.ok && runB.ok ? "ok" : "failed";

  console.log(
    JSON.stringify(
      {
        verification: "agent-collaboration",
        status,
        summary,
      },
      null,
      2,
    ),
  );

  if (!runB.ok) {
    process.exit(1);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`Verification failed: ${redactSecrets(message)}`);
  process.exit(1);
});