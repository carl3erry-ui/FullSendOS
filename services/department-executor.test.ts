import assert from "node:assert/strict";
import test from "node:test";
import type { ZodType } from "zod";
import type { AIProvider, AIProviderRequest, NormalizedAIResponse } from "../ai/provider";
import { createDepartmentExecutor, DepartmentExecutionError } from "./department-executor";
import { initializeWorkflow, completeStage, startStage } from "./workflow-engine";
import type { Project } from "../types/project";

function buildProject(): Project {
  const now = new Date().toISOString();
  return {
    id: "PROJECT-EXEC-1",
    client: { companyName: "Acme Corp" },
    objective: {
      summary: "Evaluate growth options",
      constraints: [],
      requestedDeliverables: ["executive-report"],
    },
    status: "draft",
    createdAt: now,
    updatedAt: now,
    workflow: {
      initializedAt: now,
      stages: [],
      stageResults: {},
    },
    deliverables: { assets: {} },
    evidence: { sources: [], items: [] },
    departments: {
      intelligence: { status: "pending", outputs: {}, unknowns: [], warnings: [] },
      strategy: { status: "pending", outputs: {}, unknowns: [], warnings: [] },
      creative: { status: "pending", outputs: {}, unknowns: [], warnings: [] },
      publishing: { status: "pending", outputs: {}, unknowns: [], warnings: [] },
    },
  };
}

function makeProvider(dataByPrompt: Record<string, unknown> = {}): AIProvider {
  return {
    async generateText(_request: AIProviderRequest): Promise<NormalizedAIResponse> {
      return { text: "ok", model: "test", provider: "mock" };
    },
    async generateStructuredResult<T>(request: AIProviderRequest, _schema: ZodType<T>): Promise<T> {
      const value = dataByPrompt[request.userPrompt] as T | undefined;
      if (value === undefined) {
        throw new Error("provider failure");
      }
      return value;
    },
  };
}

test("executing intelligence successfully stores validated result", async () => {
  let project = initializeWorkflow(buildProject());
  project = startStage(project, "intelligence");

  const executor = createDepartmentExecutor({
    provider: makeProvider({
      [
        `Client: ${project.client.companyName}\nObjective: ${project.objective.summary}\nConstraints: None provided\nProduce market and competitor intelligence with explicit evidence and unknowns.\nReturn strictly valid JSON matching IntelligenceResultSchema.\nDo not wrap JSON in markdown.\nClearly separate facts, assumptions, estimates, and recommendations.\nDo not invent client-specific details.\nDo not reference internal agents or system implementation details.`
      ]: {
        marketSummary: "Market is growing",
        competitors: ["Comp A"],
        evidence: ["Source 1"],
        assumptions: ["Assumption A"],
        risks: ["Risk A"],
        openQuestions: ["Question A"],
      },
    }),
  });

  const next = await executor.executeDepartment(project, "intelligence");
  assert.notEqual(next, project);
  assert.equal(next.departments.intelligence.status, "completed");
  assert.equal((next.workflow.stageResults.intelligence as { marketSummary: string }).marketSummary, "Market is growing");
});

test("rejects strategy before intelligence completes", async () => {
  const project = initializeWorkflow(buildProject());
  const executor = createDepartmentExecutor({ provider: makeProvider() });

  await assert.rejects(
    () => executor.executeDepartment(project, "strategy"),
    (error: unknown) => {
      assert.ok(error instanceof DepartmentExecutionError);
      assert.equal(error.kind, "dependency_incomplete");
      return true;
    },
  );
});

