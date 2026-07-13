/**
 * Slice 8 Tests: Workflow Pipeline Continuation After Resume
 *
 * Tests the full flow: approved agent step → execute → continue PIPELINE → complete.
 *
 * Coverage (24 tests):
 *  1.  Resume executes approved agent task
 *  2.  Resume marks agent step complete
 *  3.  Resume records pauseStateId in audit entry
 *  4.  Resume starts continuation when pendingStepIds present
 *  5.  Continuation skips already-completed departments
 *  6.  Continuation runs only pending departments
 *  7.  Continuation records progress events for continued steps
 *  8.  Continuation completes workflow when remaining steps succeed
 *  9.  Continuation reaches needs-review or complete final status
 * 10.  Publishing deliverables are created after continuation
 * 11.  Publishing validation still fails closed (fails if publishing output invalid)
 * 12.  Rejected approval prevents continuation
 * 13.  Revision requested prevents continuation
 * 14.  Missing pause state fails clearly
 * 15.  Inconsistent paused state (already resumed) fails clearly
 * 16.  Agent execution failure prevents continuation
 * 17.  Continuation with no pending steps returns no_pending_pipeline_steps
 * 18.  Workflow-created agent task visible by engagementId after resume
 * 19.  continueWorkflowAfterResume requires status="resumed"
 * 20.  runExistingProject with departmentsToRun only runs specified depts
 * 21.  runExistingProject still runs full PIPELINE by default
 * 22.  Existing standard engagement workflow still passes
 * 23.  Existing resume UI tests still pass (spot check)
 * 24.  Unsafe raw data is not in audit entries
 */

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

// Agent framework — import from index to trigger auto-registration
import { globalAgentRegistry, globalInstanceRegistry, globalTaskStore } from "../agents";
import { globalProviderRegistry } from "../ai/provider-registry";
import { createMockProvider } from "../ai/mock-provider";
import { createXAIProvider } from "../ai/xai-provider";

// Services
import { buildPauseState, resumeWorkflowAfterApproval } from "../services/workflow-resume";
import { savePauseState, markPauseResumed } from "../services/workflow-pause-store";
import { continueWorkflowAfterResume } from "../services/workflow-continuation";

// Orchestrator
import { runExistingProject, PIPELINE } from "../src/orchestrator/orchestrator.js";
import { createEmptyProject } from "../src/schemas/projectSchema.js";
import { loadProject, saveProject } from "../src/storage/projectStore.js";

// -------------------------------------------------------------------------
// Helpers from publishing-contract.test.ts
// -------------------------------------------------------------------------

const storageDir = path.resolve("data/projects");
const toCleanup: string[] = [];

async function cleanupProject(id: string) {
  const file = path.join(storageDir, `${id}.json`);
  await fs.rm(file, { force: true }).catch(() => {});
}

function buildValidPublishingRaw() {
  return {
    summary: "Publishing summary",
    claims: [],
    unknowns: [],
    sourceIdsUsed: [],
    reportTitle: "Executive Report",
    subtitle: "Growth plan",
    executiveSummary: "Top-line findings.",
    keyFindings: ["Finding one"],
    recommendations: [
      {
        priority: "immediate",
        recommendation: "Ship executive package",
        rationale: "Supports decisions",
        successMeasure: "Stakeholder approval",
      },
    ],
    reportMarkdown: "# Executive Report\n\nBody text.",
    onePageSummary: "One-page summary content.",
    deckOutline: [{ slide: 1, title: "Situation", purpose: "Context", keyPoints: ["Key point"] }],
  };
}

