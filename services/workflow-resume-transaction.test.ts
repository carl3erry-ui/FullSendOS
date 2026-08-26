import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { POST as postWorkflowResume } from "../app/api/engagements/[id]/workflow/resume/route";
import { globalExecutionStore, globalTaskStore } from "../agents";
import type { AgentTask } from "../agents/types";
import type { AIProvider } from "../ai/provider";
import { createMockProvider } from "../ai/mock-provider";
import { globalProviderRegistry } from "../ai/provider-registry";
import { createEmptyProject } from "../src/schemas/projectSchema.js";
import { saveProject } from "../src/storage/projectStore.js";
import { buildPauseState, resumeWorkflowAfterApproval } from "./workflow-resume";
import { loadPauseState, savePauseState } from "./workflow-pause-store";
import { loadResumeOperation } from "./workflow-resume-operation-store";
import { createTestAuthHeader } from "./test-auth";
import { createTestNextRequest } from "./test-next-request";
import {
  clearSecurityAuditEventsForTests,
  getSecurityAuditEventsForTests,
  resetSecurityAuditSinkForTests,
  setSecurityAuditSinkForTests,
} from "../lib/security/security-audit";

const projectDir = path.resolve("data/projects");
const pauseDir = path.resolve("data/workflow-pauses");
const taskDir = path.resolve("data/agent-tasks");
const executionDir = path.resolve("data/agent-executions");
const operationDir = path.join(os.tmpdir(), `fullsendos-resume-transaction-${process.pid}-${Date.now()}`);
process.env.WORKFLOW_RESUME_OPERATION_DIR_OVERRIDE = operationDir;
process.env.FULLSENDOS_AUTH_DEV_TEST_ENABLED = "1";
process.env.FULLSENDOS_AUTH_DEV_TEST_SECRET = "workflow-resume-v2-security-secret-0123456789";

if (!globalProviderRegistry.isRegistered("mock")) {
  globalProviderRegistry.register("mock", createMockProvider());
}

const adminHeader = {
  authorization: createTestAuthHeader({ id: "resume-v2-admin", role: "internal_admin" }),
};

function makeRequest(engagementId: string, body: Record<string, unknown> = {}, headers: Record<string, string> = {}) {
  return createTestNextRequest(`http://localhost/api/engagements/${engagementId}/workflow/resume`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body,
  });
}

type Fixture = Awaited<ReturnType<typeof createFixture>>;

async function createFixture(label: string, options: {
  withoutClientId?: boolean;
  approvalStatus?: "approved" | "pending" | "rejected" | "revision_requested";
  taskProjectId?: string;
  taskEngagementId?: string;
  taskWorkflowRunId?: string;
  pauseProjectId?: string;
  pauseEngagementId?: string;
  approvalTarget?: string;
  activeRunId?: string;
  pendingStepIds?: string[];
} = {}) {
  const project = createEmptyProject({
    ...(!options.withoutClientId && { clientId: `client-resume-v2-${label}` }),
    companyName: `Resume v2 ${label}`,
    objective: "Validate durable workflow resume transaction",
  });
  const workflowRunId = `run-resume-v2-${label}-${Date.now()}`;
  if (options.activeRunId) {
    project.status = "running";
    project.audit.activeRun = {
      id: options.activeRunId,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      model: "grok-4.5",
    };
  }
  await saveProject(project);

  const taskId = `task-resume-v2-${label}-${Date.now()}`;
  const now = new Date().toISOString();
  await globalTaskStore.saveTask({
    id: taskId,
    projectId: options.taskProjectId ?? project.id,
    engagementId: options.taskEngagementId ?? project.id,
    workflowRunId: options.taskWorkflowRunId ?? workflowRunId,
    agentId: "researcher",
    title: `Resume v2 ${label}`,
    objective: "Execute once under a durable claim",
    status: "queued",
    approvalStatus: options.approvalStatus ?? "approved",
    priority: "high",
    provider: "mock",
    model: "mock-1.0",
    createdAt: now,
    updatedAt: now,
  });

  const pauseId = `pause-resume-v2-${label}-${Date.now()}`;
  const pause = buildPauseState({
    pauseId,
    workflowRunId,
    projectId: options.pauseProjectId ?? project.id,
    engagementId: options.pauseEngagementId ?? project.id,
    stepId: `step-${label}`,
    agentTaskId: taskId,
    pendingStepIds: options.pendingStepIds ?? [],
  });
  if (options.approvalTarget) pause.requiredApprovalTarget = options.approvalTarget;
  await savePauseState(pause);
  return { project, pauseId, taskId, workflowRunId };
}

