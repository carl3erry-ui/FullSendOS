import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { POST } from "../app/api/projects/[id]/run/route";
import { createEmptyProject } from "../src/schemas/projectSchema.js";
import { loadProject, saveProject } from "../src/storage/projectStore.js";

const storageDir = path.resolve("data/projects");

function buildRequest() {
  return new Request("http://127.0.0.1:3000/api/projects/test/run", { method: "POST" });
}

async function cleanupProject(id: string) {
  const file = path.join(storageDir, `${id}.json`);
  await fs.rm(file, { force: true });
}

test("workflow run route succeeds in development fallback mode when API key is absent", async () => {
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

    assert.equal(response.status, 200);
    assert.equal(body.id, project.id);
    assert.match(body.status, /needs-review|complete/);

    const updated = await loadProject(project.id);
    assert.equal(updated.status, body.status);
    assert.ok(updated.departments.publishing);
    assert.ok(Array.isArray(updated.audit.runs));
    assert.ok(updated.audit.runs.length >= 7);
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

test("workflow run route returns 503 with structured error when fallback disabled and API key missing", async () => {
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

    assert.equal(response.status, 503);
    assert.equal(typeof body.error, "string");
    assert.match(body.error, /XAI_API_KEY is not configured/);
  } finally {
    await cleanupProject(project.id);
    process.env.NODE_ENV = previousNodeEnv;
    if (previousApiKey === undefined) delete process.env.XAI_API_KEY;
    else process.env.XAI_API_KEY = previousApiKey;
    if (previousFallbackFlag === undefined) delete process.env.XAI_DEV_FALLBACK;
    else process.env.XAI_DEV_FALLBACK = previousFallbackFlag;
  }
});