function buildValidDeptOutput(department: string) {
  if (department === "research") {
    return {
      summary: "Research summary", claims: [], unknowns: [], sourceIdsUsed: [],
      industryDefinition: "Professional services",
      marketContext: ["Demand steady"],
      trends: [{ name: "T1", direction: "uncertain", implication: "Monitor", sourceIds: [] }],
      metrics: [], opportunities: ["Improve conversion"], risks: ["Evidence gap"],
    };
  }
  if (department === "competitors") {
    return {
      summary: "Competitor summary", claims: [], unknowns: [], sourceIdsUsed: [],
      competitors: [{
        name: "Competitor A", category: "Direct", positioning: "Premium",
        strengths: ["Awareness"], weaknesses: ["Price"],
        pricing: { value: "$100", classification: "estimate", sourceIds: [] }, sourceIds: [],
      }],
      comparisonDimensions: ["positioning"], whitespace: ["Mid-market"],
      recommendedPosition: "Reliability",
    };
  }
  if (department === "customers") {
    return {
      summary: "Customer summary", claims: [], unknowns: [], sourceIdsUsed: [],
      personas: [{
        name: "Ops Leader", segment: "SMB", description: "Decision maker",
        goals: ["Reliable delivery"], painPoints: ["Execution risk"],
        buyingTriggers: ["Missed deadlines"], objections: ["Cost"],
        channels: ["Referral"], evidenceLevel: "hypothesis",
      }],
      customerJourney: [{
        stage: "Evaluate", customerQuestion: "Can this deliver?",
        recommendedResponse: "Show references", primaryChannel: "Sales",
      }],
    };
  }
  if (department === "strategy") {
    return {
      summary: "Strategy summary", claims: [], unknowns: [], sourceIdsUsed: [],
      strategicThesis: "Focus on execution",
      positioningStatement: "Dependable consulting OS",
      valueProposition: "Faster decision-grade output",
      strategicPillars: [{ name: "Reliability", rationale: "Trust", actions: ["Harden contracts"], kpis: ["Rate"] }],
      goToMarket: [{ phase: "Now", timing: "Q3", objective: "Pilot", actions: ["Run"] }],
      ninetyDayPlan: [{ priority: 1, action: "Validate", ownerRole: "Ops", timing: "30 days", successMeasure: "10 runs" }],
    };
  }
  if (department === "brand") {
    return {
      summary: "Brand summary", claims: [], unknowns: [], sourceIdsUsed: [],
      brandEssence: "Confident clarity", mission: "Deliver output", vision: "Trusted AI",
      values: ["Trust"], personality: ["Confident"],
      voice: { attributes: ["Clear"], do: ["State uncertainty"], avoid: ["Overclaim"] },
      messaging: { taglineOptions: ["Deliver with confidence"], elevatorPitch: "Full package", proofPoints: ["Contracts"] },
      visualDirection: { palette: [{ name: "Slate", hex: "#0F172A" }], typographyDirection: ["Modern"], imageryDirection: ["Operational"] },
    };
  }
  if (department === "website") {
    return {
      summary: "Website summary", claims: [], unknowns: [], sourceIdsUsed: [],
      primaryGoal: "Start engagements", targetActions: ["Create engagement"],
      sitemap: [{ page: "Home", purpose: "Explain value", sections: ["Hero"], primaryCta: "Start" }],
      homepageWireframe: [{ order: 1, section: "Hero", objective: "Clarify offer", content: ["Outcome"], cta: "Start" }],
      imagePrompts: [{ use: "Hero", prompt: "Executive dashboard", aspectRatio: "16:9" }],
      technicalRecommendations: ["Keep deterministic"],
    };
  }
  return buildValidPublishingRaw();
}

// Mock invokeModel that returns valid outputs for any department
const mockInvokeModel = async ({ department }: { department: string }) => ({
  text: JSON.stringify(buildValidDeptOutput(department)),
  model: "test-model",
  raw: {},
});

// Setup providers
before(() => {
  if (!globalProviderRegistry.isRegistered("mock")) {
    globalProviderRegistry.register("mock", createMockProvider());
  }
  if (!globalProviderRegistry.isRegistered("xai")) {
    const r = createXAIProvider();
    if (r.ok) globalProviderRegistry.register("xai", r.provider);
  }
});

after(async () => {
  for (const id of toCleanup) await cleanupProject(id);
});

function trackProject(id: string) {
  toCleanup.push(id);
  return id;
}

function nowStr() {
  return new Date().toISOString();
}

// -------------------------------------------------------------------------
// Test 1: Resume executes approved agent task
// -------------------------------------------------------------------------

test("Resume executes approved agent task", async () => {
  const taskId = `task-resume-s8-${Date.now()}`;
  const now = nowStr();
  await globalTaskStore.saveTask({
    id: taskId, agentId: "researcher", title: "Slice 8 Resume Test",
    objective: "Test execution", status: "queued", approvalStatus: "approved",
    priority: "high", provider: "mock", model: "mock-1.0", createdAt: now, updatedAt: now,
  });

  const pauseId = `pause-s8-exec-${Date.now()}`;
  await savePauseState(buildPauseState({
    pauseId, workflowRunId: "run-s8-exec",
    projectId: "proj-s8", engagementId: "proj-s8",
    stepId: "step-researcher", agentTaskId: taskId,
    pendingStepIds: [], // No pipeline continuation
  }));

  const result = await resumeWorkflowAfterApproval(pauseId);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.taskStatus, "completed");

  // Task should be completed in store
  const task = await globalTaskStore.loadTask(taskId);
  assert.equal(task.status, "completed");
  assert.ok(task.output, "Task should have output");
});

