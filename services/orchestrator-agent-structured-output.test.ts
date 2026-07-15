import assert from "node:assert/strict";
import test from "node:test";

import { OrchestratorAgent } from "../agents/definitions/orchestrator";
import type { AIProvider } from "../ai/provider";
import { GrokProviderError } from "../ai/types";
import type { AgentTask } from "../agents";

function createTask(): AgentTask {
  const now = new Date().toISOString();
  return {
    id: `test-orchestrator-${Date.now()}`,
    agentId: "orchestrator",
    title: "Test task",
    objective: "Produce a structured execution plan",
    status: "queued",
    priority: "medium",
    provider: "xai",
    model: "grok-4.5",
    approvalStatus: "not_required",
    createdAt: now,
    updatedAt: now,
    requestedBy: "test",
  };
}

test("OrchestratorAgent executes safely with markdown-fenced JSON and normalizes shape", async () => {
  const task = createTask();
  const agent = new OrchestratorAgent();

  let generateTextCalled = false;
  const provider: AIProvider = {
    async generateText() {
      generateTextCalled = true;
      return {
        text: "```json\n{\n  \"executiveSummary\": \"Plan summary\",\n  \"assumptions\": [\"Assume timeline confirmed\"],\n  \"tasks\": [\n    {\n      \"id\": \"t-1\",\n      \"task\": \"Collect baseline data\",\n      \"description\": \"Gather available docs\",\n      \"assignedAgent\": \"researcher\",\n      \"team\": \"intelligence\",\n      \"priority\": \"high\",\n      \"dependsOn\": [],\n      \"approvalRequired\": false,\n      \"deliverable\": \"Data summary\"\n    }\n  ],\n  \"risks\": [{\"title\": \"Incomplete data\"}],\n  \"gates\": [\"Human review\"],\n  \"successMetrics\": [\"Decision-ready report\"],\n  \"nextAction\": \"Review task plan\"\n}\n```",
        provider: "xai",
        model: "grok-4.5",
      };
    },
    async generateStructuredResult() {
      throw new Error("generateStructuredResult should not be used in this path");
    },
  };

  const output = await agent.execute(task, provider);

  assert.equal(generateTextCalled, true);
  assert.equal(output.summary, "Plan summary");
  assert.equal(output.tasks.length, 1);
  assert.equal(output.tasks[0].title, "Collect baseline data");
  assert.equal(output.tasks[0].objective, "Gather available docs");
  assert.equal(output.tasks[0].recommendedAgentId, "researcher");
  assert.equal(output.tasks[0].department, "intelligence");
  assert.deepEqual(output.risks, ["Incomplete data"]);
  assert.equal(output.recommendedNextAction, "Review task plan");
});

test("OrchestratorAgent fails safely on invalid JSON", async () => {
  const task = createTask();
  const agent = new OrchestratorAgent();

  const provider: AIProvider = {
    async generateText() {
      return {
        text: "not-json",
        provider: "xai",
        model: "grok-4.5",
      };
    },
    async generateStructuredResult() {
      throw new Error("unused");
    },
  };

  await assert.rejects(
    () => agent.execute(task, provider),
    (error: unknown) => {
      assert.ok(error instanceof GrokProviderError);
      assert.equal(error.kind, "validation");
      assert.match(error.message, /not valid json/i);
      return true;
    },
  );
});
