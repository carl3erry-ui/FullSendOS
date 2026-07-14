import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { POST } from "../app/api/projects/[id]/run/route";
import { POST as postEngagementRun } from "../app/api/engagements/[id]/run/route";
import { createEmptyProject } from "../src/schemas/projectSchema.js";
import { loadProject, saveProject } from "../src/storage/projectStore.js";
import { RUN_STALE_MS } from "../src/orchestrator/runLifecycle.js";

const storageDir = path.resolve("data/projects");

function buildRequest() {
  return new Request("http://127.0.0.1:3000/api/projects/test/run", { method: "POST" });
}

function buildEngagementRequest() {
  return new Request("http://127.0.0.1:3000/api/engagements/test/run", { method: "POST" });
}

async function cleanupProject(id: string) {
  const file = path.join(storageDir, `${id}.json`);
  await fs.rm(file, { force: true });
}

async function waitForTerminalProjectStatus(id: string, timeoutMs = 6000) {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const project = await loadProject(id);
    if (project.status !== "running") {
      return project;
    }

    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  throw new Error(`Timed out waiting for project ${id} to reach terminal status.`);
}

test("workflow run route persists running state before async execution and eventually completes", async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousApiKey = process.env.XAI_API_KEY;
  const previousFallbackFlag = process.env.XAI_DEV_FALLBACK;

  process.env.NODE_ENV = "development";
  delete process.env.XAI_API_KEY;
  delete process.env.XAI_DEV_FALLBACK;

  const project = createEmptyProject({
    companyName: "Fallback Test Co",
    objective: "Validate workflow run endpoint",
  });

  await saveProject(project);

  try {
    const response = await POST(buildRequest(), { params: Promise.resolve({ id: project.id }) });
    const body = await response.json();

    assert.equal(response.status, 202);
    assert.equal(body.id, project.id);
    assert.equal(body.status, "running");
    assert.equal(typeof body.activeRunId, "string");

    const runningState = await loadProject(project.id);
    assert.equal(runningState.status, "running");
    assert.equal(runningState.audit.activeRun?.id, body.activeRunId);

    const terminal = await waitForTerminalProjectStatus(project.id);
    assert.match(terminal.status, /needs-review|complete/);
    assert.equal(terminal.audit.activeRun, null);
    assert.ok(terminal.departments.publishing);
    assert.ok(Array.isArray(terminal.audit.runs));
    assert.ok(terminal.audit.runs.length >= 7);
  } finally {
    await cleanupProject(project.id);
    process.env.NODE_ENV = previousNodeEnv;
    if (previousApiKey === undefined) delete process.env.XAI_API_KEY;
    else process.env.XAI_API_KEY = previousApiKey;
    if (previousFallbackFlag === undefined) delete process.env.XAI_DEV_FALLBACK;
    else process.env.XAI_DEV_FALLBACK = previousFallbackFlag;
  }
});

test("workflow run route returns 404 with structured error for unknown project id", async () => {
  const response = await POST(buildRequest(), { params: Promise.resolve({ id: "UNKNOWN-PROJECT-ID" }) });
  const body = await response.json();

  assert.equal(response.status, 404);
  assert.equal(typeof body.error, "string");
  assert.equal(body.error, "Project not found.");
});

test("workflow run route blocks archived lifecycle projects with safe structured error", async () => {
  const project = createEmptyProject({
    companyName: "Archived Guardrail Co",
    objective: "Ensure archived engagement cannot run workflow",
  });

  const archivedAt = new Date().toISOString();
  project.lifecycleStatus = "archived";
  project.archivedAt = archivedAt;
  project.status = "draft";

  await saveProject(project);

  try {
    const before = await loadProject(project.id);
    const response = await POST(buildRequest(), { params: Promise.resolve({ id: project.id }) });
    const body = await response.json();

    assert.equal(response.status, 409);
    assert.equal(body.error?.code, "ENGAGEMENT_NOT_RUNNABLE");
    assert.equal(body.error?.status, "archived");
    assert.match(body.error?.message || "", /Restore the engagement before running the workflow\./);

    const serialized = JSON.stringify(body);
    assert.doesNotMatch(serialized, /storagePath|textExtracted|rawProviderResponse|systemPrompt|diagnosticTrace/i);

    const after = await loadProject(project.id);
    assert.equal(after.status, before.status);
    assert.equal(after.lifecycleStatus, "archived");
    assert.equal(after.audit.activeRun, before.audit.activeRun);
    assert.equal(after.audit.runs.length, before.audit.runs.length);
  } finally {
    await cleanupProject(project.id);
  }
});

test("engagement workflow run alias blocks deleted lifecycle projects with safe structured error", async () => {
  const project = createEmptyProject({
    companyName: "Deleted Guardrail Co",
    objective: "Ensure deleted engagement cannot run workflow",
  });

  const deletedAt = new Date().toISOString();
  project.lifecycleStatus = "deleted";
  project.deletedAt = deletedAt;
  project.status = "draft";

  await saveProject(project);

  try {
    const before = await loadProject(project.id);
    const response = await postEngagementRun(buildEngagementRequest(), { params: Promise.resolve({ id: project.id }) });
    const body = await response.json();

    assert.equal(response.status, 409);
    assert.equal(body.error?.code, "ENGAGEMENT_NOT_RUNNABLE");
    assert.equal(body.error?.status, "deleted");
    assert.match(body.error?.message || "", /Restore the engagement before running the workflow\./);

    const serialized = JSON.stringify(body);
    assert.doesNotMatch(serialized, /storagePath|textExtracted|rawProviderResponse|systemPrompt|diagnosticTrace/i);

    const after = await loadProject(project.id);
    assert.equal(after.status, before.status);
    assert.equal(after.lifecycleStatus, "deleted");
    assert.equal(after.audit.activeRun, before.audit.activeRun);
    assert.equal(after.audit.runs.length, before.audit.runs.length);
  } finally {
    await cleanupProject(project.id);
  }
});