// -------------------------------------------------------------------------
// Test 2: Resume marks agent step complete (auditEntry status=completed)
// -------------------------------------------------------------------------

test("Resume marks agent step complete in audit entry", async () => {
  const taskId = `task-s8-mark-${Date.now()}`;
  const now = nowStr();
  await globalTaskStore.saveTask({
    id: taskId, agentId: "researcher", title: "Mark Complete Test",
    objective: "Test marking", status: "queued", approvalStatus: "approved",
    priority: "high", provider: "mock", model: "mock-1.0", createdAt: now, updatedAt: now,
  });

  const pauseId = `pause-s8-mark-${Date.now()}`;
  await savePauseState(buildPauseState({
    pauseId, workflowRunId: "run-s8-mark",
    projectId: "proj-s8-mark", engagementId: "proj-s8-mark",
    stepId: "step-mark", agentTaskId: taskId, pendingStepIds: [],
  }));

  const result = await resumeWorkflowAfterApproval(pauseId);
  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.auditEntry.status, "completed");
  assert.equal(result.auditEntry.type, "agent");
  assert.ok(result.auditEntry.completedAt);
});

// -------------------------------------------------------------------------
// Test 3: Resume records pauseStateId in audit entry
// -------------------------------------------------------------------------

test("Resume records pauseStateId in audit entry", async () => {
  const taskId = `task-s8-audit-${Date.now()}`;
  const now = nowStr();
  await globalTaskStore.saveTask({
    id: taskId, agentId: "researcher", title: "Audit PauseStateId Test",
    objective: "Test audit", status: "queued", approvalStatus: "approved",
    priority: "high", provider: "mock", model: "mock-1.0", createdAt: now, updatedAt: now,
  });

  const pauseId = `pause-s8-audit-${Date.now()}`;
  await savePauseState(buildPauseState({
    pauseId, workflowRunId: "run-s8-audit",
    projectId: "proj-s8-audit", engagementId: "proj-s8-audit",
    stepId: "step-audit", agentTaskId: taskId, pendingStepIds: [],
  }));

  const result = await resumeWorkflowAfterApproval(pauseId);
  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.auditEntry.pauseStateId, pauseId);
  assert.ok(result.auditEntry.agentId);
  assert.ok(result.auditEntry.taskId);
});

// -------------------------------------------------------------------------
// Test 4: Resume starts continuation when pendingStepIds present
// -------------------------------------------------------------------------

