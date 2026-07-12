import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { createMockProvider } from "../ai/mock-provider";
import { AIProviderRegistry } from "../ai/provider-registry";
import { OrchestratorAgent } from "../agents/definitions/orchestrator";
import { QualityControlAgent } from "../agents/definitions/quality-control";
import { ResearcherAgent } from "../agents/definitions/researcher";
import { AgentExecutorError } from "../agents/errors";
import { AgentExecutionStore } from "../agents/execution-store";
import { AgentExecutor } from "../agents/executor";
import { AgentInstanceRegistry, AgentRegistry } from "../agents/registry";
import { AgentTaskStore } from "../agents/task-store";
import { AgentTaskSchema, type AgentTask } from "../agents/types";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function tmpDir(label: string) {
  return join(tmpdir(), `fsos-agent-test-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
}

async function cleanDir(dir: string) {
  await rm(dir, { recursive: true, force: true });
}

function buildTask(overrides: Partial<AgentTask> = {}): AgentTask {
  return AgentTaskSchema.parse({
    id: `task-test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    agentId: "orchestrator",
    title: "Test engagement plan",
    objective: "Develop a consulting plan for a test client",
    status: "queued",
    provider: "mock",
    model: "mock-1.0",
    approvalStatus: "not_required",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  });
}

function createRegistries() {
  const agentRegistry = new AgentRegistry();
  const instanceRegistry = new AgentInstanceRegistry();
  const providerRegistry = new AIProviderRegistry();

  agentRegistry.register(new OrchestratorAgent().definition);
  agentRegistry.register(new ResearcherAgent().definition);
  agentRegistry.register(new QualityControlAgent().definition);

  instanceRegistry.register(new OrchestratorAgent());
  instanceRegistry.register(new ResearcherAgent());
  instanceRegistry.register(new QualityControlAgent());

  providerRegistry.register("mock", createMockProvider());

  return { agentRegistry, instanceRegistry, providerRegistry };
}

function createExecutor(
  taskStore: AgentTaskStore,
  executionStore: AgentExecutionStore,
) {
  const { agentRegistry, instanceRegistry, providerRegistry } = createRegistries();
  return new AgentExecutor({ taskStore, executionStore, agentRegistry, instanceRegistry, providerRegistry });
}

// ---------------------------------------------------------------------------
// 1. Create / load / list task
// ---------------------------------------------------------------------------

test("AgentTaskStore: save and load a task round-trips correctly", async () => {
  const dir = tmpDir("save-load");
  const store = new AgentTaskStore(dir);
  try {
    const task = buildTask();
    await store.saveTask(task);
    const loaded = await store.loadTask(task.id);
    assert.equal(loaded.id, task.id);
    assert.equal(loaded.agentId, task.agentId);
    assert.equal(loaded.status, "queued");
  } finally {
    await cleanDir(dir);
  }
});

test("AgentTaskStore: listTasks returns all saved tasks", async () => {
  const dir = tmpDir("list-tasks");
  const store = new AgentTaskStore(dir);
  try {
    await store.saveTask(buildTask({ id: "t1" }));
    await store.saveTask(buildTask({ id: "t2" }));
    await store.saveTask(buildTask({ id: "t3" }));
    const tasks = await store.listTasks();
    assert.equal(tasks.length, 3);
  } finally {
    await cleanDir(dir);
  }
});

// ---------------------------------------------------------------------------
// 2. Filter by engagementId
// ---------------------------------------------------------------------------

test("AgentTaskStore: listTasks filters by engagementId", async () => {
  const dir = tmpDir("filter-engagement");
  const store = new AgentTaskStore(dir);
  try {
    await store.saveTask(buildTask({ id: "t1", engagementId: "eng-abc" }));
    await store.saveTask(buildTask({ id: "t2", engagementId: "eng-abc" }));
    await store.saveTask(buildTask({ id: "t3", engagementId: "eng-xyz" }));
    const results = await store.listTasks({ engagementId: "eng-abc" });
    assert.equal(results.length, 2);
    assert.ok(results.every((t) => t.engagementId === "eng-abc"));
  } finally {
    await cleanDir(dir);
  }
});

