import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { GET as getProjects, POST as createProject } from "../app/api/projects/route";
import { POST as runProject } from "../app/api/projects/[id]/run/route";
import { GET as getEngagements, POST as createEngagement } from "../app/api/engagements/route";
import { POST as runEngagement } from "../app/api/engagements/[id]/run/route";
import { createEmptyProject } from "../src/schemas/projectSchema.js";
import { loadProject, saveProject } from "../src/storage/projectStore.js";

const storageDir = path.resolve("data/projects");
const dashboardFile = path.resolve("app/components/project-dashboard.tsx");
const engagementRouteFile = path.resolve("app/api/engagements/route.ts");
const engagementRunRouteFile = path.resolve("app/api/engagements/[id]/run/route.ts");

async function cleanupEngagement(id: string) {
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

test("engagement routes delegate to project route handlers without duplicated business logic", async () => {
  const routeSource = await fs.readFile(engagementRouteFile, "utf8");
  const runSource = await fs.readFile(engagementRunRouteFile, "utf8");

  assert.match(routeSource, /from "\.\.\/projects\/route"/);
  assert.match(runSource, /from "\.\.\/\.\.\/\.\.\/projects\/\[id\]\/run\/route"/);
  assert.doesNotMatch(routeSource, /createEmptyProject|saveProject|listProjects/);
  assert.doesNotMatch(runSource, /runExistingProject|beginWorkflowRun|markRunStaleAsFailed/);
});

test("engagement and project create routes return equivalent successful responses", async () => {
  const engagementRequest = new Request("http://127.0.0.1:3000/api/engagements", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ companyName: "Engagement Success Co", objective: "Validate engagement create" }),
  });

  const projectRequest = new Request("http://127.0.0.1:3000/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ companyName: "Project Success Co", objective: "Validate project create" }),
  });

  const engagementResponse = await createEngagement(engagementRequest);
  const projectResponse = await createProject(projectRequest);

  const engagementBody = await engagementResponse.json();
  const projectBody = await projectResponse.json();

  assert.equal(engagementResponse.status, 201);
  assert.equal(projectResponse.status, 201);
  assert.equal(engagementBody.status, "draft");
  assert.equal(projectBody.status, "draft");
  assert.equal(typeof engagementBody.id, "string");
  assert.equal(typeof projectBody.id, "string");
  assert.equal(engagementBody.schemaVersion, projectBody.schemaVersion);
  assert.equal(engagementBody.client.companyName, "Engagement Success Co");
  assert.equal(projectBody.client.companyName, "Project Success Co");

  await cleanupEngagement(engagementBody.id);
  await cleanupEngagement(projectBody.id);
});

test("engagement and project create routes return equivalent validation errors", async () => {
  const invalidEngagementRequest = new Request("http://127.0.0.1:3000/api/engagements", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });

  const invalidProjectRequest = new Request("http://127.0.0.1:3000/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });

  const engagementResponse = await createEngagement(invalidEngagementRequest);
  const projectResponse = await createProject(invalidProjectRequest);

  const engagementBody = await engagementResponse.json();
  const projectBody = await projectResponse.json();

  assert.equal(engagementResponse.status, 400);
  assert.equal(projectResponse.status, 400);
  assert.equal(typeof engagementBody.error, "string");
  assert.equal(engagementBody.error, projectBody.error);
});

test("engagement list route includes records persisted through project model", async () => {
  const project = createEmptyProject({
    companyName: "Persisted Project Visibility Co",
    objective: "Ensure legacy records are visible as engagements",
  });

  await saveProject(project);

  try {
    const response = await getEngagements();
    const list = await response.json();
    assert.equal(response.status, 200);
    assert.equal(Array.isArray(list), true);
    assert.equal(list.some((item: { id?: string }) => item.id === project.id), true);
  } finally {
    await cleanupEngagement(project.id);
  }
});

test("engagement and project list routes return equivalent summary shape", async () => {
  const request = new Request("http://127.0.0.1:3000/api/engagements", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      companyName: "Engagement Alias Co",
      objective: "Validate engagement endpoint alias",
    }),
  });

  const createResponse = await createEngagement(request);
  const created = await createResponse.json();

  assert.equal(createResponse.status, 201);
  assert.equal(typeof created.id, "string");

  try {
    const engagementListResponse = await getEngagements();
    const projectListResponse = await getProjects();
    const engagementList = await engagementListResponse.json();
    const projectList = await projectListResponse.json();

    assert.equal(engagementListResponse.status, 200);
    assert.equal(projectListResponse.status, 200);
    assert.equal(Array.isArray(engagementList), true);
    assert.equal(Array.isArray(projectList), true);

    const fromEngagement = engagementList.find((item: { id?: string }) => item.id === created.id);
    const fromProject = projectList.find((item: { id?: string }) => item.id === created.id);

    assert.equal(Boolean(fromEngagement), true);
    assert.equal(Boolean(fromProject), true);
    assert.deepEqual(Object.keys(fromEngagement).sort(), Object.keys(fromProject).sort());
  } finally {
    await cleanupEngagement(created.id);
  }
});