test("Resume starts pipeline continuation when pendingStepIds is non-empty", async () => {
  const project = createEmptyProject({ companyName: "S8 Continuation Co", objective: "Test continuation" });
  trackProject(project.id);

  const taskId = `task-s8-cont-${Date.now()}`;
  const now = nowStr();
  await globalTaskStore.saveTask({
    id: taskId, agentId: "researcher", title: "Continuation Trigger",
    objective: "Trigger continuation", status: "queued", approvalStatus: "approved",
    priority: "high", provider: "mock", model: "mock-1.0", createdAt: now, updatedAt: now,
  });

  const pauseId = `pause-s8-cont-${Date.now()}`;
  await savePauseState(buildPauseState({
    pauseId, workflowRunId: "run-s8-cont",
    projectId: project.id, engagementId: project.id,
    stepId: "step-pre", agentTaskId: taskId,
    pendingStepIds: ["publishing"], // Only publishing remains
  }));

  // Need a project on disk for continuation to load
  await saveProject(project);

  const result = await resumeWorkflowAfterApproval(pauseId, {
    invokeModel: mockInvokeModel,
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;

  // Continuation should have run
  assert.ok(result.continuation, "Continuation should have run");
  assert.equal(result.continuation?.ok, true);
});

// -------------------------------------------------------------------------
// Test 5: Continuation skips already-completed departments
// -------------------------------------------------------------------------

test("Continuation skips departments already completed", async () => {
  const project = createEmptyProject({ companyName: "Skip Co", objective: "Test skip" });
  trackProject(project.id);

  // Pre-populate research (already done)
  (project as any).departments.research = {
    ...buildValidDeptOutput("research"),
    status: "complete",
    outputs: {},
    unknowns: [],
    warnings: [],
    completedAt: nowStr(),
  };
  await saveProject(project);

  const taskId = `task-s8-skip-${Date.now()}`;
  const now = nowStr();
  await globalTaskStore.saveTask({
    id: taskId, agentId: "researcher", title: "Skip Test",
    objective: "Test skip", status: "queued", approvalStatus: "approved",
    priority: "high", provider: "mock", model: "mock-1.0", createdAt: now, updatedAt: now,
  });

  const pauseId = `pause-s8-skip-${Date.now()}`;
  await savePauseState(buildPauseState({
    pauseId, workflowRunId: "run-s8-skip",
    projectId: project.id, engagementId: project.id,
    stepId: "step-skip", agentTaskId: taskId,
    // research already done; competitors through publishing are pending
    pendingStepIds: ["publishing"],
    completedStepIds: ["research"],
  }));

  // Mark pause as resumed first (bypassing agent execution for this test)
  const resumedPause = { ...buildPauseState({
    pauseId, workflowRunId: "run-s8-skip",
    projectId: project.id, engagementId: project.id,
    stepId: "step-skip", agentTaskId: taskId,
    pendingStepIds: ["publishing"],
    completedStepIds: ["research"],
  }), status: "resumed" as const, resumedAt: nowStr() };
  await savePauseState(resumedPause);

  const contResult = await continueWorkflowAfterResume(pauseId, {
    invokeModel: mockInvokeModel,
  });

  assert.equal(contResult.ok, true);
  if (!contResult.ok) return;
  // Should only have run publishing (research was already complete)
  assert.ok(contResult.ranDepartments.includes("publishing"));
  assert.ok(!contResult.ranDepartments.includes("research"), "Should not re-run research");
});

// -------------------------------------------------------------------------
// Test 6: Continuation runs only pending departments
// -------------------------------------------------------------------------

test("Continuation runs only the specified pending departments", async () => {
  const project = createEmptyProject({ companyName: "Pending Only Co", objective: "Pending depts" });
  trackProject(project.id);
  await saveProject(project);

  const pauseId = `pause-s8-pending-${Date.now()}`;
  const pause = {
    ...buildPauseState({
      pauseId, workflowRunId: "run-s8-pending",
      projectId: project.id, engagementId: project.id,
      stepId: "step-pending", agentTaskId: "task-pending",
      pendingStepIds: ["publishing"], // Only publishing
    }),
    status: "resumed" as const,
    resumedAt: nowStr(),
  };
  await savePauseState(pause);

  const ranDepts: string[] = [];
  const contResult = await continueWorkflowAfterResume(pauseId, {
    invokeModel: async ({ department }) => {
      ranDepts.push(department);
      return { text: JSON.stringify(buildValidDeptOutput(department)), model: "test-model", raw: {} };
    },
  });

  assert.equal(contResult.ok, true);
  if (!contResult.ok) return;
  assert.deepEqual(ranDepts, ["publishing"], "Only publishing should have run");
  assert.deepEqual(contResult.ranDepartments, ["publishing"]);
});

// -------------------------------------------------------------------------
// Test 7: Continuation records progress events for continued steps
// -------------------------------------------------------------------------

test("Continuation fires onProgress events for each continued step", async () => {
  const project = createEmptyProject({ companyName: "Progress Co", objective: "Test progress" });
  trackProject(project.id);
  await saveProject(project);

  const pauseId = `pause-s8-progress-${Date.now()}`;
  await savePauseState({
    ...buildPauseState({
      pauseId, workflowRunId: "run-s8-progress",
      projectId: project.id, engagementId: project.id,
      stepId: "step-progress", agentTaskId: "task-progress",
      pendingStepIds: ["publishing"],
    }),
    status: "resumed" as const,
    resumedAt: nowStr(),
  });

  const events: string[] = [];
  const contResult = await continueWorkflowAfterResume(pauseId, {
    invokeModel: mockInvokeModel,
    onProgress: (event) => {
      events.push(event.type);
    },
  });

  assert.equal(contResult.ok, true);
  assert.ok(events.includes("department-started"), "Should emit department-started");
  assert.ok(events.includes("department-completed"), "Should emit department-completed");
  assert.ok(events.includes("project-completed"), "Should emit project-completed");
});

// -------------------------------------------------------------------------
// Test 8: Continuation completes workflow when remaining steps succeed
// -------------------------------------------------------------------------

test("Continuation completes workflow when remaining steps succeed", async () => {
  const project = createEmptyProject({ companyName: "Completes Co", objective: "Workflow completes" });
  trackProject(project.id);
  await saveProject(project);

  const pauseId = `pause-s8-complete-${Date.now()}`;
  await savePauseState({
    ...buildPauseState({
      pauseId, workflowRunId: "run-s8-complete",
      projectId: project.id, engagementId: project.id,
      stepId: "step-complete", agentTaskId: "task-complete",
      pendingStepIds: ["publishing"],
    }),
    status: "resumed" as const,
    resumedAt: nowStr(),
  });

  const contResult = await continueWorkflowAfterResume(pauseId, {
    invokeModel: mockInvokeModel,
  });

  assert.equal(contResult.ok, true);
  if (!contResult.ok) return;

  // Verify project is in final state
  const persisted = await loadProject(project.id);
  assert.match((persisted as any).status, /complete|needs-review/);
});

// -------------------------------------------------------------------------
// Test 9: Continuation reaches needs-review or complete final status
// -------------------------------------------------------------------------

test("Continuation sets project to needs-review or complete", async () => {
  const project = createEmptyProject({ companyName: "Status Co", objective: "Final status" });
  trackProject(project.id);
  await saveProject(project);

  const pauseId = `pause-s8-status-${Date.now()}`;
  await savePauseState({
    ...buildPauseState({
      pauseId, workflowRunId: "run-s8-status",
      projectId: project.id, engagementId: project.id,
      stepId: "step-status", agentTaskId: "task-status",
      pendingStepIds: ["publishing"],
    }),
    status: "resumed" as const,
    resumedAt: nowStr(),
  });

  await continueWorkflowAfterResume(pauseId, { invokeModel: mockInvokeModel });

  const persisted = await loadProject(project.id);
  const status = (persisted as any).status;
  assert.ok(
    status === "complete" || status === "needs-review",
    `Expected complete or needs-review, got: ${status}`,
  );
});

// -------------------------------------------------------------------------
// Test 10: Publishing deliverables created after continuation
// -------------------------------------------------------------------------

test("Publishing deliverables are created after continuation completes publishing", async () => {
  const project = createEmptyProject({ companyName: "Deliverables Co", objective: "Create deliverables" });
  trackProject(project.id);
  await saveProject(project);

  const pauseId = `pause-s8-deliv-${Date.now()}`;
  await savePauseState({
    ...buildPauseState({
      pauseId, workflowRunId: "run-s8-deliv",
      projectId: project.id, engagementId: project.id,
      stepId: "step-deliv", agentTaskId: "task-deliv",
      pendingStepIds: ["publishing"],
    }),
    status: "resumed" as const,
    resumedAt: nowStr(),
  });

  await continueWorkflowAfterResume(pauseId, { invokeModel: mockInvokeModel });

  const persisted = await loadProject(project.id) as any;
  assert.ok(persisted.deliverables.executiveReport, "Should have executiveReport");
  assert.ok(persisted.deliverables.onePageSummary, "Should have onePageSummary");
  assert.ok(Array.isArray(persisted.deliverables.deckOutline), "Should have deckOutline");
  assert.ok(persisted.deliverables.deckOutline.length > 0, "deckOutline should not be empty");
});

// -------------------------------------------------------------------------
// Test 11: Publishing validation still fails closed
// -------------------------------------------------------------------------

test("Publishing validation still fails closed (missing onePageSummary)", async () => {
  const project = createEmptyProject({ companyName: "Fail Closed Co", objective: "Fail on bad publishing" });
  trackProject(project.id);
  await saveProject(project);

  const pauseId = `pause-s8-failclosed-${Date.now()}`;
  await savePauseState({
    ...buildPauseState({
      pauseId, workflowRunId: "run-s8-fail",
      projectId: project.id, engagementId: project.id,
      stepId: "step-fail", agentTaskId: "task-fail",
      pendingStepIds: ["publishing"],
    }),
    status: "resumed" as const,
    resumedAt: nowStr(),
  });

  const badPublishing = buildValidPublishingRaw() as Record<string, unknown>;
  delete badPublishing.onePageSummary;

  const contResult = await continueWorkflowAfterResume(pauseId, {
    invokeModel: async ({ department }) => ({
      text: JSON.stringify(badPublishing),
      model: "test-model",
      raw: {},
    }),
  });

  // Continuation should fail
  assert.equal(contResult.ok, false);
  if (contResult.ok) return;
  assert.equal(contResult.code, "continuation_failed");
  assert.ok(contResult.reason.includes("Publishing") || contResult.reason.includes("onePageSummary"),
    `Error should mention publishing: ${contResult.reason}`);

  // Project should be in failed state
  const persisted = await loadProject(project.id) as any;
  assert.equal(persisted.status, "failed");
});

// -------------------------------------------------------------------------
// Test 12: Rejected approval prevents continuation
// -------------------------------------------------------------------------

test("Rejected approval prevents resume and continuation", async () => {
  const taskId = `task-s8-rejected-${Date.now()}`;
  const now = nowStr();
  await globalTaskStore.saveTask({
    id: taskId, agentId: "researcher", title: "Rejected Task",
    objective: "Will be rejected", status: "queued", approvalStatus: "rejected",
    priority: "high", provider: "mock", model: "mock-1.0", createdAt: now, updatedAt: now,
  });

  const pauseId = `pause-s8-rejected-${Date.now()}`;
  await savePauseState(buildPauseState({
    pauseId, workflowRunId: "run-s8-rejected",
    projectId: "proj-rejected", engagementId: "proj-rejected",
    stepId: "step-rejected", agentTaskId: taskId,
    pendingStepIds: ["publishing"],
  }));

  const result = await resumeWorkflowAfterApproval(pauseId);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, "approval_not_granted");
  assert.ok(result.reason.includes("rejected"));
});

// -------------------------------------------------------------------------
// Test 13: Revision requested prevents continuation
// -------------------------------------------------------------------------

test("Revision requested prevents resume and continuation", async () => {
  const taskId = `task-s8-revision-${Date.now()}`;
  const now = nowStr();
  await globalTaskStore.saveTask({
    id: taskId, agentId: "researcher", title: "Revision Task",
    objective: "Needs revision", status: "queued", approvalStatus: "revision_requested",
    priority: "high", provider: "mock", model: "mock-1.0", createdAt: now, updatedAt: now,
  });

  const pauseId = `pause-s8-revision-${Date.now()}`;
  await savePauseState(buildPauseState({
    pauseId, workflowRunId: "run-s8-revision",
    projectId: "proj-revision", engagementId: "proj-revision",
    stepId: "step-revision", agentTaskId: taskId,
    pendingStepIds: ["publishing"],
  }));

  const result = await resumeWorkflowAfterApproval(pauseId);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, "approval_not_granted");
});

