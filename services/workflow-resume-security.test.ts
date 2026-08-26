import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { POST as postWorkflowResume } from "../app/api/engagements/[id]/workflow/resume/route";
import { globalExecutionStore, globalTaskStore } from "../agents";
import { globalProviderRegistry } from "../ai/provider-registry";
import { createMockProvider } from "../ai/mock-provider";
import { createEmptyProject } from "../src/schemas/projectSchema.js";
import { saveProject } from "../src/storage/projectStore.js";
import { buildPauseState } from "./workflow-resume";
import { loadPauseState, markPauseResumed, savePauseState } from "./workflow-pause-store";
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

process.env.FULLSENDOS_AUTH_DEV_TEST_ENABLED = "1";
process.env.FULLSENDOS_AUTH_DEV_TEST_SECRET = "workflow-resume-security-secret-0123456789";

if (!globalProviderRegistry.isRegistered("mock")) {
  globalProviderRegistry.register("mock", createMockProvider());
}

const adminHeader = {
  authorization: createTestAuthHeader({ id: "resume-admin", role: "internal_admin" }),
};

function makeRequest(
  engagementId: string,
  body: Record<string, unknown> = {},
  headers: Record<string, string> = {},
) {
  return createTestNextRequest(`http://localhost/api/engagements/${engagementId}/workflow/resume`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body,
  });
}

async function createResumeFixture(label: string, options: {
  clientId?: string;
  withoutClientId?: boolean;
  projectIdOverride?: string;
  engagementIdOverride?: string;
  workflowRunIdOverride?: string;
  requiredApprovalTargetOverride?: string;
  pauseProjectIdOverride?: string;
  pauseEngagementIdOverride?: string;
  approvalStatus?: "approved" | "pending" | "rejected" | "revision_requested";
} = {}) {
  const project = createEmptyProject({
    ...(!options.withoutClientId && {
      clientId: options.clientId ?? `client-resume-${label}`,
    }),
    companyName: `Resume ${label}`,
    objective: "Validate secure workflow resume",
  });
  await saveProject(project);

  const taskId = `task-resume-security-${label}-${Date.now()}`;
  const workflowRunId = `run-resume-security-${label}-${Date.now()}`;
  const now = new Date().toISOString();
  await globalTaskStore.saveTask({
    id: taskId,
    projectId: options.projectIdOverride ?? project.id,
    engagementId: options.engagementIdOverride ?? project.id,
    workflowRunId: options.workflowRunIdOverride ?? workflowRunId,
    agentId: "researcher",
    title: `Resume security ${label}`,
    objective: "Execute exactly once after secure authorization",
    status: "queued",
    approvalStatus: options.approvalStatus ?? "approved",
    priority: "high",
    provider: "mock",
    model: "mock-1.0",
    createdAt: now,
    updatedAt: now,
  });

  const pauseId = `pause-resume-security-${label}-${Date.now()}`;
  const pause = buildPauseState({
    pauseId,
    workflowRunId,
    projectId: project.id,
    engagementId: project.id,
    stepId: `step-${label}`,
    agentTaskId: taskId,
  });
  pause.projectId = options.pauseProjectIdOverride ?? pause.projectId;
  pause.engagementId = options.pauseEngagementIdOverride ?? pause.engagementId;
  if (options.requiredApprovalTargetOverride) {
    pause.requiredApprovalTarget = options.requiredApprovalTargetOverride;
  }
  await savePauseState(pause);

  return { project, taskId, pauseId, workflowRunId };
}

async function cleanupFixture(fixture: { project: { id: string }; taskId: string; pauseId: string }) {
  const executions = await globalExecutionStore.listByTaskId(fixture.taskId);
  await Promise.all(executions.map((execution) => fs.rm(path.join(executionDir, `${execution.id}.json`), { force: true })));
  await Promise.all([
    fs.rm(path.join(projectDir, `${fixture.project.id}.json`), { force: true }),
    fs.rm(path.join(taskDir, `${fixture.taskId}.json`), { force: true }),
    fs.rm(path.join(pauseDir, `${fixture.pauseId}.json`), { force: true }),
    fs.rm(path.join(pauseDir, `${fixture.pauseId}.resume-claim`), { force: true }),
  ]);
}

test.afterEach(() => {
  resetSecurityAuditSinkForTests();
  clearSecurityAuditEventsForTests();
});

