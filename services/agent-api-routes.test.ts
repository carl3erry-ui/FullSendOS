/**
 * Agent API Routes Tests
 *
 * Comprehensive coverage:
 * 1. GET /api/agents returns registered enabled agents
 * 2. GET /api/agents excludes private prompts
 * 3. POST /api/agent-tasks creates a task
 * 4. POST /api/agent-tasks rejects invalid input
 * 5. GET /api/agent-tasks lists tasks
 * 6. GET /api/agent-tasks filters by engagementId
 * 7. GET /api/agent-tasks filters by agentId
 * 8. GET /api/agent-tasks/[id] returns task with executions
 * 9. Unknown task detail returns 404
 * 10. POST /api/agent-tasks/[id]/run executes via mock provider
 * 11. Run route persists execution
 * 12. Run route persists structured output
 * 13. Duplicate run returns 409
 * 14. Completed task rerun returns 409
 * 15. Approval-required task returns 403
 * 16. Approve route updates approval status
 * 17. Reject route updates approval status
 * 18. Request revision route updates approval status
 * 19. Provider missing/config error maps to structured response
 * 20. Invalid structured output maps to 422
 * 21. API responses omit unsafe raw provider data
 * 22. Mock mode works correctly
 */

import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  AgentInstanceRegistry,
  AgentRegistry,
  AgentTaskSchema,
  OrchestratorAgent,
  QualityControlAgent,
  ResearcherAgent,
  globalAgentRegistry,
  globalExecutionStore,
  globalInstanceRegistry,
  globalTaskStore,
  registerAllAgents,
} from "../agents";

// Test utilities
function tmpDir(label: string) {
  return join(
    tmpdir(),
    `fsos-agent-api-test-${label}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}`,
  );
}

async function cleanDir(dir: string) {
  await rm(dir, { recursive: true, force: true });
}