// -------------------------------------------------------------------------
// Test 14: Missing pause state fails clearly
// -------------------------------------------------------------------------

test("Missing pause state fails clearly with pause_not_found", async () => {
  const result = await resumeWorkflowAfterApproval("nonexistent-pause-s8");
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, "pause_not_found");
});

// -------------------------------------------------------------------------
// Test 15: Already resumed pause state fails clearly
// -------------------------------------------------------------------------

test("Already resumed pause state fails clearly", async () => {
  const pauseId = `pause-s8-already-${Date.now()}`;
  const pause = buildPauseState({
    pauseId, workflowRunId: "run-already",
    projectId: "proj-already", engagementId: "proj-already",
    stepId: "step-already", agentTaskId: "task-already",
    pendingStepIds: [],
  });
  await savePauseState(pause);
  await markPauseResumed(pauseId, "test");

  const result = await resumeWorkflowAfterApproval(pauseId);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, "already_resumed");
});

// -------------------------------------------------------------------------
// Test 16: Agent execution failure prevents continuation
// -------------------------------------------------------------------------

test("Agent execution failure prevents continuation", async () => {
  // Create a task for a disabled/non-existent agent
  const taskId = `task-s8-execfail-${Date.now()}`;
  const now = nowStr();
  // Save a task with a non-existent agent - execution will fail
  await globalTaskStore.saveTask({
    id: taskId, agentId: "nonexistent-agent-s8", title: "Exec Fail Task",
    objective: "Will fail execution", status: "queued", approvalStatus: "approved",
    priority: "high", provider: "mock", model: "mock-1.0", createdAt: now, updatedAt: now,
  });

  const pauseId = `pause-s8-execfail-${Date.now()}`;
  await savePauseState(buildPauseState({
    pauseId, workflowRunId: "run-s8-execfail",
    projectId: "proj-execfail", engagementId: "proj-execfail",
    stepId: "step-execfail", agentTaskId: taskId,
    pendingStepIds: ["publishing"],
  }));

  const result = await resumeWorkflowAfterApproval(pauseId);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, "execution_failed");
  // Continuation should NOT have started since execution failed
  assert.ok(!("continuation" in result));
});