// ---------------------------------------------------------------------------
// 3. Filter by agentId
// ---------------------------------------------------------------------------

test("AgentTaskStore: listTasks filters by agentId", async () => {
  const dir = tmpDir("filter-agent");
  const store = new AgentTaskStore(dir);
  try {
    await store.saveTask(buildTask({ id: "t1", agentId: "orchestrator" }));
    await store.saveTask(buildTask({ id: "t2", agentId: "researcher" }));
    await store.saveTask(buildTask({ id: "t3", agentId: "orchestrator" }));
    const results = await store.listTasks({ agentId: "orchestrator" });
    assert.equal(results.length, 2);
    assert.ok(results.every((t) => t.agentId === "orchestrator"));
  } finally {
    await cleanDir(dir);
  }
});

// ---------------------------------------------------------------------------
// 4. Update task status
// ---------------------------------------------------------------------------

test("AgentTaskStore: saving updated task reflects new status", async () => {
  const dir = tmpDir("update-status");
  const store = new AgentTaskStore(dir);
  try {
    const task = buildTask();
    await store.saveTask(task);
    const updated: AgentTask = {
      ...task,
      status: "completed",
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await store.saveTask(updated);
    const loaded = await store.loadTask(task.id);
    assert.equal(loaded.status, "completed");
    assert.ok(loaded.completedAt);
  } finally {
    await cleanDir(dir);
  }
});

// ---------------------------------------------------------------------------
// 5. Create / list execution records
// ---------------------------------------------------------------------------

test("AgentExecutionStore: save and load execution round-trips correctly", async () => {
  const dir = tmpDir("exec-save");
  const store = new AgentExecutionStore(dir);
  try {
    const exec = {
      id: "exec-001",
      agentTaskId: "task-001",
      agentId: "orchestrator",
      provider: "mock" as const,
      model: "mock-1.0",
      status: "completed" as const,
      attempt: 1,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };
    await store.saveExecution(exec);
    const loaded = await store.loadExecution("exec-001");
    assert.equal(loaded.id, "exec-001");
    assert.equal(loaded.status, "completed");
  } finally {
    await cleanDir(dir);
  }
});

test("AgentExecutionStore: listByTaskId returns executions for the task", async () => {
  const dir = tmpDir("exec-list");
  const store = new AgentExecutionStore(dir);
  try {
    const base = {
      agentId: "orchestrator",
      provider: "mock" as const,
      model: "mock-1.0",
      status: "completed" as const,
      startedAt: new Date().toISOString(),
    };
    await store.saveExecution({ ...base, id: "exec-t1-1", agentTaskId: "task-001", attempt: 1 });
    await store.saveExecution({ ...base, id: "exec-t1-2", agentTaskId: "task-001", attempt: 2 });
    await store.saveExecution({ ...base, id: "exec-t2-1", agentTaskId: "task-002", attempt: 1 });
    const results = await store.listByTaskId("task-001");
    assert.equal(results.length, 2);
    assert.ok(results.every((e) => e.agentTaskId === "task-001"));
    assert.equal(results[0].attempt, 1);
    assert.equal(results[1].attempt, 2);
  } finally {
    await cleanDir(dir);
  }
});

// ---------------------------------------------------------------------------
// 6. Mock provider execution completes successfully (orchestrator)
// ---------------------------------------------------------------------------

test("AgentExecutor: orchestrator task completes with mock provider", async () => {
  const taskDir = tmpDir("exec-orch-tasks");
  const execDir = tmpDir("exec-orch-execs");
  const taskStore = new AgentTaskStore(taskDir);
  const executionStore = new AgentExecutionStore(execDir);
  const executor = createExecutor(taskStore, executionStore);
  try {
    const task = buildTask({ agentId: "orchestrator" });
    await taskStore.saveTask(task);
    const result = await executor.execute(task.id);
    assert.ok(result.ok, result.ok ? "" : `Expected ok, got: ${result.error.message}`);
    if (result.ok) {
      assert.equal(result.task.status, "completed");
      assert.ok(result.task.completedAt);
      assert.ok(result.execution.status === "completed");
      assert.ok(result.output !== null);
    }
  } finally {
    await cleanDir(taskDir);
    await cleanDir(execDir);
  }
});

// ---------------------------------------------------------------------------
// 7. Orchestrator output validates against schema
// ---------------------------------------------------------------------------

test("AgentExecutor: orchestrator output is a valid OrchestratorOutput", async () => {
  const taskDir = tmpDir("orch-schema-tasks");
  const execDir = tmpDir("orch-schema-execs");
  const taskStore = new AgentTaskStore(taskDir);
  const executionStore = new AgentExecutionStore(execDir);
  const executor = createExecutor(taskStore, executionStore);
  try {
    const { OrchestratorOutputSchema } = await import("../agents/output-schemas");
    const task = buildTask({ agentId: "orchestrator" });
    await taskStore.saveTask(task);
    const result = await executor.execute(task.id);
    assert.ok(result.ok);
    if (result.ok) {
      const parsed = OrchestratorOutputSchema.safeParse(result.output);
      assert.ok(parsed.success, "Orchestrator output must conform to OrchestratorOutputSchema");
    }
  } finally {
    await cleanDir(taskDir);
    await cleanDir(execDir);
  }
});

// ---------------------------------------------------------------------------
// 8. Research task execution validates structured output
// ---------------------------------------------------------------------------

test("AgentExecutor: researcher task output is a valid ResearchOutput", async () => {
  const taskDir = tmpDir("res-schema-tasks");
  const execDir = tmpDir("res-schema-execs");
  const taskStore = new AgentTaskStore(taskDir);
  const executionStore = new AgentExecutionStore(execDir);
  const executor = createExecutor(taskStore, executionStore);
  try {
    const { ResearchOutputSchema } = await import("../agents/output-schemas");
    const task = buildTask({ agentId: "researcher" });
    await taskStore.saveTask(task);
    const result = await executor.execute(task.id);
    assert.ok(result.ok);
    if (result.ok) {
      const parsed = ResearchOutputSchema.safeParse(result.output);
      assert.ok(parsed.success, "Research output must conform to ResearchOutputSchema");
    }
  } finally {
    await cleanDir(taskDir);
    await cleanDir(execDir);
  }
});

// ---------------------------------------------------------------------------
// 9. Quality Control task execution validates structured output
// ---------------------------------------------------------------------------

test("AgentExecutor: quality-control task output is a valid QualityControlOutput", async () => {
  const taskDir = tmpDir("qc-schema-tasks");
  const execDir = tmpDir("qc-schema-execs");
  const taskStore = new AgentTaskStore(taskDir);
  const executionStore = new AgentExecutionStore(execDir);
  const executor = createExecutor(taskStore, executionStore);
  try {
    const { QualityControlOutputSchema } = await import("../agents/output-schemas");
    const task = buildTask({ agentId: "quality-control" });
    await taskStore.saveTask(task);
    const result = await executor.execute(task.id);
    assert.ok(result.ok);
    if (result.ok) {
      const parsed = QualityControlOutputSchema.safeParse(result.output);
      assert.ok(parsed.success, "QC output must conform to QualityControlOutputSchema");
    }
  } finally {
    await cleanDir(taskDir);
    await cleanDir(execDir);
  }
});

// ---------------------------------------------------------------------------
// 10. Missing task returns task-not-found error
// ---------------------------------------------------------------------------

test("AgentExecutor: missing task returns task_not_found error", async () => {
  const taskDir = tmpDir("missing-task");
  const execDir = tmpDir("missing-exec");
  const executor = createExecutor(new AgentTaskStore(taskDir), new AgentExecutionStore(execDir));
  try {
    const result = await executor.execute("nonexistent-task-id");
    assert.ok(!result.ok);
    if (!result.ok) {
      assert.equal(result.error.code, "task_not_found");
    }
  } finally {
    await cleanDir(taskDir);
    await cleanDir(execDir);
  }
});

// ---------------------------------------------------------------------------
// 11. Unknown agent returns agent-not-found error
// ---------------------------------------------------------------------------

test("AgentExecutor: unknown agentId returns agent_not_found error", async () => {
  const taskDir = tmpDir("unknown-agent-tasks");
  const execDir = tmpDir("unknown-agent-execs");
  const taskStore = new AgentTaskStore(taskDir);
  const executionStore = new AgentExecutionStore(execDir);
  const executor = createExecutor(taskStore, executionStore);
  try {
    const task = buildTask({ agentId: "no-such-agent" });
    await taskStore.saveTask(task);
    const result = await executor.execute(task.id);
    assert.ok(!result.ok);
    if (!result.ok) {
      assert.equal(result.error.code, "agent_not_found");
    }
  } finally {
    await cleanDir(taskDir);
    await cleanDir(execDir);
  }
});

// ---------------------------------------------------------------------------
// 12. Disabled agent is rejected
// ---------------------------------------------------------------------------

test("AgentExecutor: disabled agent returns agent_disabled error", async () => {
  const taskDir = tmpDir("disabled-tasks");
  const execDir = tmpDir("disabled-execs");
  const taskStore = new AgentTaskStore(taskDir);
  const executionStore = new AgentExecutionStore(execDir);
  // Register a disabled agent
  const agentRegistry = new AgentRegistry();
  const instanceRegistry = new AgentInstanceRegistry();
  const providerRegistry = new AIProviderRegistry();
  const disabledAgent = new OrchestratorAgent();
  // Override enabled to false
  const disabledDef = { ...disabledAgent.definition, enabled: false };
  agentRegistry.register(disabledDef);
  instanceRegistry.register(disabledAgent);
  providerRegistry.register("mock", createMockProvider());
  const executor = new AgentExecutor({ taskStore, executionStore, agentRegistry, instanceRegistry, providerRegistry });
  try {
    const task = buildTask({ agentId: "orchestrator" });
    await taskStore.saveTask(task);
    const result = await executor.execute(task.id);
    assert.ok(!result.ok);
    if (!result.ok) {
      assert.equal(result.error.code, "agent_disabled");
    }
  } finally {
    await cleanDir(taskDir);
    await cleanDir(execDir);
  }
});

// ---------------------------------------------------------------------------
// 13. Unknown provider is rejected
// ---------------------------------------------------------------------------

test("AgentExecutor: unregistered provider returns provider_not_found error", async () => {
  const taskDir = tmpDir("no-provider-tasks");
  const execDir = tmpDir("no-provider-execs");
  const taskStore = new AgentTaskStore(taskDir);
  const executionStore = new AgentExecutionStore(execDir);
  // Build executor without the mock provider registered
  const agentRegistry = new AgentRegistry();
  const instanceRegistry = new AgentInstanceRegistry();
  const providerRegistry = new AIProviderRegistry(); // empty — no mock registered
  agentRegistry.register(new OrchestratorAgent().definition);
  instanceRegistry.register(new OrchestratorAgent());
  const executor = new AgentExecutor({ taskStore, executionStore, agentRegistry, instanceRegistry, providerRegistry });
  try {
    const task = buildTask({ provider: "mock" });
    await taskStore.saveTask(task);
    const result = await executor.execute(task.id);
    assert.ok(!result.ok);
    if (!result.ok) {
      assert.equal(result.error.code, "provider_not_found");
    }
  } finally {
    await cleanDir(taskDir);
    await cleanDir(execDir);
  }
});

// ---------------------------------------------------------------------------
// 14. Approval-required task is rejected
// ---------------------------------------------------------------------------

test("AgentExecutor: task with approvalStatus=pending is rejected", async () => {
  const taskDir = tmpDir("approval-tasks");
  const execDir = tmpDir("approval-execs");
  const taskStore = new AgentTaskStore(taskDir);
  const executionStore = new AgentExecutionStore(execDir);
  const executor = createExecutor(taskStore, executionStore);
  try {
    const task = buildTask({ approvalStatus: "pending" });
    await taskStore.saveTask(task);
    const result = await executor.execute(task.id);
    assert.ok(!result.ok);
    if (!result.ok) {
      assert.equal(result.error.code, "approval_required");
    }
  } finally {
    await cleanDir(taskDir);
    await cleanDir(execDir);
  }
});

// ---------------------------------------------------------------------------
// 15. Running task duplicate execution is rejected
// ---------------------------------------------------------------------------

test("AgentExecutor: task with status=running returns task_already_running", async () => {
  const taskDir = tmpDir("running-dup-tasks");
  const execDir = tmpDir("running-dup-execs");
  const taskStore = new AgentTaskStore(taskDir);
  const executionStore = new AgentExecutionStore(execDir);
  const executor = createExecutor(taskStore, executionStore);
  try {
    const task = buildTask({ status: "running", startedAt: new Date().toISOString() });
    await taskStore.saveTask(task);
    const result = await executor.execute(task.id);
    assert.ok(!result.ok);
    if (!result.ok) {
      assert.equal(result.error.code, "task_already_running");
    }
  } finally {
    await cleanDir(taskDir);
    await cleanDir(execDir);
  }
});

// ---------------------------------------------------------------------------
// 16. Completed task rerun is rejected
// ---------------------------------------------------------------------------

test("AgentExecutor: task with status=completed returns task_already_completed", async () => {
  const taskDir = tmpDir("completed-dup-tasks");
  const execDir = tmpDir("completed-dup-execs");
  const taskStore = new AgentTaskStore(taskDir);
  const executionStore = new AgentExecutionStore(execDir);
  const executor = createExecutor(taskStore, executionStore);
  try {
    const task = buildTask({
      status: "completed",
      completedAt: new Date().toISOString(),
    });
    await taskStore.saveTask(task);
    const result = await executor.execute(task.id);
    assert.ok(!result.ok);
    if (!result.ok) {
      assert.equal(result.error.code, "task_already_completed");
    }
  } finally {
    await cleanDir(taskDir);
    await cleanDir(execDir);
  }
});

// ---------------------------------------------------------------------------
// 17. Provider failure marks task and execution failed
// ---------------------------------------------------------------------------

test("AgentExecutor: provider error marks task and execution as failed", async () => {
  const taskDir = tmpDir("provider-fail-tasks");
  const execDir = tmpDir("provider-fail-execs");
  const taskStore = new AgentTaskStore(taskDir);
  const executionStore = new AgentExecutionStore(execDir);
  // Build a provider that always throws
  const failingProvider = {
    async generateText() { throw new Error("Simulated provider failure"); },
    async generateStructuredResult() { throw new Error("Simulated provider failure"); },
  };
  const agentRegistry = new AgentRegistry();
  const instanceRegistry = new AgentInstanceRegistry();
  const providerRegistry = new AIProviderRegistry();
  agentRegistry.register(new OrchestratorAgent().definition);
  instanceRegistry.register(new OrchestratorAgent());
  providerRegistry.register("mock", failingProvider);
  const executor = new AgentExecutor({ taskStore, executionStore, agentRegistry, instanceRegistry, providerRegistry });
  try {
    const task = buildTask();
    await taskStore.saveTask(task);
    const result = await executor.execute(task.id);
    assert.ok(!result.ok);
    if (!result.ok) {
      assert.ok(result.task);
      assert.equal(result.task?.status, "failed");
      assert.ok(result.execution);
      assert.equal(result.execution?.status, "failed");
      assert.ok(result.task?.error);
      assert.ok(result.task?.failedAt);
    }
  } finally {
    await cleanDir(taskDir);
    await cleanDir(execDir);
  }
});

// ---------------------------------------------------------------------------
// 18. Invalid structured output marks task and execution failed
// ---------------------------------------------------------------------------

test("AgentExecutor: schema-invalid output marks task and execution as failed", async () => {
  const taskDir = tmpDir("bad-output-tasks");
  const execDir = tmpDir("bad-output-execs");
  const taskStore = new AgentTaskStore(taskDir);
  const executionStore = new AgentExecutionStore(execDir);
  // Build a provider that returns invalid output (missing required fields)
  const { z } = await import("zod");
  const badProvider = {
    async generateText() { return { text: "{}", model: "bad", provider: "mock" }; },
    async generateStructuredResult<T>(_req: unknown, schema: { parse: (v: unknown) => T }) {
      return schema.parse({ this_is_wrong: true }); // will fail Zod parse
    },
  };
  const agentRegistry = new AgentRegistry();
  const instanceRegistry = new AgentInstanceRegistry();
  const providerRegistry = new AIProviderRegistry();
  agentRegistry.register(new OrchestratorAgent().definition);
  instanceRegistry.register(new OrchestratorAgent());
  providerRegistry.register("mock", badProvider);
  const executor = new AgentExecutor({ taskStore, executionStore, agentRegistry, instanceRegistry, providerRegistry });
  try {
    const task = buildTask();
    await taskStore.saveTask(task);
    const result = await executor.execute(task.id);
    assert.ok(!result.ok);
    if (!result.ok) {
      assert.ok(result.task?.status === "failed");
      assert.ok(result.execution?.status === "failed");
    }
  } finally {
    await cleanDir(taskDir);
    await cleanDir(execDir);
  }
});

// ---------------------------------------------------------------------------
// 19. Usage is persisted when provider returns it
// ---------------------------------------------------------------------------

test("AgentExecutor: task is saved with output and execution record created", async () => {
  const taskDir = tmpDir("usage-tasks");
  const execDir = tmpDir("usage-execs");
  const taskStore = new AgentTaskStore(taskDir);
  const executionStore = new AgentExecutionStore(execDir);
  const executor = createExecutor(taskStore, executionStore);
  try {
    const task = buildTask({ agentId: "orchestrator" });
    await taskStore.saveTask(task);
    const result = await executor.execute(task.id);
    assert.ok(result.ok);
    if (result.ok) {
      // Execution record exists and is linked to the task
      const executions = await executionStore.listByTaskId(task.id);
      assert.equal(executions.length, 1);
      assert.equal(executions[0].status, "completed");
      assert.equal(executions[0].agentTaskId, task.id);
      assert.ok(executions[0].systemPromptSnapshot?.includes("Orchestrator"));
    }
  } finally {
    await cleanDir(taskDir);
    await cleanDir(execDir);
  }
});

// ---------------------------------------------------------------------------
// 20. estimatedCost is null when pricing is unavailable
// ---------------------------------------------------------------------------

test("AgentExecutor: estimatedCost is null when pricing is not configured", async () => {
  const taskDir = tmpDir("cost-tasks");
  const execDir = tmpDir("cost-execs");
  const taskStore = new AgentTaskStore(taskDir);
  const executionStore = new AgentExecutionStore(execDir);
  const executor = createExecutor(taskStore, executionStore);
  try {
    const task = buildTask();
    await taskStore.saveTask(task);
    const result = await executor.execute(task.id);
    assert.ok(result.ok);
    if (result.ok) {
      assert.equal(result.execution.estimatedCost, null);
    }
  } finally {
    await cleanDir(taskDir);
    await cleanDir(execDir);
  }
});

// ---------------------------------------------------------------------------
// 21. No secrets are persisted or returned
// ---------------------------------------------------------------------------

test("AgentExecutor: persisted task and execution do not contain API key strings", async () => {
  const taskDir = tmpDir("secrets-tasks");
  const execDir = tmpDir("secrets-execs");
  const taskStore = new AgentTaskStore(taskDir);
  const executionStore = new AgentExecutionStore(execDir);
  const executor = createExecutor(taskStore, executionStore);
  const fakeSecret = "xai-supersecret-key-shouldnever-appear";
  // Inject a fake key into env for this test
  const prev = process.env.XAI_API_KEY;
  process.env.XAI_API_KEY = fakeSecret;
  try {
    const task = buildTask({ agentId: "orchestrator" });
    await taskStore.saveTask(task);
    const result = await executor.execute(task.id);
    assert.ok(result.ok);
    if (result.ok) {
      // Check that neither the task nor execution serialization contains the secret
      const taskJson = JSON.stringify(result.task);
      const execJson = JSON.stringify(result.execution);
      assert.equal(taskJson.includes(fakeSecret), false, "Task JSON must not contain API key");
      assert.equal(execJson.includes(fakeSecret), false, "Execution JSON must not contain API key");
    }
  } finally {
    process.env.XAI_API_KEY = prev;
    await cleanDir(taskDir);
    await cleanDir(execDir);
  }
});
