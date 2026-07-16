import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { POST as abortWorkflow } from "../app/api/engagements/[id]/abort/route";
import { getWorkflowStabilityState, detectStuckDepartment, isWorkflowStale, isWorkflowTerminal } from "../lib/workflows/workflow-stability";
import { redactSecretLikeValues, safeStatusLine, summarizeProviderError, summarizeWorkflowForConsole } from "../lib/diagnostics/redacted-live-logger";
import { createEmptyProject } from "../src/schemas/projectSchema.js";
import { loadProject, saveProject } from "../src/storage/projectStore.js";

const execFileAsync = promisify(execFile);

function buildAbortRequest() {
  return new Request("http://127.0.0.1:3000/api/engagements/test/abort", { method: "POST" });
}

async function cleanupProject(id: string) {
  await fs.rm(path.resolve("data/projects", `${id}.json`), { force: true });
}

test("terminal workflow state detection", () => {
  assert.equal(isWorkflowTerminal("completed"), true);
  assert.equal(isWorkflowTerminal("needs-review"), true);
  assert.equal(isWorkflowTerminal("failed"), true);
  assert.equal(isWorkflowTerminal("running"), false);
});

test("stale workflow detection uses timeout safely", () => {
  const now = new Date("2026-07-16T12:00:00.000Z");
  assert.equal(isWorkflowStale("2026-07-16T11:30:00.000Z", now, 10 * 60 * 1000), true);
  assert.equal(isWorkflowStale("2026-07-16T11:55:30.000Z", now, 10 * 60 * 1000), false);
  assert.equal(isWorkflowStale(undefined, now, 10 * 60 * 1000), true);
});

test("stuck department detection identifies long-running department", () => {
  const now = new Date("2026-07-16T12:00:00.000Z");
  const result = detectStuckDepartment(
    [{ department: "brand", status: "running", startedAt: "2026-07-16T11:30:00.000Z" }],
    now,
    10 * 60 * 1000,
  );
  assert.ok(result);
  assert.equal(result?.department, "brand");
  assert.equal(result?.status, "timed-out");
});

test("unknown timestamps are handled safely", () => {
  const result = detectStuckDepartment([{ department: "strategy", status: "running" }], new Date(), 10 * 60 * 1000);
  assert.ok(result);
  assert.equal(result?.department, "strategy");
});

test("workflow stability state detects stuck workflow", () => {
  const now = new Date("2026-07-16T12:00:00.000Z");
  const result = getWorkflowStabilityState(
    {
      status: "running",
      updatedAt: "2026-07-16T11:30:00.000Z",
      departments: [{ department: "brand", status: "running", startedAt: "2026-07-16T11:25:00.000Z" }],
    },
    { now, timeoutMs: 10 * 60 * 1000, stuckDepartmentTimeoutMs: 8 * 60 * 1000 },
  );
  assert.equal(result.state, "timed-out");
  assert.match(result.reason, /Workflow stalled/i);
});

test("abort endpoint returns safe JSON", async () => {
  const project = createEmptyProject({
    companyName: "Abort Test Co",
    objective: "Test abort route",
  });
  project.status = "running";
  project.audit.activeRun = {
    id: "run-abort-test",
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    model: "grok-4.5",
  };
  project.audit.runs = [
    {
      department: "brand",
      status: "running",
      startedAt: new Date().toISOString(),
      model: "grok-4.5",
    },
  ];
  await saveProject(project);

  try {
    const response = await abortWorkflow(buildAbortRequest(), { params: Promise.resolve({ id: project.id }) });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.status, "failed");
    assert.equal(body.safeToRetry, true);
    assert.doesNotMatch(JSON.stringify(body), /rawProviderResponse|providerPayload|systemPrompt|hiddenReasoning/i);
  } finally {
    await cleanupProject(project.id);
  }
});

test("redacted logger removes secret-like values", () => {
  const redacted = redactSecretLikeValues({
    apiKey: "secret",
    authorization: "Bearer token",
    xApiKey: "abc",
    nested: { prompt: "hello", hiddenReasoning: "nope" },
    safe: "ok",
  }) as Record<string, unknown>;
  assert.equal(redacted.apiKey, "[REDACTED]");
  assert.equal(redacted.authorization, "[REDACTED]");
  assert.equal((redacted.nested as Record<string, unknown>).prompt, "[REDACTED]");
  assert.equal((redacted.nested as Record<string, unknown>).hiddenReasoning, "[REDACTED]");
  assert.equal(redacted.safe, "ok");
});

test("redacted logger removes raw provider payloads", () => {
  const redacted = redactSecretLikeValues({
    providerPayload: { text: "danger" },
    rawPayload: { value: 1 },
    prompt: "system prompt",
  }) as Record<string, unknown>;
  assert.equal(redacted.providerPayload, "[REDACTED]");
  assert.equal(redacted.rawPayload, "[REDACTED]");
  assert.equal(redacted.prompt, "[REDACTED]");
});

test("safe status lines and provider errors are summarized safely", () => {
  const line = safeStatusLine("Workflow", { status: "running", apiKey: "abc" });
  assert.match(line, /Workflow: /);
  assert.doesNotMatch(line, /abc/);

  const summary = summarizeProviderError(new Error("prompt includes .env.local and x-api-key"));
  assert.doesNotMatch(summary, /\.env\.local|x-api-key|prompt/i);
});

test("workflow summary helper only emits safe fields", () => {
  const summary = summarizeWorkflowForConsole({
    id: "run-1",
    status: "running",
    updatedAt: "2026-07-16T12:00:00.000Z",
    audit: { activeRun: { id: "run-1", model: "grok-4.5", updatedAt: "2026-07-16T12:00:00.000Z" }, warnings: ["warning"] },
    deliverables: { executiveReport: "report", onePageSummary: "summary", deckOutline: [{}] },
    exports: [1, 2],
  });
  assert.equal(summary.id, "run-1");
  assert.equal(summary.status, "running");
  assert.equal(summary.deliverables.executiveReport, true);
  assert.equal(summary.exports, 2);
});

test("live preview status harness prints safe summaries only", async () => {
  const project = createEmptyProject({
    companyName: "Preview Harness Co",
    objective: "Validate harness output",
  });
  project.status = "running";
  project.updatedAt = "2026-07-16T12:00:00.000Z";
  project.deliverables = {
    executiveReport: "Report",
    onePageSummary: "Summary",
    deckOutline: [],
  };
  await saveProject(project);

  try {
    const { stdout } = await execFileAsync("node", ["scripts/live-preview-status.mjs", project.id], {
      cwd: process.cwd(),
    });
    assert.match(stdout, /"engagementId"/);
    assert.match(stdout, /"status":\s*"running"/);
    assert.match(stdout, /"deliverables"/);
    assert.doesNotMatch(stdout, /rawProviderResponse|providerPayload|systemPrompt|hiddenReasoning|\.env\.local/i);
  } finally {
    await cleanupProject(project.id);
  }
});