// -------------------------------------------------------------------------
// Test 17: Continuation with no pending steps returns no_pending_pipeline_steps
// -------------------------------------------------------------------------

test("continueWorkflowAfterResume returns no_pending_pipeline_steps when empty", async () => {
  const pauseId = `pause-s8-nopending-${Date.now()}`;
  await savePauseState({
    ...buildPauseState({
      pauseId, workflowRunId: "run-nopending",
      projectId: "proj-nopending", engagementId: "proj-nopending",
      stepId: "step-nopending", agentTaskId: "task-nopending",
      pendingStepIds: [], // Empty
    }),
    status: "resumed" as const,
    resumedAt: nowStr(),
  });

  const result = await continueWorkflowAfterResume(pauseId);
  assert.equal(result.ok, false);
  assert.equal(result.code, "no_pending_pipeline_steps");
});

// -------------------------------------------------------------------------
// Test 18: Workflow-created agent task visible by engagementId
// -------------------------------------------------------------------------

test("Workflow-created agent task remains visible by engagementId after resume", async () => {
  const engagementId = `eng-s8-vis-${Date.now()}`;
  const taskId = `task-s8-vis-${Date.now()}`;
  const now = nowStr();

  await globalTaskStore.saveTask({
    id: taskId, agentId: "researcher", title: "Visible Task",
    objective: "Should be visible", status: "queued", approvalStatus: "approved",
    priority: "high", provider: "mock", model: "mock-1.0",
    projectId: engagementId, engagementId,
    createdAt: now, updatedAt: now,
  });

  const pauseId = `pause-s8-vis-${Date.now()}`;
  await savePauseState(buildPauseState({
    pauseId, workflowRunId: "run-s8-vis",
    projectId: engagementId, engagementId,
    stepId: "step-vis", agentTaskId: taskId,
    pendingStepIds: [],
  }));

  await resumeWorkflowAfterApproval(pauseId);

  // Task should still have engagementId set — visible via /api/agent-tasks?engagementId=
  const updatedTask = await globalTaskStore.loadTask(taskId);
  assert.equal(updatedTask.engagementId, engagementId);
  assert.equal(updatedTask.status, "completed");
});