async function cleanupFixture(fixture: Fixture): Promise<void> {
  const executions = await globalExecutionStore.listByTaskId(fixture.taskId);
  await Promise.all(executions.map((execution) => fs.rm(path.join(executionDir, `${execution.id}.json`), { force: true })));
  await Promise.all([
    fs.rm(path.join(projectDir, `${fixture.project.id}.json`), { force: true }),
    fs.rm(path.join(taskDir, `${fixture.taskId}.json`), { force: true }),
    fs.rm(path.join(pauseDir, `${fixture.pauseId}.json`), { force: true }),
    fs.rm(path.join(operationDir, `${fixture.pauseId}.json`), { force: true }),
  ]);
}

function expectedContext(fixture: Fixture) {
  return {
    projectId: fixture.project.id,
    engagementId: fixture.project.id,
    workflowRunId: fixture.workflowRunId,
    agentTaskId: fixture.taskId,
  };
}

test.afterEach(() => {
  resetSecurityAuditSinkForTests();
  clearSecurityAuditEventsForTests();
});

test.after(async () => {
  await fs.rm(operationDir, { recursive: true, force: true });
});

test("resume authenticates before project and pause disclosure", async () => {
  const missing = await postWorkflowResume(makeRequest("unknown", { pauseStateId: "unknown" }), {
    params: Promise.resolve({ id: "unknown" }),
  });
  const malformed = await postWorkflowResume(
    makeRequest("unknown", { pauseStateId: "unknown" }, { authorization: "Bearer malformed" }),
    { params: Promise.resolve({ id: "unknown" }) },
  );
  assert.equal(missing.status, 401);
  assert.equal(malformed.status, 401);
});

test("authenticated resume conceals unknown project and pause resources", async () => {
  const unknownProject = await postWorkflowResume(makeRequest("unknown-project", {}, adminHeader), {
    params: Promise.resolve({ id: "unknown-project" }),
  });
  assert.equal(unknownProject.status, 404);
  assert.deepEqual(await unknownProject.json(), { error: "Not found." });

  const fixture = await createFixture("unknown-pause");
  try {
    const unknownPause = await postWorkflowResume(
      makeRequest(fixture.project.id, { pauseStateId: "unknown-pause" }, adminHeader),
      { params: Promise.resolve({ id: fixture.project.id }) },
    );
    assert.equal(unknownPause.status, 404);
    assert.equal(await loadResumeOperation(fixture.pauseId), null);
  } finally {
    await cleanupFixture(fixture);
  }
});

test("resume returns safe 400 after authorization and sanitized unexpected 500", async () => {
  const fixture = await createFixture("invalid-body");
  try {
    const invalid = await postWorkflowResume(
      makeRequest(fixture.project.id, { pauseStateId: 42 }, adminHeader),
      { params: Promise.resolve({ id: fixture.project.id }) },
    );
    assert.equal(invalid.status, 400);
    assert.deepEqual(await invalid.json(), { error: "Invalid request body." });
    assert.equal(await loadResumeOperation(fixture.pauseId), null);
  } finally {
    await cleanupFixture(fixture);
  }

  const projectId = `malformed-resume-project-${Date.now()}`;
  await fs.writeFile(path.join(projectDir, `${projectId}.json`), "{sensitive-storage-marker", "utf8");
  try {
    const response = await postWorkflowResume(makeRequest(projectId, {}, adminHeader), {
      params: Promise.resolve({ id: projectId }),
    });
    const serialized = JSON.stringify(await response.json());
    assert.equal(response.status, 500);
    assert.equal(serialized.includes("sensitive-storage-marker"), false);
    assert.equal(serialized.includes("stack"), false);
    assert.equal(serialized.includes("/workspaces/"), false);
  } finally {
    await fs.rm(path.join(projectDir, `${projectId}.json`), { force: true });
  }
});