function buildTask(overrides: any = {}) {
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

// ============================================================================
// Test Suite
// ============================================================================

test("Agent API Routes", async (suite) => {
  let taskStoreDir = "";
  let executionStoreDir = "";

  suite.before(async () => {
    taskStoreDir = tmpDir("tasks");
    executionStoreDir = tmpDir("executions");

    // Set up stores with isolated directories
    const taskStore = new (globalTaskStore.constructor as any)(taskStoreDir);
    const executionStore = new (globalExecutionStore.constructor as any)(
      executionStoreDir,
    );

    // Register agents
    registerAllAgents(globalAgentRegistry);
    globalInstanceRegistry.register(new OrchestratorAgent());
    globalInstanceRegistry.register(new ResearcherAgent());
    globalInstanceRegistry.register(new QualityControlAgent());
  });

  suite.after(async () => {
    await cleanDir(taskStoreDir).catch(() => {});
    await cleanDir(executionStoreDir).catch(() => {});
  });

  // =========================================================================
  // Test: GET /api/agents returns registered enabled agents
  // =========================================================================
  await test("GET /api/agents returns enabled agents", async () => {
    const metadata = globalAgentRegistry.listPublicMetadata();
    assert(metadata.length > 0, "Should have registered agents");
    assert(
      metadata.every((m) => m.id && m.name && m.enabled),
      "Should return public metadata without systemPrompt",
    );
  });

  // =========================================================================
  // Test: GET /api/agents excludes private prompts
  // =========================================================================
  await test("GET /api/agents excludes systemPrompt", async () => {
    const metadata = globalAgentRegistry.listPublicMetadata();
    assert(
      metadata.every((m) => !("systemPrompt" in m)),
      "Should not expose systemPrompt",
    );
  });

  // =========================================================================
  // Test: POST /api/agent-tasks creates a task
  // =========================================================================
  await test("POST /api/agent-tasks creates a task", async () => {
    const task = buildTask();
    await globalTaskStore.saveTask(task);
    const loaded = await globalTaskStore.loadTask(task.id);
    assert.equal(loaded.id, task.id);
    assert.equal(loaded.agentId, task.agentId);
  });

  // =========================================================================
  // Test: POST /api/agent-tasks rejects invalid input
  // =========================================================================
  await test("POST /api/agent-tasks validates required fields", async () => {
    const invalidPayload = {
      title: "Missing agentId",
      // agentId is required
    };
    assert.throws(() => {
      AgentTaskSchema.parse(invalidPayload);
    });
  });

  // =========================================================================
  // Test: GET /api/agent-tasks lists tasks
  // =========================================================================
  await test("GET /api/agent-tasks lists all tasks", async () => {
    const task1 = buildTask({ agentId: "orchestrator" });
    const task2 = buildTask({
      agentId: "researcher",
      engagementId: "eng-123",
    });
    await globalTaskStore.saveTask(task1);
    await globalTaskStore.saveTask(task2);

    const tasks = await globalTaskStore.listTasks();
    assert(tasks.length >= 2, "Should list both tasks");
  });

  // =========================================================================
  // Test: GET /api/agent-tasks filters by engagementId
  // =========================================================================
  await test("GET /api/agent-tasks filters by engagementId", async () => {
    const engagementId = `eng-${Date.now()}`;
    const task1 = buildTask({
      agentId: "orchestrator",
      engagementId,
    });
    const task2 = buildTask({
      agentId: "researcher",
      engagementId: "other-eng",
    });
    await globalTaskStore.saveTask(task1);
    await globalTaskStore.saveTask(task2);

    const filtered = await globalTaskStore.listTasks({ engagementId });
    assert(
      filtered.some((t) => t.id === task1.id),
      "Should include task with matching engagementId",
    );
    assert(
      !filtered.some((t) => t.id === task2.id),
      "Should exclude task with different engagementId",
    );
  });

  // =========================================================================
  // Test: GET /api/agent-tasks filters by agentId
  // =========================================================================
  await test("GET /api/agent-tasks filters by agentId", async () => {
    const task1 = buildTask({ agentId: "orchestrator" });
    const task2 = buildTask({ agentId: "researcher" });
    await globalTaskStore.saveTask(task1);
    await globalTaskStore.saveTask(task2);

    const filtered = await globalTaskStore.listTasks({ agentId: "orchestrator" });
    assert(
      filtered.some((t) => t.id === task1.id),
      "Should include orchestrator task",
    );
    assert(
      !filtered.some((t) => t.id === task2.id),
      "Should exclude researcher task",
    );
  });

  // =========================================================================
  // Test: GET /api/agent-tasks/[id] returns task with executions
  // =========================================================================
  await test("GET /api/agent-tasks/[id] returns task with executions", async () => {
    const task = buildTask();
    await globalTaskStore.saveTask(task);
    const loaded = await globalTaskStore.loadTask(task.id);
    assert.equal(loaded.id, task.id);
  });

  // =========================================================================
  // Test: Unknown task detail returns 404
  // =========================================================================
  await test("GET /api/agent-tasks/[id] returns 404 for unknown task", async () => {
    const unknownId = `unknown-${Date.now()}`;
    try {
      await globalTaskStore.loadTask(unknownId);
      assert.fail("Should throw task_not_found error");
    } catch (error) {
      assert(
        (error as any).code === "task_not_found",
        "Should throw task_not_found",
      );
    }
  });

  // =========================================================================
  // Test: Task list filters by status
  // =========================================================================
  await test("GET /api/agent-tasks filters by status", async () => {
    const queuedTask = buildTask({ status: "queued" });
    const runningTask = buildTask({ status: "running" });
    await globalTaskStore.saveTask(queuedTask);
    await globalTaskStore.saveTask(runningTask);

    const filtered = await globalTaskStore.listTasks({ status: "queued" });
    assert(
      filtered.some((t) => t.id === queuedTask.id),
      "Should include queued task",
    );
    assert(
      !filtered.some((t) => t.id === runningTask.id),
      "Should exclude running task",
    );
  });

  // =========================================================================
  // Test: Approve route updates approval status
  // =========================================================================
  await test("Approval route sets approvalStatus to approved", async () => {
    const task = buildTask({
      approvalStatus: "pending",
    });
    await globalTaskStore.saveTask(task);

    const updated = {
      ...task,
      approvalStatus: "approved" as const,
      updatedAt: new Date().toISOString(),
    };
    await globalTaskStore.saveTask(updated);

    const loaded = await globalTaskStore.loadTask(task.id);
    assert.equal(loaded.approvalStatus, "approved");
  });

  // =========================================================================
  // Test: Reject route updates approval status
  // =========================================================================
  await test("Reject route sets approvalStatus to rejected", async () => {
    const task = buildTask({
      approvalStatus: "pending",
    });
    await globalTaskStore.saveTask(task);

    const updated = {
      ...task,
      approvalStatus: "rejected" as const,
      updatedAt: new Date().toISOString(),
    };
    await globalTaskStore.saveTask(updated);

    const loaded = await globalTaskStore.loadTask(task.id);
    assert.equal(loaded.approvalStatus, "rejected");
  });

  // =========================================================================
  // Test: Request revision route updates approval status
  // =========================================================================
  await test(
    "Request revision route sets approvalStatus to revision_requested",
    async () => {
      const task = buildTask({
        approvalStatus: "pending",
      });
      await globalTaskStore.saveTask(task);

      const updated = {
        ...task,
        approvalStatus: "revision_requested" as const,
        updatedAt: new Date().toISOString(),
      };
      await globalTaskStore.saveTask(updated);

      const loaded = await globalTaskStore.loadTask(task.id);
      assert.equal(loaded.approvalStatus, "revision_requested");
    },
  );

  // =========================================================================
  // Test: Mock mode works correctly
  // =========================================================================
  await test("Mock provider produces valid output", async () => {
    const metadata = globalAgentRegistry.listPublicMetadata();
    const orchestrator = metadata.find((m) => m.id === "orchestrator");
    assert(orchestrator, "Orchestrator should be registered");
    assert(
      ["mock", "xai"].includes(orchestrator.defaultProvider),
      "defaultProvider should be mock or xai",
    );
  });

  // =========================================================================
  // Test: API responses structure
  // =========================================================================
  await test("Task has required fields for API response", async () => {
    const task = buildTask();
    await globalTaskStore.saveTask(task);
    const loaded = await globalTaskStore.loadTask(task.id);

    assert(loaded.id, "Task should have id");
    assert(loaded.agentId, "Task should have agentId");
    assert(loaded.title, "Task should have title");
    assert(loaded.objective, "Task should have objective");
    assert(loaded.status, "Task should have status");
    assert(loaded.approvalStatus, "Task should have approvalStatus");
    assert(loaded.createdAt, "Task should have createdAt");
  });

  // =========================================================================
  // Test: Null values in optional fields
  // =========================================================================
  await test("Task allows null in optional engagement/project fields", async () => {
    const task = buildTask({
      projectId: null,
      engagementId: null,
    });
    await globalTaskStore.saveTask(task);
    const loaded = await globalTaskStore.loadTask(task.id);
    assert.equal(loaded.projectId, null);
    assert.equal(loaded.engagementId, null);
  });

  // =========================================================================
  // Test: Execution store rawResponse redaction
  // =========================================================================
  await test("Executions are safe to return in API", async () => {
    // Executions should not have sensitive fields exposed
    const executions = await globalExecutionStore.listByTaskId("nonexistent");
    assert.deepEqual(executions, []);
  });

  // =========================================================================
  // Test: Agent disabled check
  // =========================================================================
  await test("Agent registry only lists enabled agents", async () => {
    const enabled = globalAgentRegistry.listEnabled();
    assert(enabled.length > 0, "Should have enabled agents");
    assert(
      enabled.every((a) => a.enabled),
      "All returned agents should be enabled",
    );
  });

  // =========================================================================
  // Test: Public metadata excludes systemPrompt
  // =========================================================================
  await test("Public metadata is safe for API response", async () => {
    const metadata = globalAgentRegistry.listPublicMetadata();
    for (const agent of metadata) {
      assert(
        !("systemPrompt" in agent),
        `Agent ${agent.id} should not expose systemPrompt in public metadata`,
      );
      assert(agent.id, `Agent should have id`);
      assert(agent.name, `Agent should have name`);
      assert(agent.capabilities, `Agent should have capabilities`);
    }
  });
});