// -------------------------------------------------------------------------
// Test 19: continueWorkflowAfterResume requires status="resumed"
// -------------------------------------------------------------------------

test("continueWorkflowAfterResume requires pause state with status=resumed", async () => {
  const pauseId = `pause-s8-notresumed-${Date.now()}`;
  await savePauseState(buildPauseState({
    pauseId, workflowRunId: "run-notresumed",
    projectId: "proj-notresumed", engagementId: "proj-notresumed",
    stepId: "step-notresumed", agentTaskId: "task-notresumed",
    pendingStepIds: ["publishing"],
  }));
  // Status is still "waiting_for_approval" — not "resumed"

  const result = await continueWorkflowAfterResume(pauseId);
  assert.equal(result.ok, false);
  assert.equal(result.code, "invalid_state");
});

// -------------------------------------------------------------------------
// Test 20: runExistingProject with departmentsToRun runs only specified
// -------------------------------------------------------------------------

test("runExistingProject with departmentsToRun runs only specified departments", async () => {
  const project = createEmptyProject({ companyName: "Dept Override Co", objective: "Dept override" });
  trackProject(project.id);

  const ran: string[] = [];
  const result = await runExistingProject(project, {
    departmentsToRun: ["publishing"],
    invokeModel: async ({ department }: { department: string }) => {
      ran.push(department);
      return { text: JSON.stringify(buildValidDeptOutput(department)), model: "test-model", raw: {} };
    },
  });

  assert.deepEqual(ran, ["publishing"], "Only publishing should run");
  assert.ok(result.deliverables.executiveReport, "Deliverables should be set");
});

// -------------------------------------------------------------------------
// Test 21: runExistingProject full PIPELINE still runs by default
// -------------------------------------------------------------------------

