import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { POST as postProjectRun } from "../app/api/projects/[id]/run/route";
import { POST as postEngagementRun } from "../app/api/engagements/[id]/run/route";
import { createEmptyProject } from "../src/schemas/projectSchema.js";
import { loadProject, saveProject } from "../src/storage/projectStore.js";
import { RUN_STALE_MS } from "../src/orchestrator/runLifecycle.js";
import { createHumanInputRequest } from "./human-input-service";
import { applyEnvOverrides, restoreEnv } from "./test-env";
import { createTestAuthHeader } from "./test-auth";
import {
  clearSecurityAuditEventsForTests,
  getSecurityAuditEventsForTests,
  resetSecurityAuditSinkForTests,
  setSecurityAuditSinkForTests,
} from "../lib/security/security-audit";

const projectStorageDir = path.resolve("data/projects");
const requestStorageDir = path.resolve("data/human-input-requests");

process.env.FULLSENDOS_AUTH_DEV_TEST_ENABLED = "1";
process.env.FULLSENDOS_AUTH_DEV_TEST_SECRET = "workflow-run-security-test-secret-0123456789";

const workflowRunRoutes = [
  {
    name: "project",
    path: (id: string) => `/api/projects/${id}/run`,
    route: postProjectRun,
  },
  {
    name: "engagement",
    path: (id: string) => `/api/engagements/${id}/run`,
    route: postEngagementRun,
  },
] as const;

const adminHeader = {
  authorization: createTestAuthHeader({ id: "workflow-admin", role: "internal_admin" }),
};

function makeRequest(
  pathname: string,
  body: Record<string, unknown> = {},
  headers: Record<string, string> = {},
) {
  return new Request(`http://127.0.0.1:3000${pathname}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

async function createProject(input: { clientId?: string; label: string }) {
  const project = createEmptyProject({
    clientId: input.clientId,
    companyName: `Workflow ${input.label}`,
    objective: "Validate workflow run authorization",
  });
  await saveProject(project);
  return project;
}

async function cleanupProject(id: string) {
  await fs.rm(path.join(projectStorageDir, `${id}.json`), { force: true });
}

async function cleanupRequest(id: string) {
  await fs.rm(path.join(requestStorageDir, `${id}.json`), { force: true });
}

async function waitForTerminalStatus(id: string, timeoutMs = 6000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const project = await loadProject(id);
    if (project.status !== "running") return project;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Timed out waiting for workflow ${id}.`);
}

function assertProjectUnchanged(before: unknown, after: unknown) {
  assert.deepEqual(after, before);
}

test.afterEach(() => {
  resetSecurityAuditSinkForTests();
  clearSecurityAuditEventsForTests();
});

