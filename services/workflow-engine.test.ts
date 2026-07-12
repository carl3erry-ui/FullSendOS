import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateWorkflowProgress,
  completeStage,
  failStage,
  getNextRunnableStage,
  initializeWorkflow,
  startStage,
} from "./workflow-engine";
import type { Project } from "../types/project";

function buildProject(): Project {
  const now = new Date().toISOString();
  return {
    id: "PROJECT-1",
    client: {
      companyName: "Acme Corp",
    },
    objective: {
      summary: "Launch consulting engagement",
      constraints: [],
      requestedDeliverables: ["executive-report"],
    },
    status: "draft",
    createdAt: now,
    updatedAt: now,
    workflow: {
      initializedAt: now,
      currentStageId: undefined,
      stages: [],
      stageResults: {},
    },
    deliverables: {
      assets: {},
    },
    evidence: {
      sources: [],
      items: [],
    },
    departments: {
      intelligence: { status: "pending", outputs: {}, unknowns: [], warnings: [] },
      strategy: { status: "pending", outputs: {}, unknowns: [], warnings: [] },
      creative: { status: "pending", outputs: {}, unknowns: [], warnings: [] },
      publishing: { status: "pending", outputs: {}, unknowns: [], warnings: [] },
    },
  };
}

test("initialization creates ordered pending stages", () => {
  const initialized = initializeWorkflow(buildProject());

  assert.equal(initialized.status, "in-progress");
  assert.deepEqual(
    initialized.workflow.stages.map((stage) => stage.id),
    ["intelligence", "strategy", "creative", "publishing"],
  );
  assert.ok(initialized.workflow.stages.every((stage) => stage.status === "pending"));
});

test("valid stage progression runs in order until completion", () => {
  let project = initializeWorkflow(buildProject());

  project = startStage(project, "intelligence");
  project = completeStage(project, "intelligence", { notes: "done" });

  assert.equal(getNextRunnableStage(project), "strategy");

  project = startStage(project, "strategy");
  project = completeStage(project, "strategy");
  project = startStage(project, "creative");
  project = completeStage(project, "creative");
  project = startStage(project, "publishing");
  project = completeStage(project, "publishing");

  assert.equal(project.status, "completed");
  assert.equal(calculateWorkflowProgress(project), 100);
});

test("out-of-order stage start is rejected", () => {
  const project = initializeWorkflow(buildProject());

  assert.throws(() => startStage(project, "creative"), /cannot run before/);
});

test("failure handling marks stage and project as failed", () => {
  let project = initializeWorkflow(buildProject());
  project = startStage(project, "intelligence");
  project = failStage(project, "intelligence", "Source fetch failed");

  assert.equal(project.status, "failed");
  const stage = project.workflow.stages.find((item) => item.id === "intelligence");
  assert.equal(stage?.status, "failed");
  assert.equal(stage?.error, "Source fetch failed");
});

test("progress calculation reflects completed stages", () => {
  let project = initializeWorkflow(buildProject());
  assert.equal(calculateWorkflowProgress(project), 0);

  project = startStage(project, "intelligence");
  project = completeStage(project, "intelligence");
  assert.equal(calculateWorkflowProgress(project), 25);
});