test("resume denies operator and client user with zero transaction or execution side effects", async () => {
  const fixture = await createFixture("roles");
  const pauseBefore = await loadPauseState(fixture.pauseId);
  const taskBefore = await globalTaskStore.loadTask(fixture.taskId);
  try {
    for (const role of ["internal_operator", "client_user"] as const) {
      const response = await postWorkflowResume(
        makeRequest(fixture.project.id, { pauseStateId: fixture.pauseId }, {
          authorization: createTestAuthHeader({ id: `resume-${role}`, role, clientId: fixture.project.clientId }),
        }),
        { params: Promise.resolve({ id: fixture.project.id }) },
      );
      assert.equal(response.status, 403);
    }
    assert.deepEqual(await loadPauseState(fixture.pauseId), pauseBefore);
    assert.deepEqual(await globalTaskStore.loadTask(fixture.taskId), taskBefore);
    assert.equal(await loadResumeOperation(fixture.pauseId), null);
    assert.equal((await globalExecutionStore.listByTaskId(fixture.taskId)).length, 0);
  } finally {
    await cleanupFixture(fixture);
  }
});

test("resume fails closed for missing project ownership", async () => {
  const fixture = await createFixture("no-client", { withoutClientId: true });
  try {
    const response = await postWorkflowResume(
      makeRequest(fixture.project.id, { pauseStateId: fixture.pauseId }, adminHeader),
      { params: Promise.resolve({ id: fixture.project.id }) },
    );
    assert.equal(response.status, 403);
    assert.equal(await loadResumeOperation(fixture.pauseId), null);
    assert.equal((await globalExecutionStore.listByTaskId(fixture.taskId)).length, 0);
  } finally {
    await cleanupFixture(fixture);
  }
});

test("resume conceals every stored linkage mismatch including active run", async () => {
  const fixtures = [
    await createFixture("pause-project", { pauseProjectId: "other-project" }),
    await createFixture("pause-engagement", { pauseEngagementId: "other-engagement" }),
    await createFixture("task-project", { taskProjectId: "other-project" }),
    await createFixture("task-engagement", { taskEngagementId: "other-engagement" }),
    await createFixture("task-run", { taskWorkflowRunId: "other-run" }),
    await createFixture("target", { approvalTarget: "agent_task:other-task" }),
    await createFixture("active-run", { activeRunId: "other-active-run" }),
  ];
  try {
    for (const fixture of fixtures) {
      const response = await postWorkflowResume(
        makeRequest(fixture.project.id, { pauseStateId: fixture.pauseId }, adminHeader),
        { params: Promise.resolve({ id: fixture.project.id }) },
      );
      assert.equal(response.status, 404);
      assert.equal(await loadResumeOperation(fixture.pauseId), null);
      assert.equal((await globalExecutionStore.listByTaskId(fixture.taskId)).length, 0);
    }
  } finally {
    await Promise.all(fixtures.map(cleanupFixture));
  }
});

test("caller ownership and attribution overrides cannot redirect resume", async () => {
  const fixture = await createFixture("overrides");
  try {
    const response = await postWorkflowResume(
      makeRequest(fixture.project.id, {
        pauseStateId: fixture.pauseId,
        resumedBy: "body-user",
        projectId: "other-project",
        engagementId: "other-engagement",
        clientId: "other-client",
        workflowRunId: "other-run",
        taskId: "other-task",
      }, adminHeader),
      { params: Promise.resolve({ id: fixture.project.id }) },
    );
    assert.equal(response.status, 200);
    assert.equal((await loadPauseState(fixture.pauseId)).resumedBy, "resume-v2-admin");
    assert.equal((await loadResumeOperation(fixture.pauseId))?.actorId, "resume-v2-admin");
  } finally {
    await cleanupFixture(fixture);
  }
});

test("execution_committed is durable before provider entry", async () => {
  const fixture = await createFixture("execution-boundary");
  const originalProvider = globalProviderRegistry.resolve("mock");
  let providerCalls = 0;
  const probe: AIProvider = {
    async generateText(request) {
      providerCalls += 1;
      assert.equal((await loadResumeOperation(fixture.pauseId))?.phase, "execution_committed");
      return originalProvider.generateText(request);
    },
    async generateStructuredResult(request, schema) {
      providerCalls += 1;
      assert.equal((await loadResumeOperation(fixture.pauseId))?.phase, "execution_committed");
      return originalProvider.generateStructuredResult(request, schema);
    },
  };
  globalProviderRegistry.register("mock", probe);
  try {
    const result = await resumeWorkflowAfterApproval(fixture.pauseId, {
      resumedBy: "resume-v2-admin",
      expectedContext: expectedContext(fixture),
    });
    assert.equal(result.ok, true);
    assert.equal(providerCalls, 1);
    assert.equal((await loadResumeOperation(fixture.pauseId))?.phase, "completed");
  } finally {
    globalProviderRegistry.register("mock", originalProvider);
    await cleanupFixture(fixture);
  }
});