for (const routeCase of workflowRunRoutes) {
  test(`workflow ${routeCase.name} run rejects malformed identity before lookup`, async () => {
    const response = await routeCase.route(
      makeRequest(routeCase.path("unknown-workflow"), {}, { authorization: "Bearer malformed-token" }),
      { params: Promise.resolve({ id: "unknown-workflow" }) },
    );

    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "Unauthorized." });
  });

  test(`workflow ${routeCase.name} run denies stale-run recovery before authorization`, async () => {
    const project = await createProject({
      clientId: `client-${routeCase.name}-stale-denial`,
      label: `${routeCase.name} Stale Denial`,
    });
    const staleTimestamp = new Date(Date.now() - RUN_STALE_MS - 60_000).toISOString();
    project.status = "running";
    project.audit.activeRun = {
      id: `run-${routeCase.name}-stale-denial`,
      startedAt: staleTimestamp,
      updatedAt: staleTimestamp,
      model: "grok-4.5",
    };
    await saveProject(project);
    const before = await loadProject(project.id);

    const deniedRequests: Array<{ headers: Record<string, string>; expectedStatus: number }> = [
      { headers: {}, expectedStatus: 401 },
      { headers: { authorization: "Bearer malformed-token" }, expectedStatus: 401 },
      {
        headers: {
          authorization: createTestAuthHeader({
            id: `operator-${routeCase.name}-stale`,
            role: "internal_operator",
            clientId: project.clientId,
          }),
        },
        expectedStatus: 403,
      },
      {
        headers: {
          authorization: createTestAuthHeader({
            id: `client-${routeCase.name}-stale`,
            role: "client_user",
            clientId: project.clientId,
          }),
        },
        expectedStatus: 403,
      },
    ];

    try {
      for (const deniedRequest of deniedRequests) {
        const response = await routeCase.route(
          makeRequest(routeCase.path(project.id), {}, deniedRequest.headers),
          { params: Promise.resolve({ id: project.id }) },
        );

        assert.equal(response.status, deniedRequest.expectedStatus);
        const after = await loadProject(project.id);
        assertProjectUnchanged(before, after);
        assert.equal(after.audit.activeRun?.id, before.audit.activeRun?.id);
        assert.deepEqual(after.audit.warnings, before.audit.warnings);
        assert.deepEqual(after.audit.runs, before.audit.runs);
      }
    } finally {
      await cleanupProject(project.id);
    }
  });

  test(`workflow ${routeCase.name} run denies operator and client user without side effects`, async () => {
    const project = await createProject({ clientId: `client-${routeCase.name}-roles`, label: `${routeCase.name} Roles` });
    const before = await loadProject(project.id);

    try {
      const operatorResponse = await routeCase.route(
        makeRequest(routeCase.path(project.id), {}, {
          authorization: createTestAuthHeader({
            id: `operator-${routeCase.name}`,
            role: "internal_operator",
            clientId: project.clientId,
          }),
        }),
        { params: Promise.resolve({ id: project.id }) },
      );
      const clientResponse = await routeCase.route(
        makeRequest(routeCase.path(project.id), {}, {
          authorization: createTestAuthHeader({
            id: `client-${routeCase.name}`,
            role: "client_user",
            clientId: project.clientId,
          }),
        }),
        { params: Promise.resolve({ id: project.id }) },
      );

      assert.equal(operatorResponse.status, 403);
      assert.equal(clientResponse.status, 403);
      assertProjectUnchanged(before, await loadProject(project.id));
      assert.equal((await loadProject(project.id)).audit.runs.length, 0);
    } finally {
      await cleanupProject(project.id);
    }
  });

  test(`workflow ${routeCase.name} run fails closed when stored project has no client ownership`, async () => {
    const project = await createProject({ label: `${routeCase.name} Missing Ownership` });
    const before = await loadProject(project.id);

    try {
      const response = await routeCase.route(
        makeRequest(routeCase.path(project.id), {}, adminHeader),
        { params: Promise.resolve({ id: project.id }) },
      );

      assert.equal(response.status, 403);
      assertProjectUnchanged(before, await loadProject(project.id));
    } finally {
      await cleanupProject(project.id);
    }
  });

  test(`workflow ${routeCase.name} run ignores caller ownership overrides and targets stored project`, async () => {
    const project = await createProject({ clientId: `client-${routeCase.name}-stored`, label: `${routeCase.name} Override` });
    const now = new Date().toISOString();
    project.status = "running";
    project.audit.activeRun = {
      id: `run-${routeCase.name}-stored`,
      startedAt: now,
      updatedAt: now,
      model: "grok-4.5",
    };
    await saveProject(project);
    const before = await loadProject(project.id);
    const markers = {
      projectId: "false-project-marker",
      engagementId: "false-engagement-marker",
      clientId: "false-client-marker",
      workflowRunId: "false-run-marker",
    };

    try {
      const response = await routeCase.route(
        makeRequest(routeCase.path(project.id), markers, adminHeader),
        { params: Promise.resolve({ id: project.id }) },
      );
      const body = await response.json();

      assert.equal(response.status, 409);
      assert.equal(body.activeRunId, `run-${routeCase.name}-stored`);
      assert.equal(Object.values(markers).some((marker) => JSON.stringify(body).includes(marker)), false);
      assertProjectUnchanged(before, await loadProject(project.id));
    } finally {
      await cleanupProject(project.id);
    }
  });

  test(`workflow ${routeCase.name} run returns redacted blocking-input conflict`, async () => {
    const project = await createProject({ clientId: `client-${routeCase.name}-blocking`, label: `${routeCase.name} Blocking` });
    const promptMarker = `sensitive-blocking-prompt-${routeCase.name}`;
    const request = await createHumanInputRequest({
      clientId: project.clientId,
      engagementId: project.id,
      type: "missing_information",
      title: `Sensitive title ${routeCase.name}`,
      prompt: promptMarker,
      priority: "high",
      requestedBy: "security-test",
      requiredToContinue: true,
      options: [],
      evidence: [],
      sourceReferences: [],
      metadata: {},
    });
    const before = await loadProject(project.id);

    try {
      const response = await routeCase.route(
        makeRequest(routeCase.path(project.id), {}, adminHeader),
        { params: Promise.resolve({ id: project.id }) },
      );
      const body = await response.json();
      const serialized = JSON.stringify(body);

      assert.equal(response.status, 409);
      assert.equal(body.blockingRequestCount, 1);
      assert.equal(serialized.includes(promptMarker), false);
      assert.equal(serialized.includes(request.id), false);
      assert.equal(serialized.includes("Sensitive title"), false);
      assertProjectUnchanged(before, await loadProject(project.id));
    } finally {
      await cleanupRequest(request.id);
      await cleanupProject(project.id);
    }
  });

  test(`workflow ${routeCase.name} run preserves redacted blocking conflict when audit sink fails`, async () => {
    const project = await createProject({
      clientId: `client-${routeCase.name}-blocking-audit`,
      label: `${routeCase.name} Blocking Audit`,
    });
    const promptMarker = `sensitive-audit-blocking-prompt-${routeCase.name}`;
    const titleMarker = `Sensitive audit title ${routeCase.name}`;
    const request = await createHumanInputRequest({
      clientId: project.clientId,
      engagementId: project.id,
      type: "missing_information",
      title: titleMarker,
      prompt: promptMarker,
      priority: "high",
      requestedBy: "security-test",
      requiredToContinue: true,
      options: [],
      evidence: [],
      sourceReferences: [],
      metadata: {},
    });
    const before = await loadProject(project.id);

    setSecurityAuditSinkForTests(() => {
      throw new Error("intentional blocking audit sink failure");
    });

    try {
      const response = await routeCase.route(
        makeRequest(routeCase.path(project.id), {}, adminHeader),
        { params: Promise.resolve({ id: project.id }) },
      );
      const body = await response.json();
      const serialized = JSON.stringify(body);

      assert.equal(response.status, 409);
      assert.deepEqual(body, {
        error: "Human input is required before this workflow can continue.",
        blockingRequestCount: 1,
      });
      assert.equal(serialized.includes(promptMarker), false);
      assert.equal(serialized.includes(titleMarker), false);
      assert.equal(serialized.includes(request.id), false);
      assert.equal(serialized.includes("intentional blocking audit sink failure"), false);
      const after = await loadProject(project.id);
      assertProjectUnchanged(before, after);
      assert.equal(after.audit.activeRun, null);
      assert.deepEqual(after.audit.warnings, before.audit.warnings);
      assert.deepEqual(after.audit.runs, before.audit.runs);
    } finally {
      await cleanupRequest(request.id);
      await cleanupProject(project.id);
    }
  });

  test(`workflow ${routeCase.name} run returns client-safe production provider unavailable response`, async () => {
    const envSnapshot = applyEnvOverrides({
      NODE_ENV: "development",
      XAI_API_KEY: undefined,
    });
    const project = await createProject({
      clientId: `client-${routeCase.name}-provider-unavailable`,
      label: `${routeCase.name} Provider Unavailable`,
    });
    const before = await loadProject(project.id);

    setSecurityAuditSinkForTests((event) => {
      if (event.reasonCode === "authenticated") {
        Object.assign(process.env, { NODE_ENV: "production" });
      }
    });

    try {
      const response = await routeCase.route(
        makeRequest(routeCase.path(project.id), {}, adminHeader),
        { params: Promise.resolve({ id: project.id }) },
      );
      const body = await response.json();
      const serialized = JSON.stringify(body);

      assert.equal(response.status, 503);
      assert.deepEqual(body, { error: "Workflow provider is unavailable." });
      assert.equal(serialized.includes("XAI_API_KEY"), false);
      assert.equal(serialized.includes(".env"), false);
      assert.equal(serialized.includes("not configured"), false);
      assertProjectUnchanged(before, await loadProject(project.id));
    } finally {
      await cleanupProject(project.id);
      restoreEnv(envSnapshot);
    }
  });

  test(`workflow ${routeCase.name} run sanitizes unexpected storage errors`, async () => {
    const projectId = `malformed-workflow-${routeCase.name}-${Date.now()}`;
    const leakageMarker = `raw-storage-leak-${routeCase.name}`;
    await fs.mkdir(projectStorageDir, { recursive: true });
    await fs.writeFile(path.join(projectStorageDir, `${projectId}.json`), `{${leakageMarker}`, "utf8");

    try {
      const response = await routeCase.route(
        makeRequest(routeCase.path(projectId), {}, adminHeader),
        { params: Promise.resolve({ id: projectId }) },
      );
      const serialized = JSON.stringify(await response.json());

      assert.equal(response.status, 500);
      assert.equal(serialized.includes(leakageMarker), false);
      assert.equal(serialized.includes("stack"), false);
      assert.equal(serialized.includes("/workspaces/"), false);
      assert.match(serialized, /unexpected error/i);
    } finally {
      await cleanupProject(projectId);
    }
  });

  test(`workflow ${routeCase.name} run allows admin, starts once, and returns safe metadata`, async () => {
    const project = await createProject({ clientId: `client-${routeCase.name}-allow`, label: `${routeCase.name} Allow` });
    const requestMarker = `request-body-secret-${routeCase.name}`;

    try {
      const response = await routeCase.route(
        makeRequest(routeCase.path(project.id), { prompt: requestMarker, clientId: "false-client" }, adminHeader),
        { params: Promise.resolve({ id: project.id }) },
      );
      const body = await response.json();
      const serialized = JSON.stringify(body);

      assert.equal(response.status, 202);
      assert.deepEqual(Object.keys(body).sort(), ["activeRunId", "id", "status"]);
      assert.equal(body.id, project.id);
      assert.equal(body.status, "running");
      assert.equal(serialized.includes(requestMarker), false);
      assert.equal(serialized.includes("departments"), false);
      assert.equal(serialized.includes("deliverables"), false);

      const events = getSecurityAuditEventsForTests().filter((event) => event.action === "workflow_run");
      assert.equal(events.some((event) => event.decision === "allow" && event.reasonCode === "workflow_run_started"), true);
      const eventSerialized = JSON.stringify(events);
      assert.equal(eventSerialized.includes(requestMarker), false);
      assert.equal(eventSerialized.includes("authorization"), false);
      assert.equal(eventSerialized.includes("prompt"), false);
      assert.equal(eventSerialized.includes("output"), false);

      await waitForTerminalStatus(project.id);
    } finally {
      await cleanupProject(project.id);
    }
  });

  test(`workflow ${routeCase.name} run preserves outcomes when audit sink fails`, async () => {
    setSecurityAuditSinkForTests(() => {
      throw new Error("intentional workflow audit sink failure");
    });

    const duplicateProject = await createProject({
      clientId: `client-${routeCase.name}-audit-duplicate`,
      label: `${routeCase.name} Audit Duplicate`,
    });
    const runnableProject = await createProject({
      clientId: `client-${routeCase.name}-audit-success`,
      label: `${routeCase.name} Audit Success`,
    });
    const now = new Date().toISOString();
    duplicateProject.status = "running";
    duplicateProject.audit.activeRun = {
      id: `run-${routeCase.name}-audit-duplicate`,
      startedAt: now,
      updatedAt: now,
      model: "grok-4.5",
    };
    await saveProject(duplicateProject);

    try {
      const unauthorizedResponse = await routeCase.route(
        makeRequest(routeCase.path(duplicateProject.id)),
        { params: Promise.resolve({ id: duplicateProject.id }) },
      );
      const forbiddenResponse = await routeCase.route(
        makeRequest(routeCase.path(duplicateProject.id), {}, {
          authorization: createTestAuthHeader({
            id: `operator-${routeCase.name}-audit`,
            role: "internal_operator",
            clientId: duplicateProject.clientId,
          }),
        }),
        { params: Promise.resolve({ id: duplicateProject.id }) },
      );
      const notFoundResponse = await routeCase.route(
        makeRequest(routeCase.path(`missing-${routeCase.name}-audit`), {}, adminHeader),
        { params: Promise.resolve({ id: `missing-${routeCase.name}-audit` }) },
      );
      const conflictResponse = await routeCase.route(
        makeRequest(routeCase.path(duplicateProject.id), {}, adminHeader),
        { params: Promise.resolve({ id: duplicateProject.id }) },
      );
      const successResponse = await routeCase.route(
        makeRequest(routeCase.path(runnableProject.id), {}, adminHeader),
        { params: Promise.resolve({ id: runnableProject.id }) },
      );

      assert.equal(unauthorizedResponse.status, 401);
      assert.equal(forbiddenResponse.status, 403);
      assert.equal(notFoundResponse.status, 404);
      assert.equal(conflictResponse.status, 409);
      assert.equal(successResponse.status, 202);
      await waitForTerminalStatus(runnableProject.id);
    } finally {
      await cleanupProject(duplicateProject.id);
      await cleanupProject(runnableProject.id);
    }
  });
}
