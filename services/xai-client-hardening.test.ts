import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { runExistingProject } from "../src/orchestrator/orchestrator.js";
import { createEmptyProject } from "../src/schemas/projectSchema.js";
import { saveProject } from "../src/storage/projectStore.js";
import { callXai } from "../src/services/xaiClient.js";
import { applyEnvOverrides, restoreEnv } from "./test-env";

function buildMockResponse({
  status,
  body,
  ok = status >= 200 && status < 300,
}: {
  status: number;
  body: string;
  ok?: boolean;
}): Response {
  return new Response(body, { status: ok ? status : status });
}

async function cleanupProject(id: string) {
  await fs.rm(path.resolve("data/projects", `${id}.json`), { force: true });
}

test("callXai returns safe timeout error message without prompt or secrets", async () => {
  const previousFetch = globalThis.fetch;
  const envSnapshot = applyEnvOverrides({
    NODE_ENV: "development",
    XAI_API_KEY: "test-key",
    XAI_REQUEST_TIMEOUT_MS: "5",
  });

  const timeoutFetch: typeof fetch = (_input, init) => {
    return new Promise((_, reject) => {
      init?.signal?.addEventListener("abort", () => {
        const abortError = new Error("aborted");
        abortError.name = "AbortError";
        reject(abortError);
      });
    });
  };

  globalThis.fetch = timeoutFetch;

  try {
    await assert.rejects(
      () =>
        callXai({
          prompt: "department: research\nsecret token=abc",
          model: "grok-4.5",
          maxOutputTokens: 5000,
        }),
      (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        assert.match(message, /timed out/i);
        assert.doesNotMatch(message, /secret|token=abc|department:/i);
        return true;
      },
    );
  } finally {
    globalThis.fetch = previousFetch;
    restoreEnv(envSnapshot);
  }
});

test("callXai does not leak raw body when xAI returns non-json", async () => {
  const previousFetch = globalThis.fetch;
  const envSnapshot = applyEnvOverrides({
    NODE_ENV: "development",
    XAI_API_KEY: "test-key",
    XAI_REQUEST_TIMEOUT_MS: "1000",
  });

  globalThis.fetch = async () =>
    buildMockResponse({
    status: 502,
    body: "<html>apiKey=leaked-value</html>",
    ok: false,
  });

  try {
    await assert.rejects(
      () => callXai({ prompt: "department: research", model: "grok-4.5", maxOutputTokens: 5000 }),
      (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        assert.match(message, /invalid response format/i);
        assert.doesNotMatch(message, /leaked-value|<html>|apiKey/i);
        return true;
      },
    );
  } finally {
    globalThis.fetch = previousFetch;
    restoreEnv(envSnapshot);
  }
});

test("callXai sanitizes HTTP error messages", async () => {
  const previousFetch = globalThis.fetch;
  const envSnapshot = applyEnvOverrides({
    NODE_ENV: "development",
    XAI_API_KEY: "test-key",
    XAI_REQUEST_TIMEOUT_MS: "1000",
  });

  const errorPayload = JSON.stringify({
    error: {
      message: "authorization=Bearer super-secret-token",
    },
  });

  globalThis.fetch = async () =>
    buildMockResponse({
    status: 401,
    body: errorPayload,
    ok: false,
  });

  try {
    await assert.rejects(
      () => callXai({ prompt: "department: research", model: "grok-4.5", maxOutputTokens: 5000 }),
      (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        assert.match(message, /HTTP 401/i);
        assert.doesNotMatch(message, /super-secret-token/i);
        assert.match(message, /REDACTED/i);
        return true;
      },
    );
  } finally {
    globalThis.fetch = previousFetch;
    restoreEnv(envSnapshot);
  }
});

test("runExistingProject logs only safe workflow output summaries", async () => {
  const envSnapshot = applyEnvOverrides({ NODE_ENV: "development" });
  const project = createEmptyProject({
    companyName: "Safe Logging Co",
    objective: "Validate sanitized workflow logs",
  });

  const researchPayload = {
    summary: "Research summary",
    claims: [],
    unknowns: [],
    sourceIdsUsed: [],
    industryDefinition: "Professional services",
    marketContext: ["Stable demand"],
    trends: [
      {
        name: "Trend",
        direction: "uncertain",
        implication: "Monitor",
        sourceIds: [],
      },
    ],
    metrics: [],
    opportunities: ["Expand pipeline"],
    risks: ["Limited evidence"],
  };

  const logLines: string[] = [];
  const previousLog = console.log;
  await saveProject(project);

  console.log = (...args: unknown[]) => {
    logLines.push(args.map((item) => String(item)).join(" "));
  };

  try {
    await runExistingProject(project, {
      skipRunStart: true,
      departmentsToRun: ["research"],
      invokeModel: async () => ({
        text: JSON.stringify(researchPayload),
        model: "mock-model",
        raw: null,
      }),
    });

    const output = logLines.join("\n");
    assert.match(output, /workflow-output-summary/);
    assert.doesNotMatch(output, /workflow-raw-output|workflow-normalized-output/);
    assert.doesNotMatch(output, /authorization|api[_-]?key|token|secret/i);
  } finally {
    console.log = previousLog;
    restoreEnv(envSnapshot);
    await cleanupProject(project.id);
  }
});