test("simultaneous resume requests execute provider and task exactly once", async () => {
  const fixture = await createFixture("concurrent");
  const originalProvider = globalProviderRegistry.resolve("mock");
  let providerCalls = 0;
  const probe: AIProvider = {
    async generateText(request) {
      providerCalls += 1;
      return originalProvider.generateText(request);
    },
    async generateStructuredResult(request, schema) {
      providerCalls += 1;
      return originalProvider.generateStructuredResult(request, schema);
    },
  };
  globalProviderRegistry.register("mock", probe);
  try {
    const responses = await Promise.all([
      postWorkflowResume(makeRequest(fixture.project.id, { pauseStateId: fixture.pauseId }, adminHeader), {
        params: Promise.resolve({ id: fixture.project.id }),
      }),
      postWorkflowResume(makeRequest(fixture.project.id, { pauseStateId: fixture.pauseId }, adminHeader), {
        params: Promise.resolve({ id: fixture.project.id }),
      }),
    ]);
    assert.deepEqual(responses.map((response) => response.status).sort(), [200, 409]);
    assert.equal(providerCalls, 1);
    assert.equal((await globalExecutionStore.listByTaskId(fixture.taskId)).length, 1);
    assert.equal((await loadResumeOperation(fixture.pauseId))?.phase, "completed");
  } finally {
    globalProviderRegistry.register("mock", originalProvider);
    await cleanupFixture(fixture);
  }
});

test("pre-execution interruption safely releases claim for a later retry", async () => {
  const fixture = await createFixture("safe-release");
  try {
    const interrupted = await resumeWorkflowAfterApproval(fixture.pauseId, {
      resumedBy: "resume-v2-admin",
      expectedContext: expectedContext(fixture),
      transactionHooks: { afterClaim: () => { throw new Error("pre-execution interruption"); } },
    });
    assert.equal(interrupted.ok, false);
    assert.equal(await loadResumeOperation(fixture.pauseId), null);
    assert.equal((await globalExecutionStore.listByTaskId(fixture.taskId)).length, 0);

    const retried = await resumeWorkflowAfterApproval(fixture.pauseId, {
      resumedBy: "resume-v2-admin",
      expectedContext: expectedContext(fixture),
    });
    assert.equal(retried.ok, true);
    assert.equal((await globalExecutionStore.listByTaskId(fixture.taskId)).length, 1);
  } finally {
    await cleanupFixture(fixture);
  }
});

test("interruption after execution commitment becomes recovery_required and cannot replay", async () => {
  const fixture = await createFixture("committed-interruption");
  try {
    const result = await resumeWorkflowAfterApproval(fixture.pauseId, {
      resumedBy: "resume-v2-admin",
      expectedContext: expectedContext(fixture),
      transactionHooks: { afterExecutionCommitted: () => { throw new Error("crash after commitment"); } },
    });
    assert.equal(result.ok, false);
    assert.equal((await loadResumeOperation(fixture.pauseId))?.phase, "recovery_required");
    assert.equal((await globalExecutionStore.listByTaskId(fixture.taskId)).length, 0);

    const retry = await postWorkflowResume(
      makeRequest(fixture.project.id, { pauseStateId: fixture.pauseId }, adminHeader),
      { params: Promise.resolve({ id: fixture.project.id }) },
    );
    assert.equal(retry.status, 409);
    assert.equal((await globalExecutionStore.listByTaskId(fixture.taskId)).length, 0);
  } finally {
    await cleanupFixture(fixture);
  }
});

test("task persistence failure retains recovery evidence and blocks replay", async () => {
  const fixture = await createFixture("task-persistence");
  const originalSaveTask = globalTaskStore.saveTask.bind(globalTaskStore);
  globalTaskStore.saveTask = async (task: AgentTask) => {
    if (task.status === "completed") throw new Error("intentional task completion persistence failure");
    return originalSaveTask(task);
  };
  try {
    const result = await resumeWorkflowAfterApproval(fixture.pauseId, {
      resumedBy: "resume-v2-admin",
      expectedContext: expectedContext(fixture),
    });
    assert.equal(result.ok, false);
    assert.equal((await loadResumeOperation(fixture.pauseId))?.phase, "recovery_required");
    assert.equal((await loadResumeOperation(fixture.pauseId))?.failureCode?.includes("interrupted"), true);
  } finally {
    globalTaskStore.saveTask = originalSaveTask;
    await cleanupFixture(fixture);
  }
});