test("workflow resume authenticates before project or pause disclosure", async () => {
  const missing = await postWorkflowResume(makeRequest("unknown", { pauseStateId: "unknown" }), {
    params: Promise.resolve({ id: "unknown" }),
  });
  const malformed = await postWorkflowResume(
    makeRequest("unknown", { pauseStateId: "unknown" }, { authorization: "Bearer malformed-token" }),
    { params: Promise.resolve({ id: "unknown" }) },
  );

  assert.equal(missing.status, 401);
  assert.equal(malformed.status, 401);
  assert.deepEqual(await missing.json(), { error: "Unauthorized." });
});

test("workflow resume denies operator and client user without mutation or execution", async () => {
  const fixture = await createResumeFixture("roles");
  const pauseBefore = await loadPauseState(fixture.pauseId);
  const taskBefore = await globalTaskStore.loadTask(fixture.taskId);

  try {
    for (const actor of [
      { id: "resume-operator", role: "internal_operator" as const },
      { id: "resume-client", role: "client_user" as const },
    ]) {
      const response = await postWorkflowResume(
        makeRequest(fixture.project.id, { pauseStateId: fixture.pauseId }, {
          authorization: createTestAuthHeader({ ...actor, clientId: fixture.project.clientId }),
        }),
        { params: Promise.resolve({ id: fixture.project.id }) },
      );
      assert.equal(response.status, 403);
    }

    assert.deepEqual(await loadPauseState(fixture.pauseId), pauseBefore);
    assert.deepEqual(await globalTaskStore.loadTask(fixture.taskId), taskBefore);
    assert.equal((await globalExecutionStore.listByTaskId(fixture.taskId)).length, 0);
  } finally {
    await cleanupFixture(fixture);
  }
});

test("workflow resume fails closed when stored project has no client ownership", async () => {
  const fixture = await createResumeFixture("no-client", { withoutClientId: true });
  const pauseBefore = await loadPauseState(fixture.pauseId);

  try {
    const response = await postWorkflowResume(
      makeRequest(fixture.project.id, { pauseStateId: fixture.pauseId }, adminHeader),
      { params: Promise.resolve({ id: fixture.project.id }) },
    );
    assert.equal(response.status, 403);
    assert.deepEqual(await loadPauseState(fixture.pauseId), pauseBefore);
    assert.equal((await globalExecutionStore.listByTaskId(fixture.taskId)).length, 0);
  } finally {
    await cleanupFixture(fixture);
  }
});

test("workflow resume conceals strict task project and workflow linkage mismatches", async () => {
  const fixtures = [
    await createResumeFixture("wrong-pause-project", { pauseProjectIdOverride: "other-project" }),
    await createResumeFixture("wrong-pause-engagement", { pauseEngagementIdOverride: "other-engagement" }),
    await createResumeFixture("wrong-project", { projectIdOverride: "other-project" }),
    await createResumeFixture("wrong-engagement", { engagementIdOverride: "other-engagement" }),
    await createResumeFixture("wrong-run", { workflowRunIdOverride: "other-run" }),
    await createResumeFixture("wrong-target", { requiredApprovalTargetOverride: "agent_task:other-task" }),
  ];

  try {
    for (const fixture of fixtures) {
      const response = await postWorkflowResume(
        makeRequest(fixture.project.id, { pauseStateId: fixture.pauseId }, adminHeader),
        { params: Promise.resolve({ id: fixture.project.id }) },
      );
      assert.equal(response.status, 404);
      assert.deepEqual(await response.json(), { error: "Not found." });
      assert.equal((await globalExecutionStore.listByTaskId(fixture.taskId)).length, 0);
    }
  } finally {
    await Promise.all(fixtures.map(cleanupFixture));
  }
});

test("workflow resume preserves active-pause auto-discovery", async () => {
  const fixture = await createResumeFixture("auto-discovery");

  try {
    const response = await postWorkflowResume(
      makeRequest(fixture.project.id, {}, adminHeader),
      { params: Promise.resolve({ id: fixture.project.id }) },
    );
    assert.equal(response.status, 200);
    assert.equal((await response.json()).pauseStateId, fixture.pauseId);
  } finally {
    await cleanupFixture(fixture);
  }
});

test("workflow resume validates the body after authorization without mutation", async () => {
  const fixture = await createResumeFixture("invalid-body");
  const pauseBefore = await loadPauseState(fixture.pauseId);

  try {
    const response = await postWorkflowResume(
      makeRequest(fixture.project.id, { pauseStateId: 42 }, adminHeader),
      { params: Promise.resolve({ id: fixture.project.id }) },
    );
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "Invalid request body." });
    assert.deepEqual(await loadPauseState(fixture.pauseId), pauseBefore);
    assert.equal((await globalExecutionStore.listByTaskId(fixture.taskId)).length, 0);
  } finally {
    await cleanupFixture(fixture);
  }
});