test("unknown engagement and project run ids return equivalent structured errors", async () => {
  const request = new Request("http://127.0.0.1:3000/api/engagements/UNKNOWN/run", { method: "POST" });
  const engagementResponse = await runEngagement(request, { params: Promise.resolve({ id: "UNKNOWN-ENGAGEMENT-ID" }) });
  const projectResponse = await runProject(request, { params: Promise.resolve({ id: "UNKNOWN-ENGAGEMENT-ID" }) });
  const engagementBody = await engagementResponse.json();
  const projectBody = await projectResponse.json();

  assert.equal(engagementResponse.status, 404);
  assert.equal(projectResponse.status, 404);
  assert.deepEqual(engagementBody, projectBody);
});

test("engagement and project run routes return equivalent duplicate-run behavior", async () => {
  const project = createEmptyProject({
    companyName: "Duplicate Run Equivalence Co",
    objective: "Ensure both run routes reject duplicate active run",
  });

  const now = new Date().toISOString();
  project.status = "running";
  project.audit.activeRun = {
    id: "run-duplicate-compare",
    startedAt: now,
    updatedAt: now,
    model: "grok-4.5",
  };

  await saveProject(project);

  try {
    const request = new Request(`http://127.0.0.1:3000/api/engagements/${project.id}/run`, { method: "POST" });
    const engagementResponse = await runEngagement(request, { params: Promise.resolve({ id: project.id }) });
    const projectResponse = await runProject(request, { params: Promise.resolve({ id: project.id }) });
    const engagementBody = await engagementResponse.json();
    const projectBody = await projectResponse.json();

    assert.equal(engagementResponse.status, 409);
    assert.equal(projectResponse.status, 409);
    assert.deepEqual(engagementBody, projectBody);
  } finally {
    await cleanupEngagement(project.id);
  }
});

test("running through engagement API updates the same persisted record and creates no duplicate record", async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousApiKey = process.env.XAI_API_KEY;
  const previousFallbackFlag = process.env.XAI_DEV_FALLBACK;

  process.env.NODE_ENV = "development";
  delete process.env.XAI_API_KEY;
  delete process.env.XAI_DEV_FALLBACK;

  const project = createEmptyProject({
    companyName: "Engagement Run Persistence Co",
    objective: "Validate engagement run updates same record",
  });

  await saveProject(project);
  const beforeFiles = (await fs.readdir(storageDir)).filter((name) => name.endsWith(".json"));

  try {
    const request = new Request(`http://127.0.0.1:3000/api/engagements/${project.id}/run`, { method: "POST" });
    const response = await runEngagement(request, { params: Promise.resolve({ id: project.id }) });
    const body = await response.json();

    assert.equal(response.status, 202);
    assert.equal(body.id, project.id);
    assert.equal(body.status, "running");

    const runningState = await loadProject(project.id);
    assert.equal(runningState.status, "running");
    assert.equal(runningState.audit.activeRun?.id, body.activeRunId);

    const terminal = await waitForTerminalProjectStatus(project.id);
    assert.match(terminal.status, /needs-review|complete/);
    assert.equal(terminal.id, project.id);
    assert.ok(terminal.deliverables.executiveReport);

    const afterFiles = (await fs.readdir(storageDir)).filter((name) => name.endsWith(".json"));
    const sameRecordCount = afterFiles.filter((name) => name === `${project.id}.json`).length;
    assert.equal(sameRecordCount, 1);
    assert.equal(afterFiles.length, beforeFiles.length);
  } finally {
    await cleanupEngagement(project.id);
    process.env.NODE_ENV = previousNodeEnv;
    if (previousApiKey === undefined) delete process.env.XAI_API_KEY;
    else process.env.XAI_API_KEY = previousApiKey;
    if (previousFallbackFlag === undefined) delete process.env.XAI_DEV_FALLBACK;
    else process.env.XAI_DEV_FALLBACK = previousFallbackFlag;
  }
});

test("engagement create persists in project storage with no separate engagement directory", async () => {
  const request = new Request("http://127.0.0.1:3000/api/engagements", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      companyName: "Engagement Storage Co",
      objective: "Verify compatibility storage path",
    }),
  });

  const response = await createEngagement(request);
  const body = await response.json();

  assert.equal(response.status, 201);

  try {
    const projectRecordPath = path.join(storageDir, `${body.id}.json`);
    const projectRecord = await fs.readFile(projectRecordPath, "utf8");
    assert.ok(projectRecord.includes(body.id));

    const engagementStoragePath = path.resolve("data/engagements");
    const engagementStorageExists = await fs
      .access(engagementStoragePath)
      .then(() => true)
      .catch(() => false);

    assert.equal(engagementStorageExists, false);
  } finally {
    await cleanupEngagement(body.id);
  }
});

test("dashboard API consumers use engagement endpoints", async () => {
  const source = await fs.readFile(dashboardFile, "utf8");

  assert.match(source, /"\/api\/engagements"/);
  assert.match(source, /`\/api\/engagements\/\$\{projectId\}\/run`/);
  assert.doesNotMatch(source, /"\/api\/projects"/);
  assert.doesNotMatch(source, /`\/api\/projects\/\$\{projectId\}\/run`/);
});

test("unknown engagement id behavior remains explicit and backward compatible", async () => {
  const request = new Request("http://127.0.0.1:3000/api/engagements/UNKNOWN/run", { method: "POST" });
  const response = await runEngagement(request, { params: Promise.resolve({ id: "UNKNOWN-ENGAGEMENT-ID" }) });
  const body = await response.json();

  assert.equal(response.status, 404);
  assert.equal(body.error, "Project not found.");
});