test("pause finalization boundary failure retains task_completed evidence and prevents re-execution", async () => {
  const fixture = await createFixture("pause-finalization");
  try {
    const result = await resumeWorkflowAfterApproval(fixture.pauseId, {
      resumedBy: "resume-v2-admin",
      expectedContext: expectedContext(fixture),
      transactionHooks: {
        afterTaskCompleted: () => { throw new Error("pause finalization unavailable"); },
      },
    });
    assert.equal(result.ok, false);
    assert.equal((await loadResumeOperation(fixture.pauseId))?.phase, "recovery_required");
    assert.equal((await globalTaskStore.loadTask(fixture.taskId)).status, "completed");
    const executionCount = (await globalExecutionStore.listByTaskId(fixture.taskId)).length;

    const retry = await postWorkflowResume(
      makeRequest(fixture.project.id, { pauseStateId: fixture.pauseId }, adminHeader),
      { params: Promise.resolve({ id: fixture.project.id }) },
    );
    assert.equal(retry.status, 409);
    assert.equal((await globalExecutionStore.listByTaskId(fixture.taskId)).length, executionCount);
  } finally {
    await cleanupFixture(fixture);
  }
});

test("confirmed continuation failure retains failed operation and does not replay", async () => {
  const fixture = await createFixture("continuation-failure", { pendingStepIds: ["publishing"] });
  let continuationCalls = 0;
  try {
    const result = await resumeWorkflowAfterApproval(fixture.pauseId, {
      resumedBy: "resume-v2-admin",
      expectedContext: expectedContext(fixture),
      invokeModel: async () => {
        continuationCalls += 1;
        return { text: "{}" };
      },
    });
    assert.equal(result.ok, true);
    assert.equal(result.continuation?.ok, false);
    assert.equal(continuationCalls >= 1, true);
    assert.equal((await loadResumeOperation(fixture.pauseId))?.phase, "failed");

    const callsBeforeRetry = continuationCalls;
    const retry = await postWorkflowResume(
      makeRequest(fixture.project.id, { pauseStateId: fixture.pauseId }, adminHeader),
      { params: Promise.resolve({ id: fixture.project.id }) },
    );
    assert.equal(retry.status, 409);
    assert.equal(continuationCalls, callsBeforeRetry);
  } finally {
    await cleanupFixture(fixture);
  }
});

test("continuation intent is committed before handoff and ambiguity is never replayed", async () => {
  const fixture = await createFixture("continuation-ambiguity", { pendingStepIds: ["publishing"] });
  let continuationCalls = 0;
  try {
    const result = await resumeWorkflowAfterApproval(fixture.pauseId, {
      resumedBy: "resume-v2-admin",
      expectedContext: expectedContext(fixture),
      invokeModel: async () => {
        continuationCalls += 1;
        return { text: "{}" };
      },
      transactionHooks: {
        afterContinuationCommitted: async () => {
          assert.equal((await loadResumeOperation(fixture.pauseId))?.phase, "continuation_committed");
          throw new Error("ambiguous continuation handoff");
        },
      },
    });
    assert.equal(result.ok, false);
    assert.equal(continuationCalls, 0);
    assert.equal((await loadResumeOperation(fixture.pauseId))?.phase, "recovery_required");

    const retry = await postWorkflowResume(
      makeRequest(fixture.project.id, { pauseStateId: fixture.pauseId }, adminHeader),
      { params: Promise.resolve({ id: fixture.project.id }) },
    );
    assert.equal(retry.status, 409);
    assert.equal(continuationCalls, 0);
  } finally {
    await cleanupFixture(fixture);
  }
});