test("workflow resume sanitizes unexpected stored-project errors", async () => {
  const projectId = `resume-malformed-project-${Date.now()}`;
  const leakageMarker = "resume-project-storage-leak";
  await fs.mkdir(projectDir, { recursive: true });
  await fs.writeFile(path.join(projectDir, `${projectId}.json`), `{${leakageMarker}`, "utf8");

  try {
    const response = await postWorkflowResume(
      makeRequest(projectId, {}, adminHeader),
      { params: Promise.resolve({ id: projectId }) },
    );
    const serialized = JSON.stringify(await response.json());
    assert.equal(response.status, 500);
    assert.equal(serialized.includes(leakageMarker), false);
    assert.equal(serialized.includes("stack"), false);
    assert.equal(serialized.includes("/workspaces/"), false);
  } finally {
    await fs.rm(path.join(projectDir, `${projectId}.json`), { force: true });
  }
});

test("workflow resume ignores caller ownership and attribution overrides", async () => {
  const fixture = await createResumeFixture("overrides");

  try {
    const response = await postWorkflowResume(
      makeRequest(fixture.project.id, {
        pauseStateId: fixture.pauseId,
        resumedBy: "caller-supplied-reviewer",
        projectId: "other-project",
        engagementId: "other-engagement",
        clientId: "other-client",
        workflowRunId: "other-run",
        agentTaskId: "other-task",
      }, adminHeader),
      { params: Promise.resolve({ id: fixture.project.id }) },
    );

    assert.equal(response.status, 200);
    const pause = await loadPauseState(fixture.pauseId);
    assert.equal(pause.resumedBy, "resume-admin");
    assert.equal(pause.projectId, fixture.project.id);
    assert.equal(pause.agentTaskId, fixture.taskId);
  } finally {
    await cleanupFixture(fixture);
  }
});

test("workflow resume returns a minimal safe response and metadata-only audit", async () => {
  const fixture = await createResumeFixture("safe-response");

  try {
    const response = await postWorkflowResume(
      makeRequest(fixture.project.id, { pauseStateId: fixture.pauseId }, adminHeader),
      { params: Promise.resolve({ id: fixture.project.id }) },
    );
    const body = await response.json();
    const serialized = JSON.stringify(body);

    assert.equal(response.status, 200);
    assert.deepEqual(Object.keys(body).sort(), ["continuation", "engagementId", "pauseStateId", "resumedAt", "taskStatus"]);
    assert.deepEqual(Object.keys(body.continuation), ["status"]);
    for (const marker of ["auditEntry", "prompt", "output", "rawResponse", "systemPrompt", "toolPermissions", "diagnostic", "stack"] ) {
      assert.equal(serialized.includes(marker), false);
    }

    const events = getSecurityAuditEventsForTests().filter((event) => event.action === "workflow_resume");
    assert.equal(events.some((event) => event.decision === "allow" && event.reasonCode === "workflow_resumed"), true);
    const auditSerialized = JSON.stringify(events);
    for (const marker of ["authorization", "Bearer", "prompt", "output", "rawResponse", "tool", "diagnostic", "secret"]) {
      assert.equal(auditSerialized.includes(marker), false);
    }
  } finally {
    await cleanupFixture(fixture);
  }
});

test("workflow resume rejects unapproved and replayed pauses with existing status contracts", async () => {
  const pending = await createResumeFixture("pending", { approvalStatus: "pending" });
  const replay = await createResumeFixture("replay");

  try {
    const pendingResponse = await postWorkflowResume(
      makeRequest(pending.project.id, { pauseStateId: pending.pauseId }, adminHeader),
      { params: Promise.resolve({ id: pending.project.id }) },
    );
    assert.equal(pendingResponse.status, 422);

    const first = await postWorkflowResume(
      makeRequest(replay.project.id, { pauseStateId: replay.pauseId }, adminHeader),
      { params: Promise.resolve({ id: replay.project.id }) },
    );
    const second = await postWorkflowResume(
      makeRequest(replay.project.id, { pauseStateId: replay.pauseId }, adminHeader),
      { params: Promise.resolve({ id: replay.project.id }) },
    );
    assert.equal(first.status, 200);
    assert.equal(second.status, 409);
    assert.equal((await globalExecutionStore.listByTaskId(replay.taskId)).length, 1);
  } finally {
    await cleanupFixture(pending);
    await cleanupFixture(replay);
  }
});

