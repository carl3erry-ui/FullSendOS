import assert from "node:assert/strict";
import test from "node:test";

import { ResearcherAgent } from "../agents/definitions/researcher";
import type { AIProvider } from "../ai/provider";
import { GrokProviderError } from "../ai/types";
import type { AgentTask } from "../agents";

function createTask(): AgentTask {
  const now = new Date().toISOString();
  return {
    id: `test-researcher-${Date.now()}`,
    agentId: "researcher",
    title: "Test task",
    objective: "Produce structured research output",
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

test("ResearcherAgent executes safely with plain JSON", async () => {
  const task = createTask();
  const agent = new ResearcherAgent();

  const provider: AIProvider = {
    async generateText() {
      return {
        text: JSON.stringify({
          executiveSummary: "Compact summary",
          researchQuestions: ["What demand signals are visible?"],
          findings: [
            {
              topic: "Demand",
              summary: "Demand signals are stable.",
              confidence: 0.7,
              sources: ["internal-note"],
            },
          ],
          evidence: [
            {
              type: "analysis",
              title: "Signal review",
              content: "Reviewed available signal trends.",
              source: "signal-review",
              confidence: 0.7,
              retrievedAt: "2026-07-15T00:00:00.000Z",
            },
          ],
          assumptions: ["Limited sample window"],
          gaps: ["No primary interviews"],
          risks: ["Signal volatility"],
          recommendations: ["Collect more recent signals"],
          confidence: 0.7,
        }),
        provider: "xai",
        model: "grok-4.5",
      };
    },
    async generateStructuredResult() {
      throw new Error("generateStructuredResult should not be used in this path");
    },
  };

  const output = await agent.execute(task, provider);
  assert.equal(output.executiveSummary, "Compact summary");
  assert.equal(output.findings.length, 1);
  assert.equal(output.findings[0].topic, "Demand");
  assert.equal(output.evidence.length, 1);
});

test("ResearcherAgent parses markdown-fenced JSON and normalizes alternate keys", async () => {
  const task = createTask();
  const agent = new ResearcherAgent();

  const provider: AIProvider = {
    async generateText() {
      return {
        text: "```json\n{\n  \"summary\": \"Research snapshot\",\n  \"questions\": [\"Which segment is fastest growing?\"],\n  \"findings\": [\n    {\n      \"title\": \"Segment growth\",\n      \"insight\": \"SMB segment growth outpaces others.\",\n      \"references\": [\"dataset-1\"],\n      \"confidence\": 78\n    }\n  ],\n  \"sources\": [\n    {\n      \"sourceType\": \"web\",\n      \"name\": \"Industry brief\",\n      \"summary\": \"Public market trend brief\",\n      \"url\": \"https://example.com/brief\",\n      \"reference\": \"industry-brief\",\n      \"confidence\": 0.66,\n      \"timestamp\": \"2026-07-15T00:00:00.000Z\"\n    }\n  ],\n  \"unknowns\": [\"Recent pricing shifts\"],\n  \"limitations\": [\"Public data lag\"],\n  \"nextActions\": [\"Run customer interviews\"],\n  \"confidence\": 0.66\n}\n```",
        provider: "xai",
        model: "grok-4.5",
      };
    },
    async generateStructuredResult() {
      throw new Error("unused");
    },
  };

  const output = await agent.execute(task, provider);
  assert.equal(output.executiveSummary, "Research snapshot");
  assert.equal(output.researchQuestions[0], "Which segment is fastest growing?");
  assert.equal(output.findings[0].topic, "Segment growth");
  assert.equal(output.findings[0].summary, "SMB segment growth outpaces others.");
  assert.equal(output.findings[0].confidence, 0.78);
  assert.equal(output.evidence[0].type, "web");
  assert.equal(output.gaps[0], "Recent pricing shifts");
  assert.equal(output.risks[0], "Public data lag");
  assert.equal(output.recommendations[0], "Run customer interviews");
});

test("ResearcherAgent fails safely on invalid JSON", async () => {
  const task = createTask();
  const agent = new ResearcherAgent();

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

test("ResearcherAgent keeps strict validation for required fields", async () => {
  const task = createTask();
  const agent = new ResearcherAgent();

  const provider: AIProvider = {
    async generateText() {
      return {
        text: JSON.stringify({ status: "ok", timestamp: "2026-07-15T00:00:00.000Z" }),
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
      assert.match(error.message, /insufficient researcher fields/i);
      return true;
    },
  );
});