test("provider failure retains failed operation and cannot automatically retry", async () => {
  const fixture = await createFixture("provider-failure");
  const originalProvider = globalProviderRegistry.resolve("mock");
  let providerCalls = 0;
  const failingProvider: AIProvider = {
    async generateText() { providerCalls += 1; throw new Error("provider failure marker"); },
    async generateStructuredResult() { providerCalls += 1; throw new Error("provider failure marker"); },
  };
  globalProviderRegistry.register("mock", failingProvider);
  try {
    const result = await resumeWorkflowAfterApproval(fixture.pauseId, {
      resumedBy: "resume-v2-admin",
      expectedContext: expectedContext(fixture),
    });
    assert.equal(result.ok, false);
    assert.equal(providerCalls, 1);
    assert.equal((await loadResumeOperation(fixture.pauseId))?.phase, "failed");
    const retry = await postWorkflowResume(
      makeRequest(fixture.project.id, { pauseStateId: fixture.pauseId }, adminHeader),
      { params: Promise.resolve({ id: fixture.project.id }) },
    );
    assert.equal(retry.status, 409);
    assert.equal(providerCalls, 1);
  } finally {
    globalProviderRegistry.register("mock", originalProvider);
    await cleanupFixture(fixture);
  }
});

test("success response and security audit exclude transaction and workflow internals", async () => {
  const fixture = await createFixture("safe-output");
  try {
    const response = await postWorkflowResume(
      makeRequest(fixture.project.id, { pauseStateId: fixture.pauseId, prompt: "sensitive-marker" }, adminHeader),
      { params: Promise.resolve({ id: fixture.project.id }) },
    );
    const body = await response.json();
    const serialized = JSON.stringify(body);
    assert.equal(response.status, 200);
    assert.deepEqual(Object.keys(body).sort(), ["continuation", "engagementId", "pauseStateId", "resumedAt", "taskStatus"]);
    for (const marker of ["operationId", "claimId", "\"phase\"", "sensitive-marker", "rawResponse", "providerOutput", "toolArguments", "stack", "secret"]) {
      assert.equal(serialized.includes(marker), false);
    }
    const audit = JSON.stringify(getSecurityAuditEventsForTests().filter((event) => event.action === "workflow_resume"));
    for (const marker of ["authorization", "Bearer", "sensitive-marker", "rawResponse", "providerOutput", "toolArguments", "\"phase\"", "claimId", "secret"]) {
      assert.equal(audit.includes(marker), false);
    }
  } finally {
    await cleanupFixture(fixture);
  }
});

test("audit sink failure preserves 401, 403, 404, 409, 422, and success outcomes", async () => {
  setSecurityAuditSinkForTests(() => { throw new Error("intentional resume audit sink failure"); });
  const forbidden = await createFixture("audit-forbidden");
  const pending = await createFixture("audit-pending", { approvalStatus: "pending" });
  const conflict = await createFixture("audit-conflict");
  const success = await createFixture("audit-success");
  try {
    const unauthorized = await postWorkflowResume(makeRequest(forbidden.project.id, { pauseStateId: forbidden.pauseId }), {
      params: Promise.resolve({ id: forbidden.project.id }),
    });
    const denied = await postWorkflowResume(
      makeRequest(forbidden.project.id, { pauseStateId: forbidden.pauseId }, {
        authorization: createTestAuthHeader({ id: "audit-operator", role: "internal_operator", clientId: forbidden.project.clientId }),
      }),
      { params: Promise.resolve({ id: forbidden.project.id }) },
    );
    const missing = await postWorkflowResume(
      makeRequest(forbidden.project.id, { pauseStateId: "missing-pause" }, adminHeader),
      { params: Promise.resolve({ id: forbidden.project.id }) },
    );
    const approval = await postWorkflowResume(
      makeRequest(pending.project.id, { pauseStateId: pending.pauseId }, adminHeader),
      { params: Promise.resolve({ id: pending.project.id }) },
    );
    await resumeWorkflowAfterApproval(conflict.pauseId, { resumedBy: "prior", expectedContext: expectedContext(conflict) });
    const replay = await postWorkflowResume(
      makeRequest(conflict.project.id, { pauseStateId: conflict.pauseId }, adminHeader),
      { params: Promise.resolve({ id: conflict.project.id }) },
    );
    const allowed = await postWorkflowResume(
      makeRequest(success.project.id, { pauseStateId: success.pauseId }, adminHeader),
      { params: Promise.resolve({ id: success.project.id }) },
    );
    assert.deepEqual([unauthorized.status, denied.status, missing.status, replay.status, approval.status, allowed.status], [401, 403, 404, 409, 422, 200]);
    assert.equal(JSON.stringify(await allowed.json()).includes("intentional resume audit sink failure"), false);
  } finally {
    await Promise.all([forbidden, pending, conflict, success].map(cleanupFixture));
  }
});
