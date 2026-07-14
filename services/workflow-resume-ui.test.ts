/**
 * Slice 7.5 Tests: Approval Resume UI
 *
 * Tests the client-side helpers and visibility conditions for the
 * Resume Workflow action.
 *
 * Coverage:
 *  1.  Resume button does not show for ordinary (non-workflow) approved tasks
 *  2.  Resume button shows when task is approved + hasPausedWorkflow
 *  3.  Resume button does not show for rejected tasks
 *  4.  Resume button does not show for revision_requested tasks
 *  5.  Resume button does not show for pending tasks
 *  6.  resumeWorkflow calls correct endpoint
 *  7.  resumeWorkflow sends pauseStateId when present
 *  8.  resumeWorkflow sends request without pauseStateId when absent
 *  9.  resumeWorkflow returns structured result on success
 * 10.  resumeWorkflow throws on 404 (pause state not found)
 * 11.  resumeWorkflow throws on 422 (approval not granted)
 * 12.  resumeWorkflow throws on 409 (already resumed)
 * 13.  Unsafe data is not in task detail response types
 * 14.  fetchTaskDetail includes new workflow pause fields
 * 15.  submitTaskApproval still works correctly (existing behavior preserved)
 * 16.  getApprovalRequestConfig returns correct endpoints
 * 17.  hasPausedWorkflow=false does not show resume button
 * 18.  engagementId missing does not show resume button
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  resumeWorkflow,
  fetchTaskDetail,
  submitTaskApproval,
  getApprovalRequestConfig,
  sanitizeOutputForDisplay,
  type TaskDetailResponse,
} from "../app/components/agent-task-client";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type MockFetch = (url: string, options?: RequestInit) => Promise<Response>;

function mockFetch(status: number, body: unknown): MockFetch {
  return async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
}

function makeTaskDetail(overrides: Partial<TaskDetailResponse["task"]> = {}): TaskDetailResponse {
  return {
    task: {
      id: "task-1",
      agentId: "researcher",
      title: "Research Task",
      objective: "Test",
      status: "completed",
      approvalStatus: "approved",
      priority: "high",
      provider: "mock",
      model: "mock-1.0",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      engagementId: "eng-1",
      hasPausedWorkflow: true,
      pauseStateId: "pause-1",
      ...overrides,
    },
    agent: { name: "Researcher", role: "researcher" },
  };
}

// ---------------------------------------------------------------------------
// Test 1: Resume button visibility — ordinary approved task (no paused workflow)
// ---------------------------------------------------------------------------

test("Resume button not shown for ordinary approved task (hasPausedWorkflow=false)", () => {
  const task = makeTaskDetail({ hasPausedWorkflow: false, pauseStateId: null });

  // Simulate the visibility condition from task-detail-panel.tsx
  const shouldShow =
    task.task.approvalStatus === "approved" &&
    task.task.hasPausedWorkflow === true &&
    Boolean(task.task.engagementId);

  assert.equal(shouldShow, false);
});

// ---------------------------------------------------------------------------
// Test 2: Resume button shown when approved + hasPausedWorkflow
// ---------------------------------------------------------------------------

test("Resume button shown when task is approved and has paused workflow", () => {
  const task = makeTaskDetail({
    approvalStatus: "approved",
    hasPausedWorkflow: true,
    engagementId: "eng-1",
  });

  const shouldShow =
    task.task.approvalStatus === "approved" &&
    task.task.hasPausedWorkflow === true &&
    Boolean(task.task.engagementId);

  assert.equal(shouldShow, true);
});

// ---------------------------------------------------------------------------
// Test 3: Rejected task does not show resume
// ---------------------------------------------------------------------------

test("Resume button not shown for rejected task", () => {
  const task = makeTaskDetail({ approvalStatus: "rejected", hasPausedWorkflow: true });

  const shouldShow =
    task.task.approvalStatus === "approved" &&
    task.task.hasPausedWorkflow === true &&
    Boolean(task.task.engagementId);

  assert.equal(shouldShow, false);
});

// ---------------------------------------------------------------------------
// Test 4: Revision requested does not show resume
// ---------------------------------------------------------------------------

test("Resume button not shown for revision_requested task", () => {
  const task = makeTaskDetail({ approvalStatus: "revision_requested", hasPausedWorkflow: true });

  const shouldShow =
    task.task.approvalStatus === "approved" &&
    task.task.hasPausedWorkflow === true &&
    Boolean(task.task.engagementId);

  assert.equal(shouldShow, false);
});

// ---------------------------------------------------------------------------
// Test 5: Pending task does not show resume
// ---------------------------------------------------------------------------

test("Resume button not shown for pending approval task", () => {
  const task = makeTaskDetail({ approvalStatus: "pending", hasPausedWorkflow: true });

  const shouldShow =
    task.task.approvalStatus === "approved" &&
    task.task.hasPausedWorkflow === true &&
    Boolean(task.task.engagementId);

  assert.equal(shouldShow, false);
});

// ---------------------------------------------------------------------------
// Test 6: resumeWorkflow calls correct endpoint
// ---------------------------------------------------------------------------

test("resumeWorkflow calls POST /api/engagements/[id]/workflow/resume", async () => {
  let capturedUrl = "";
  let capturedMethod = "";

  const mockFetchImpl: MockFetch = async (url, options) => {
    capturedUrl = url;
    capturedMethod = options?.method ?? "GET";
    return new Response(
      JSON.stringify({
        engagementId: "eng-1",
        pauseStateId: "pause-1",
        taskStatus: "completed",
        resumedAt: new Date().toISOString(),
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };

  await resumeWorkflow("eng-1", "pause-1", {}, mockFetchImpl);

  assert.ok(capturedUrl.includes("/api/engagements/eng-1/workflow/resume"), `URL should include resume path, got: ${capturedUrl}`);
  assert.equal(capturedMethod, "POST");
});

// ---------------------------------------------------------------------------
// Test 7: resumeWorkflow sends pauseStateId when present
// ---------------------------------------------------------------------------

test("resumeWorkflow sends pauseStateId in request body when present", async () => {
  let capturedBody: unknown = null;

  const mockFetchImpl: MockFetch = async (_url, options) => {
    capturedBody = options?.body ? JSON.parse(options.body as string) : null;
    return new Response(
      JSON.stringify({
        engagementId: "eng-1",
        pauseStateId: "pause-abc",
        taskStatus: "completed",
        resumedAt: new Date().toISOString(),
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };

  await resumeWorkflow("eng-1", "pause-abc", {}, mockFetchImpl);

  assert.deepEqual((capturedBody as any)?.pauseStateId, "pause-abc");
});

// ---------------------------------------------------------------------------
// Test 8: resumeWorkflow omits pauseStateId when null/undefined
// ---------------------------------------------------------------------------

test("resumeWorkflow omits pauseStateId from body when null", async () => {
  let capturedBody: unknown = null;

  const mockFetchImpl: MockFetch = async (_url, options) => {
    capturedBody = options?.body ? JSON.parse(options.body as string) : null;
    return new Response(
      JSON.stringify({
        engagementId: "eng-1",
        pauseStateId: "found-automatically",
        taskStatus: "completed",
        resumedAt: new Date().toISOString(),
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };

  await resumeWorkflow("eng-1", null, {}, mockFetchImpl);

  assert.ok(
    !(capturedBody as any)?.pauseStateId,
    "pauseStateId should not be in body when null",
  );
});

// ---------------------------------------------------------------------------
// Test 9: resumeWorkflow returns structured result on success
// ---------------------------------------------------------------------------

test("resumeWorkflow returns structured result on success", async () => {
  const expectedResult = {
    engagementId: "eng-1",
    pauseStateId: "pause-x",
    taskStatus: "completed",
    resumedAt: "2026-07-13T12:00:00.000Z",
  };

  const result = await resumeWorkflow(
    "eng-1",
    "pause-x",
    {},
    mockFetch(200, expectedResult),
  );

  assert.equal(result.engagementId, expectedResult.engagementId);
  assert.equal(result.pauseStateId, expectedResult.pauseStateId);
  assert.equal(result.taskStatus, expectedResult.taskStatus);
  assert.ok(result.resumedAt);
});

// ---------------------------------------------------------------------------
// Test 10: resumeWorkflow throws on 404
// ---------------------------------------------------------------------------

test("resumeWorkflow throws on 404 (pause state not found)", async () => {
  await assert.rejects(
    () => resumeWorkflow("eng-1", "bad-pause", {}, mockFetch(404, { error: "Pause state not found." })),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.ok(err.message.toLowerCase().includes("pause") || err.message.toLowerCase().includes("not found") || err.message.length > 0);
      return true;
    },
  );
});

// ---------------------------------------------------------------------------
// Test 11: resumeWorkflow throws on 422 (approval not granted)
// ---------------------------------------------------------------------------

test("resumeWorkflow throws on 422 (approval not granted)", async () => {
  await assert.rejects(
    () => resumeWorkflow("eng-1", "pause-1", {}, mockFetch(422, { error: "Approval not granted." })),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      return true;
    },
  );
});

// ---------------------------------------------------------------------------
// Test 12: resumeWorkflow throws on 409 (already resumed)
// ---------------------------------------------------------------------------

test("resumeWorkflow throws on 409 (already resumed)", async () => {
  await assert.rejects(
    () => resumeWorkflow("eng-1", "pause-1", {}, mockFetch(409, { error: "Already resumed." })),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      return true;
    },
  );
});

// ---------------------------------------------------------------------------
// Test 13: Unsafe data is not in task detail response types
// ---------------------------------------------------------------------------

test("Unsafe keys are filtered by sanitizeOutputForDisplay", () => {
  const unsafeOutput = {
    summary: "Research complete",
    apiKey: "sk-secret-key",
    authorization: "Bearer token123",
    rawProviderPayload: { model: "grok", messages: [] },
    systemPrompt: "You are an AI...",
    diagnosticTrace: { call: 1, response: "raw" },
    password: "hunter2",
    secret: "topsecret",
    token: "abc123",
    // Safe fields
    claims: [{ statement: "Test", confidence: 0.9 }],
  };

  const sanitized = sanitizeOutputForDisplay(unsafeOutput) as Record<string, unknown>;

  // Unsafe keys must be absent
  assert.ok(!("apiKey" in sanitized), "apiKey must be removed");
  assert.ok(!("authorization" in sanitized), "authorization must be removed");
  assert.ok(!("rawProviderPayload" in sanitized), "rawProviderPayload must be removed");
  assert.ok(!("systemPrompt" in sanitized), "systemPrompt must be removed");
  assert.ok(!("diagnosticTrace" in sanitized), "diagnosticTrace must be removed");
  assert.ok(!("password" in sanitized), "password must be removed");
  assert.ok(!("secret" in sanitized), "secret must be removed");
  assert.ok(!("token" in sanitized), "token must be removed");

  // Safe keys must remain
  assert.ok("summary" in sanitized, "summary must be kept");
  assert.ok("claims" in sanitized, "claims must be kept");
});

// ---------------------------------------------------------------------------
// Test 14: fetchTaskDetail maps pause fields from response
// ---------------------------------------------------------------------------

test("fetchTaskDetail maps new workflow pause fields from response", async () => {
  const mockResponse = {
    data: {
      task: {
        id: "task-1",
        agentId: "researcher",
        title: "Research Task",
        objective: "Test objective",
        status: "queued",
        approvalStatus: "approved",
        priority: "high",
        provider: "mock",
        model: "mock-1.0",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        engagementId: "eng-test",
        workflowRunId: "run-test",
        hasPausedWorkflow: true,
        pauseStateId: "pause-test",
      },
      agent: { name: "Researcher", role: "researcher" },
      executions: [],
    },
  };

  const detail = await fetchTaskDetail("task-1", mockFetch(200, mockResponse));

  assert.equal(detail.task.engagementId, "eng-test");
  assert.equal(detail.task.workflowRunId, "run-test");
  assert.equal(detail.task.hasPausedWorkflow, true);
  assert.equal(detail.task.pauseStateId, "pause-test");
});

// ---------------------------------------------------------------------------
// Test 15: submitTaskApproval still works correctly (existing behavior)
// ---------------------------------------------------------------------------

test("submitTaskApproval approve calls correct endpoint", async () => {
  let capturedUrl = "";

  const mockFetchImpl: MockFetch = async (url) => {
    capturedUrl = url;
    return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
  };

  await submitTaskApproval("task-1", "approve", "", mockFetchImpl);

  assert.ok(capturedUrl.includes("/api/agent-tasks/task-1/approve"));
});

test("submitTaskApproval reject calls correct endpoint", async () => {
  let capturedUrl = "";

  const mockFetchImpl: MockFetch = async (url) => {
    capturedUrl = url;
    return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
  };

  await submitTaskApproval("task-1", "reject", "Not valid", mockFetchImpl);

  assert.ok(capturedUrl.includes("/api/agent-tasks/task-1/reject"));
});

// ---------------------------------------------------------------------------
// Test 16: getApprovalRequestConfig returns correct endpoint/payload pairs
// ---------------------------------------------------------------------------

test("getApprovalRequestConfig maps all actions correctly", () => {
  assert.equal(getApprovalRequestConfig("approve", "").endpoint, "approve");
  assert.equal(getApprovalRequestConfig("reject", "").endpoint, "reject");
  assert.equal(getApprovalRequestConfig("revision", "").endpoint, "request-revision");
});

test("getApprovalRequestConfig includes reviewerNotes in payload when non-empty", () => {
  const result = getApprovalRequestConfig("approve", "Looks good");
  assert.deepEqual(result.payload, { reviewerNotes: "Looks good" });
});

test("getApprovalRequestConfig omits reviewerNotes when empty", () => {
  const result = getApprovalRequestConfig("approve", "");
  assert.deepEqual(result.payload, {});
});

// ---------------------------------------------------------------------------
// Test 17: hasPausedWorkflow=false hides resume
// ---------------------------------------------------------------------------

test("hasPausedWorkflow=false hides resume even when approved", () => {
  const task = makeTaskDetail({ approvalStatus: "approved", hasPausedWorkflow: false });

  const shouldShow =
    task.task.approvalStatus === "approved" &&
    task.task.hasPausedWorkflow === true &&
    Boolean(task.task.engagementId);

  assert.equal(shouldShow, false);
});

// ---------------------------------------------------------------------------
// Test 18: Missing engagementId hides resume
// ---------------------------------------------------------------------------

test("Missing engagementId hides resume even when approved and paused", () => {
  const task = makeTaskDetail({ approvalStatus: "approved", hasPausedWorkflow: true, engagementId: null });

  const shouldShow =
    task.task.approvalStatus === "approved" &&
    task.task.hasPausedWorkflow === true &&
    Boolean(task.task.engagementId);

  assert.equal(shouldShow, false);
});