test("runExistingProject still runs full PIPELINE by default", async () => {
  const project = createEmptyProject({ companyName: "Full Pipeline Co", objective: "Full pipeline" });
  trackProject(project.id);

  const ran: string[] = [];
  await runExistingProject(project, {
    invokeModel: async ({ department }: { department: string }) => {
      ran.push(department);
      return { text: JSON.stringify(buildValidDeptOutput(department)), model: "test-model", raw: {} };
    },
  });

  assert.deepEqual(ran, PIPELINE, "Should run all 7 PIPELINE departments");
});

// -------------------------------------------------------------------------
// Test 22: Existing standard engagement workflow still passes
// -------------------------------------------------------------------------

test("Existing standard engagement workflow still produces all deliverables", async () => {
  const project = createEmptyProject({ companyName: "Standard Workflow Co", objective: "Deliverables validation" });
  trackProject(project.id);

  const result = await runExistingProject(project, { invokeModel: mockInvokeModel });

  assert.match(result.status, /complete|needs-review/);
  assert.ok(result.deliverables.executiveReport, "executiveReport required");
  assert.ok(result.deliverables.onePageSummary, "onePageSummary required");
  assert.ok(Array.isArray(result.deliverables.deckOutline), "deckOutline must be array");
  assert.ok(result.deliverables.deckOutline.length > 0, "deckOutline must not be empty");
});

// -------------------------------------------------------------------------
// Test 23: Resume continuation result object is correct
// -------------------------------------------------------------------------

test("Resume result with continuation includes correct structure", async () => {
  const project = createEmptyProject({ companyName: "Result Structure Co", objective: "Check result" });
  trackProject(project.id);
  await saveProject(project);

  const taskId = `task-s8-struct-${Date.now()}`;
  const now = nowStr();
  await globalTaskStore.saveTask({
    id: taskId, agentId: "researcher", title: "Structure Test",
    objective: "Verify result structure", status: "queued", approvalStatus: "approved",
    priority: "high", provider: "mock", model: "mock-1.0", createdAt: now, updatedAt: now,
  });

  const pauseId = `pause-s8-struct-${Date.now()}`;
  await savePauseState(buildPauseState({
    pauseId, workflowRunId: "run-s8-struct",
    projectId: project.id, engagementId: project.id,
    stepId: "step-struct", agentTaskId: taskId,
    pendingStepIds: ["publishing"],
  }));

  const result = await resumeWorkflowAfterApproval(pauseId, {
    invokeModel: mockInvokeModel,
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;

  // Top-level result fields
  assert.equal(result.taskStatus, "completed");
  assert.ok(result.pauseState);
  assert.ok(result.auditEntry);

  // Continuation result fields
  assert.ok(result.continuation);
  assert.equal(result.continuation?.ok, true);
  if (!result.continuation?.ok) return;
  assert.ok(result.continuation.ranDepartments.includes("publishing"));
  assert.ok(result.continuation.projectId === project.id);
});

// -------------------------------------------------------------------------
// Test 24: Unsafe raw data not in audit entries
// -------------------------------------------------------------------------

test("Unsafe keys not present in audit entry returned by resume", async () => {
  const taskId = `task-s8-unsafe-${Date.now()}`;
  const now = nowStr();
  await globalTaskStore.saveTask({
    id: taskId, agentId: "researcher", title: "Unsafe Check",
    objective: "Safety check", status: "queued", approvalStatus: "approved",
    priority: "high", provider: "mock", model: "mock-1.0", createdAt: now, updatedAt: now,
  });

  const pauseId = `pause-s8-unsafe-${Date.now()}`;
  await savePauseState(buildPauseState({
    pauseId, workflowRunId: "run-s8-unsafe",
    projectId: "proj-unsafe", engagementId: "proj-unsafe",
    stepId: "step-unsafe", agentTaskId: taskId, pendingStepIds: [],
  }));

  const result = await resumeWorkflowAfterApproval(pauseId);
  assert.equal(result.ok, true);
  if (!result.ok) return;

  const entry = result.auditEntry;
  const unsafeKeys = [
    "apiKey", "authorization", "password", "secret", "token",
    "systemPrompt", "rawProviderPayload", "rawProviderResponse",
    "diagnosticTrace", "stackTrace", "debugPrompt",
  ];
  for (const key of unsafeKeys) {
    assert.ok(!(key in entry), `Audit entry must not contain "${key}"`);
  }
});