test("executes strategy after intelligence completes", async () => {
  let project = initializeWorkflow(buildProject());
  project = startStage(project, "intelligence");
  project = completeStage(project, "intelligence", { precomputed: true });

  const strategyPrompt = [
    `Client: ${project.client.companyName}`,
    `Objective: ${project.objective.summary}`,
    `Intelligence findings: ${JSON.stringify(project.workflow.stageResults.intelligence || {})}`,
    "Develop clear positioning, target customer strategy, and prioritized recommendations.",
    "Return strictly valid JSON matching StrategyResultSchema.\nDo not wrap JSON in markdown.\nClearly separate facts, assumptions, estimates, and recommendations.\nDo not invent client-specific details.\nDo not reference internal agents or system implementation details.",
  ].join("\n");

  const executor = createDepartmentExecutor({
    provider: makeProvider({
      [strategyPrompt]: {
        positioning: "Category leader",
        targetCustomers: ["SMBs"],
        valueProposition: "Faster deployment",
        recommendations: ["Focus vertical A"],
        priorities: ["Priority 1"],
        actionPlan: ["Action 1"],
      },
    }),
  });

  const next = await executor.executeDepartment(project, "strategy");
  assert.equal(next.departments.strategy.status, "completed");
});

test("unknown department rejection", async () => {
  const project = initializeWorkflow(buildProject());
  const executor = createDepartmentExecutor({ provider: makeProvider() });

  await assert.rejects(
    () => executor.executeDepartment(project, "intelligencex" as never),
    (error: unknown) => {
      assert.ok(error instanceof DepartmentExecutionError);
      assert.equal(error.kind, "unknown_department");
      return true;
    },
  );
});

test("provider failure propagation", async () => {
  let project = initializeWorkflow(buildProject());
  project = startStage(project, "intelligence");

  const executor = createDepartmentExecutor({
    provider: {
      async generateText() {
        return { text: "", model: "mock", provider: "mock" };
      },
      async generateStructuredResult() {
        throw new Error("provider down");
      },
    },
  });

  await assert.rejects(
    () => executor.executeDepartment(project, "intelligence"),
    (error: unknown) => {
      assert.ok(error instanceof DepartmentExecutionError);
      assert.equal(error.kind, "provider_failure");
      return true;
    },
  );
});

test("malformed structured output rejection", async () => {
  let project = initializeWorkflow(buildProject());
  project = startStage(project, "intelligence");

  const executor = createDepartmentExecutor({
    provider: {
      async generateText() {
        return { text: "", model: "mock", provider: "mock" };
      },
      async generateStructuredResult() {
        throw { kind: "validation", message: "bad JSON" };
      },
    },
  });

  await assert.rejects(
    () => executor.executeDepartment(project, "intelligence"),
    (error: unknown) => {
      assert.ok(error instanceof DepartmentExecutionError);
      assert.equal(error.kind, "malformed_structured_response");
      return true;
    },
  );
});

test("immutable project updates", async () => {
  let project = initializeWorkflow(buildProject());
  project = startStage(project, "intelligence");

  const prompt = [
    `Client: ${project.client.companyName}`,
    `Objective: ${project.objective.summary}`,
    "Constraints: None provided",
    "Produce market and competitor intelligence with explicit evidence and unknowns.",
    "Return strictly valid JSON matching IntelligenceResultSchema.\nDo not wrap JSON in markdown.\nClearly separate facts, assumptions, estimates, and recommendations.\nDo not invent client-specific details.\nDo not reference internal agents or system implementation details.",
  ].join("\n");

  const executor = createDepartmentExecutor({
    provider: makeProvider({
      [prompt]: {
        marketSummary: "Market",
        competitors: [],
        evidence: [],
        assumptions: [],
        risks: [],
        openQuestions: [],
      },
    }),
  });

  const before = project;
  const after = await executor.executeDepartment(project, "intelligence");

  assert.notEqual(before, after);
  assert.equal(before.departments.intelligence.status, "pending");
  assert.equal(after.departments.intelligence.status, "completed");
});

test("publishing dependency enforcement", async () => {
  let project = initializeWorkflow(buildProject());
  project = startStage(project, "intelligence");
  project = completeStage(project, "intelligence", { ok: true });

  const executor = createDepartmentExecutor({ provider: makeProvider() });

  await assert.rejects(
    () => executor.executeDepartment(project, "publishing"),
    (error: unknown) => {
      assert.ok(error instanceof DepartmentExecutionError);
      assert.equal(error.kind, "dependency_incomplete");
      return true;
    },
  );
});