test("engagement workflow run alias returns 404 for unknown project id", async () => {
  const response = await postEngagementRun(buildEngagementRequest(), { params: Promise.resolve({ id: "UNKNOWN-PROJECT-ID" }) });
  const body = await response.json();

  assert.equal(response.status, 404);
  assert.equal(typeof body.error, "string");
  assert.equal(body.error, "Project not found.");
});

test("workflow run route returns 409 for duplicate active run and does not start another run", async () => {
  const project = createEmptyProject({
    companyName: "Duplicate Lock Co",
    objective: "Ensure duplicate requests are rejected",
  });

  const now = new Date().toISOString();
  project.status = "running";
  project.audit.activeRun = {
    id: "run-duplicate-lock",
    startedAt: now,
    updatedAt: now,
    model: "grok-4.5",
  };

  await saveProject(project);

  try {
    const before = await loadProject(project.id);

    const response = await POST(buildRequest(), { params: Promise.resolve({ id: project.id }) });
    const body = await response.json();

    assert.equal(response.status, 409);
    assert.equal(body.status, "running");
    assert.equal(body.activeRunId, "run-duplicate-lock");

    const after = await loadProject(project.id);
    assert.equal(after.audit.runs.length, before.audit.runs.length);
    assert.equal(after.audit.activeRun?.id, "run-duplicate-lock");
  } finally {
    await cleanupProject(project.id);
  }
});

test("stale active run is marked failed before a new run is accepted", async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousApiKey = process.env.XAI_API_KEY;
  const previousFallbackFlag = process.env.XAI_DEV_FALLBACK;

  process.env.NODE_ENV = "development";
  delete process.env.XAI_API_KEY;
  delete process.env.XAI_DEV_FALLBACK;

  const project = createEmptyProject({
    companyName: "Stale Run Co",
    objective: "Recover stale run and restart safely",
  });

  const staleDate = new Date(Date.now() - RUN_STALE_MS - 60_000).toISOString();
  project.status = "running";
  project.audit.activeRun = {
    id: "run-stale-old",
    startedAt: staleDate,
    updatedAt: staleDate,
    model: "grok-4.5",
  };

  await saveProject(project);

  try {
    const response = await POST(buildRequest(), { params: Promise.resolve({ id: project.id }) });
    const body = await response.json();

    assert.equal(response.status, 202);
    assert.equal(body.status, "running");
    assert.notEqual(body.activeRunId, "run-stale-old");

    const after = await loadProject(project.id);
    assert.equal(after.status, "running");
    assert.equal(after.audit.activeRun?.id, body.activeRunId);
    assert.ok(after.audit.warnings.some((warning: string) => warning.includes("stale inactivity")));

    const terminal = await waitForTerminalProjectStatus(project.id);
    assert.match(terminal.status, /needs-review|complete/);
  } finally {
    await cleanupProject(project.id);
    process.env.NODE_ENV = previousNodeEnv;
    if (previousApiKey === undefined) delete process.env.XAI_API_KEY;
    else process.env.XAI_API_KEY = previousApiKey;
    if (previousFallbackFlag === undefined) delete process.env.XAI_DEV_FALLBACK;
    else process.env.XAI_DEV_FALLBACK = previousFallbackFlag;
  }
});

test("workflow run route persists terminal failure when fallback is disabled and API key is missing", async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousApiKey = process.env.XAI_API_KEY;
  const previousFallbackFlag = process.env.XAI_DEV_FALLBACK;

  process.env.NODE_ENV = "development";
  delete process.env.XAI_API_KEY;
  process.env.XAI_DEV_FALLBACK = "false";

  const project = createEmptyProject({
    companyName: "No Key Test Co",
    objective: "Ensure structured error for missing key",
  });

  await saveProject(project);

  try {
    const response = await POST(buildRequest(), { params: Promise.resolve({ id: project.id }) });
    const body = await response.json();

    assert.equal(response.status, 202);
    assert.equal(body.status, "running");

    const terminal = await waitForTerminalProjectStatus(project.id);
    assert.equal(terminal.status, "failed");
    assert.ok(
      terminal.audit.warnings.some((warning: string) => warning.includes("XAI_API_KEY is not configured")),
    );
  } finally {
    await cleanupProject(project.id);
    process.env.NODE_ENV = previousNodeEnv;
    if (previousApiKey === undefined) delete process.env.XAI_API_KEY;
    else process.env.XAI_API_KEY = previousApiKey;
    if (previousFallbackFlag === undefined) delete process.env.XAI_DEV_FALLBACK;
    else process.env.XAI_DEV_FALLBACK = previousFallbackFlag;
  }
});