test("workflow resume releases its atomic claim after approval precondition failure", async () => {
  const fixture = await createResumeFixture("claim-recovery", { approvalStatus: "pending" });

  try {
    const blocked = await postWorkflowResume(
      makeRequest(fixture.project.id, { pauseStateId: fixture.pauseId }, adminHeader),
      { params: Promise.resolve({ id: fixture.project.id }) },
    );
    assert.equal(blocked.status, 422);

    const task = await globalTaskStore.loadTask(fixture.taskId);
    await globalTaskStore.saveTask({
      ...task,
      approvalStatus: "approved",
      updatedAt: new Date().toISOString(),
    });

    const resumed = await postWorkflowResume(
      makeRequest(fixture.project.id, { pauseStateId: fixture.pauseId }, adminHeader),
      { params: Promise.resolve({ id: fixture.project.id }) },
    );
    assert.equal(resumed.status, 200);
    assert.equal((await globalExecutionStore.listByTaskId(fixture.taskId)).length, 1);
  } finally {
    await cleanupFixture(fixture);
  }
});

test("concurrent workflow resume requests execute an approved task exactly once", async () => {
  const fixture = await createResumeFixture("concurrent");

  try {
    const responses = await Promise.all([
      postWorkflowResume(
        makeRequest(fixture.project.id, { pauseStateId: fixture.pauseId }, adminHeader),
        { params: Promise.resolve({ id: fixture.project.id }) },
      ),
      postWorkflowResume(
        makeRequest(fixture.project.id, { pauseStateId: fixture.pauseId }, adminHeader),
        { params: Promise.resolve({ id: fixture.project.id }) },
      ),
    ]);

    assert.deepEqual(responses.map((response) => response.status).sort(), [200, 409]);
    assert.equal((await globalExecutionStore.listByTaskId(fixture.taskId)).length, 1);
    assert.equal((await globalTaskStore.loadTask(fixture.taskId)).status, "completed");
    assert.equal((await loadPauseState(fixture.pauseId)).status, "resumed");
  } finally {
    await cleanupFixture(fixture);
  }
});

test("workflow resume audit sink failure preserves security, state, and success outcomes", async () => {
  setSecurityAuditSinkForTests(() => {
    throw new Error("intentional workflow resume audit failure");
  });

  const forbidden = await createResumeFixture("audit-forbidden");
  const missing = await createResumeFixture("audit-missing");
  const pending = await createResumeFixture("audit-pending", { approvalStatus: "pending" });
  const replay = await createResumeFixture("audit-replay");
  const success = await createResumeFixture("audit-success");
  await markPauseResumed(replay.pauseId, "prior-resumer");

  try {
    const unauthorizedResponse = await postWorkflowResume(makeRequest(forbidden.project.id, { pauseStateId: forbidden.pauseId }), {
      params: Promise.resolve({ id: forbidden.project.id }),
    });
    const forbiddenResponse = await postWorkflowResume(
      makeRequest(forbidden.project.id, { pauseStateId: forbidden.pauseId }, {
        authorization: createTestAuthHeader({ id: "resume-audit-operator", role: "internal_operator", clientId: forbidden.project.clientId }),
      }),
      { params: Promise.resolve({ id: forbidden.project.id }) },
    );
    const missingResponse = await postWorkflowResume(
      makeRequest(missing.project.id, { pauseStateId: "missing-pause" }, adminHeader),
      { params: Promise.resolve({ id: missing.project.id }) },
    );
    const pendingResponse = await postWorkflowResume(
      makeRequest(pending.project.id, { pauseStateId: pending.pauseId }, adminHeader),
      { params: Promise.resolve({ id: pending.project.id }) },
    );
    const successResponse = await postWorkflowResume(
      makeRequest(success.project.id, { pauseStateId: success.pauseId }, adminHeader),
      { params: Promise.resolve({ id: success.project.id }) },
    );
    const replayResponse = await postWorkflowResume(
      makeRequest(replay.project.id, { pauseStateId: replay.pauseId }, adminHeader),
      { params: Promise.resolve({ id: replay.project.id }) },
    );

    assert.equal(unauthorizedResponse.status, 401);
    assert.equal(forbiddenResponse.status, 403);
    assert.equal(missingResponse.status, 404);
    assert.equal(pendingResponse.status, 422);
    assert.equal(replayResponse.status, 409);
    assert.equal(successResponse.status, 200);
    assert.equal(JSON.stringify(await successResponse.json()).includes("intentional workflow resume audit failure"), false);
  } finally {
    await Promise.all([forbidden, missing, pending, replay, success].map(cleanupFixture));
  }
});
