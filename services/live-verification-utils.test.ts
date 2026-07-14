import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCollaborationTraceSummary,
  evaluateLiveVerificationGuard,
  redactSecrets,
} from "./live-verification-utils";

test("evaluateLiveVerificationGuard rejects when opt-in env is missing", () => {
  const result = evaluateLiveVerificationGuard({
    XAI_API_KEY: "xai-test-key",
    LIVE_PROVIDER_SMOKE: "0",
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.reasons.some((reason) => reason.includes("LIVE_PROVIDER_SMOKE=1")));
  }
});

test("evaluateLiveVerificationGuard rejects when api key is missing", () => {
  const result = evaluateLiveVerificationGuard({
    LIVE_PROVIDER_SMOKE: "1",
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.reasons.some((reason) => reason.includes("XAI_API_KEY")));
  }
});

test("evaluateLiveVerificationGuard succeeds when env is explicitly enabled", () => {
  const result = evaluateLiveVerificationGuard({
    LIVE_PROVIDER_SMOKE: "1",
    XAI_API_KEY: "xai-test-key",
    XAI_DEFAULT_MODEL: "grok-4.5",
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.config.defaultModel, "grok-4.5");
  }
});

test("redactSecrets removes bearer and key-like fragments", () => {
  const input = "Authorization: Bearer secret-token-123 api_key=xai-secret-value";
  const output = redactSecrets(input);

  assert.equal(output.includes("secret-token-123"), false);
  assert.equal(output.includes("xai-secret-value"), false);
  assert.ok(output.includes("[REDACTED]"));
});

test("buildCollaborationTraceSummary produces handoff links and safe status", () => {
  const summary = buildCollaborationTraceSummary({
    workflowRunId: "wf-1",
    steps: [
      {
        taskId: "task-a",
        agentId: "orchestrator",
        provider: "xai",
        model: "grok-4.5",
        status: "completed",
        startedAt: "2026-01-01T00:00:00.000Z",
        completedAt: "2026-01-01T00:00:10.000Z",
        summary: "Prepared plan with api_key=secret-value",
      },
      {
        taskId: "task-b",
        agentId: "researcher",
        provider: "xai",
        model: "grok-4.5",
        status: "completed",
        startedAt: "2026-01-01T00:00:11.000Z",
        completedAt: "2026-01-01T00:00:20.000Z",
        summary: "Validated handoff from task-a",
      },
    ],
  });

  assert.equal(summary.workflowRunId, "wf-1");
  assert.equal(summary.handoffLinks.length, 1);
  assert.equal(summary.handoffLinks[0].fromTaskId, "task-a");
  assert.equal(summary.handoffLinks[0].toTaskId, "task-b");
  assert.equal(summary.safetyStatus, "redacted");
  assert.equal(summary.finalSynthesis.includes("secret-value"), false);
});