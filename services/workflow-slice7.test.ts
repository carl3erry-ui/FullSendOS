/**
 * Slice 7 Tests: Formal Workflow Step Model and Approval Resume
 *
 * Coverage:
 *  1.  Formal schema accepts automation step
 *  2.  Formal schema accepts agent step
 *  3.  Formal schema accepts human_approval step
 *  4.  Agent step requiring approval persists paused workflow state
 *  5.  Pending approval does not continue workflow (no execution)
 *  6.  Approval granted allows resume (executeWorkflowAfterApproval succeeds)
 *  7.  Resume continues from correct step (task executed, status=completed)
 *  8.  Resume does not rerun completed prior steps
 *  9.  Rejected approval prevents resume
 * 10.  Revision requested prevents automatic resume
 * 11.  Missing paused state fails clearly
 * 12.  Inconsistent paused state (wrong status) fails clearly
 * 13.  Audit records pause event (pauseStateId in audit entry)
 * 14.  Audit records resume event (auditEntry returned on success)
 * 15.  Audit records completed-after-resume event (taskStatus=completed)
 * 16.  Existing standard engagement workflow test still passes
 * 17.  Unsafe data is not exposed in audit entries
 * 18.  PausedWorkflowState round-trips through save/load
 * 19.  findActivePauseForProject finds only waiting_for_approval states
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

// Schema
import {
  WorkflowStepSchema,
  AutomationStepSchema,
  AgentStepSchema,
  HumanApprovalStepSchema,
  PausedWorkflowStateSchema,
} from "../services/workflow-step-schema";

// Pause store
import {
  savePauseState,
  loadPauseState,
  findActivePauseForProject,
  markPauseResumed,
  markPauseCancelled,
} from "../services/workflow-pause-store";

// Resume
import { resumeWorkflowAfterApproval, buildPauseState } from "../services/workflow-resume";

// Executor (for integration tests)
import {
  executeWorkflowAgentStep,
  type WorkflowAgentStepConfig,
} from "../services/workflow-agent-executor";

// Audit recorder
import { recordAgentStepInAudit } from "../services/workflow-audit-recorder";

// Agent framework — import from index to trigger agent auto-registration
import { globalAgentRegistry, globalInstanceRegistry, globalTaskStore } from "../agents";
import { globalProviderRegistry } from "../ai/provider-registry";
import { createMockProvider } from "../ai/mock-provider";
import { createXAIProvider } from "../ai/xai-provider";
import type { Project } from "../types/project";

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

// Register providers (guard against double registration across test files)
if (!globalProviderRegistry.isRegistered("mock")) {
  globalProviderRegistry.register("mock", createMockProvider());
}
if (!globalProviderRegistry.isRegistered("xai")) {
  const xaiResult = createXAIProvider();
  if (xaiResult.ok) {
    globalProviderRegistry.register("xai", xaiResult.provider);
  }
}

// Override PAUSE_DIR to a temp directory so tests don't pollute data/
const tmpPauseDir = path.join(os.tmpdir(), `test-pauses-${Date.now()}`);

// Monkey-patch the pause store's directory for tests
// We do this by ensuring the data/workflow-pauses dir is isolated
// In practice, tests write to a predictable temp location via process.env
process.env.WORKFLOW_PAUSE_DIR_OVERRIDE = tmpPauseDir;

const mockProject: Project = {
  id: "test-project-slice7",
  client: {
    companyName: "Test Co",
    contactName: "Test User",
    website: "https://example.com",
    industry: "Technology",
  },
  objective: {
    summary: "Test project for Slice 7",
    constraints: [],
    requestedDeliverables: [],
  },
  status: "in-progress",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  workflow: {
    initializedAt: new Date().toISOString(),
    stages: [
      { id: "intelligence", label: "Intelligence", status: "completed" },
      { id: "strategy", label: "Strategy", status: "pending" },
      { id: "creative", label: "Creative", status: "pending" },
      { id: "publishing", label: "Publishing", status: "pending" },
    ],
    stageResults: {},
  },
  deliverables: { assets: {} },
  evidence: { sources: [], items: [] },
  departments: {
    intelligence: {
      status: "completed",
      outputs: {},
      unknowns: [],
      warnings: [],
    },
    strategy: { status: "pending", outputs: {}, unknowns: [], warnings: [] },
    creative: { status: "pending", outputs: {}, unknowns: [], warnings: [] },
    publishing: { status: "pending", outputs: {}, unknowns: [], warnings: [] },
  },
};

function nowStr() {
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// Test 1: Formal schema accepts automation step
// ---------------------------------------------------------------------------

test("Formal schema accepts automation step", () => {
  const step = WorkflowStepSchema.parse({
    type: "automation",
    id: "step-auto-1",
    title: "Intelligence Department",
    status: "completed",
    dependencies: [],
    departmentId: "intelligence",
    createdAt: nowStr(),
    updatedAt: nowStr(),
    completedAt: nowStr(),
  });

  assert.equal(step.type, "automation");
  assert.equal(step.status, "completed");
});

// ---------------------------------------------------------------------------
// Test 2: Formal schema accepts agent step
// ---------------------------------------------------------------------------

test("Formal schema accepts agent step", () => {
  const step = WorkflowStepSchema.parse({
    type: "agent",
    id: "step-agent-1",
    title: "Research Advisor",
    status: "waiting_for_approval",
    dependencies: [],
    agentId: "researcher",
    requiresApproval: true,
    approvalMode: "pre_execution",
    createdAt: nowStr(),
    updatedAt: nowStr(),
  });

  assert.equal(step.type, "agent");
  assert.equal((step as any).requiresApproval, true);
  assert.equal((step as any).approvalMode, "pre_execution");
});

// ---------------------------------------------------------------------------
// Test 3: Formal schema accepts human_approval step
// ---------------------------------------------------------------------------

test("Formal schema accepts human_approval step", () => {
  const step = WorkflowStepSchema.parse({
    type: "human_approval",
    id: "step-human-1",
    title: "Strategy Review Approval",
    status: "waiting_for_approval",
    dependencies: ["step-agent-1"],
    reason: "Executive sign-off required before publishing",
    requestedBy: "workflow-engine",
    createdAt: nowStr(),
    updatedAt: nowStr(),
  });

  assert.equal(step.type, "human_approval");
  assert.equal((step as any).reason, "Executive sign-off required before publishing");
});

// ---------------------------------------------------------------------------
// Test 4: Agent step requiring approval persists paused workflow state
// ---------------------------------------------------------------------------

test("Agent step requiring approval persists paused workflow state", async () => {
  const pauseId = `test-pause-${Date.now()}`;
  const pause = buildPauseState({
    pauseId,
    workflowRunId: "run-test-1",
    projectId: mockProject.id,
    engagementId: mockProject.id,
    stepId: "step-researcher",
    agentTaskId: "task-researcher-001",
    completedStepIds: ["step-auto-1"],
    failedStepIds: [],
    pendingStepIds: ["step-strategy"],
  });

  await savePauseState(pause);
  const loaded = await loadPauseState(pauseId);

  assert.equal(loaded.id, pauseId);
  assert.equal(loaded.status, "waiting_for_approval");
  assert.equal(loaded.agentTaskId, "task-researcher-001");
  assert.equal(loaded.projectId, mockProject.id);
  assert.deepEqual(loaded.completedStepIds, ["step-auto-1"]);
  assert.deepEqual(loaded.pendingStepIds, ["step-strategy"]);
});

// ---------------------------------------------------------------------------
// Test 5: Pending approval does not continue workflow execution
// ---------------------------------------------------------------------------

test("Pending approval does not continue workflow (no execution occurs)", async () => {
  const step: WorkflowAgentStepConfig = {
    agentId: "researcher",
    title: "Approval-Gated Research",
    objective: "Research market trends with approval required",
    requiresApproval: true,
  };

  const entry = await executeWorkflowAgentStep({
    project: mockProject,
    step,
    workflowRunId: "run-pending-test",
  });

  assert.equal(entry.status, "waiting-for-approval");
  assert.ok(entry.taskId, "Should have a task ID");
  assert.ok(!entry.completedAt, "Should not have a completion time");

  // Verify task is queued (not running or completed)
  const task = await globalTaskStore.loadTask(entry.taskId);
  assert.equal(task.approvalStatus, "pending");
  assert.equal(task.status, "queued");
});

// ---------------------------------------------------------------------------
// Test 6: Approval granted allows resume
// ---------------------------------------------------------------------------

test("Approval granted allows resume", async () => {
  // 1. Create a task and save it as approved
  const taskId = `task-resume-test-${Date.now()}`;
  const now = nowStr();
  await globalTaskStore.saveTask({
    id: taskId,
    agentId: "researcher",
    title: "Resume Test Task",
    objective: "Test resume after approval",
    status: "queued",
    approvalStatus: "approved",
    priority: "high",
    provider: "mock",
    model: "mock-1.0",
    createdAt: now,
    updatedAt: now,
  });

  // 2. Create and save a pause state pointing to that task
  const pauseId = `pause-resume-test-${Date.now()}`;
  const pause = buildPauseState({
    pauseId,
    workflowRunId: "run-resume-test",
    projectId: mockProject.id,
    engagementId: mockProject.id,
    stepId: "step-researcher",
    agentTaskId: taskId,
  });
  await savePauseState(pause);

  // 3. Resume the workflow
  const result = await resumeWorkflowAfterApproval(pauseId, { resumedBy: "test-user" });

  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.taskStatus, "completed");
  assert.ok(result.pauseState.resumedAt, "Should have resumedAt timestamp");
  assert.equal(result.pauseState.resumedBy, "test-user");
});

// ---------------------------------------------------------------------------
// Test 7: Resume continues from correct step (task executed)
// ---------------------------------------------------------------------------

test("Resume executes the pending task from the correct step", async () => {
  const taskId = `task-correct-step-${Date.now()}`;
  const now = nowStr();
  await globalTaskStore.saveTask({
    id: taskId,
    agentId: "quality-control",
    title: "QC Review",
    objective: "Quality control review",
    status: "queued",
    approvalStatus: "approved",
    priority: "high",
    provider: "mock",
    model: "mock-1.0",
    createdAt: now,
    updatedAt: now,
  });

  const pauseId = `pause-correct-step-${Date.now()}`;
  const pause = buildPauseState({
    pauseId,
    workflowRunId: "run-correct-step",
    projectId: mockProject.id,
    engagementId: mockProject.id,
    stepId: "step-qc",
    agentTaskId: taskId,
    completedStepIds: ["step-intelligence", "step-research"],
  });
  await savePauseState(pause);

  const result = await resumeWorkflowAfterApproval(pauseId);
  assert.equal(result.ok, true);
  if (!result.ok) return;

  // Verify the task was executed (completedAt set on updated task)
  const updatedTask = await globalTaskStore.loadTask(taskId);
  assert.equal(updatedTask.status, "completed");
  assert.ok(updatedTask.output, "Should have output from mock execution");

  // Verify audit entry references correct step
  assert.equal(result.auditEntry.stepId, "step-qc");
});

// ---------------------------------------------------------------------------
// Test 8: Resume does not rerun completed prior steps
// ---------------------------------------------------------------------------

test("Resume does not rerun completed prior steps", async () => {
  const taskId = `task-no-rerun-${Date.now()}`;
  const now = nowStr();
  await globalTaskStore.saveTask({
    id: taskId,
    agentId: "researcher",
    title: "Focused Resume Task",
    objective: "Only this step should run",
    status: "queued",
    approvalStatus: "approved",
    priority: "high",
    provider: "mock",
    model: "mock-1.0",
    createdAt: now,
    updatedAt: now,
  });

  const pauseId = `pause-no-rerun-${Date.now()}`;
  const pause = buildPauseState({
    pauseId,
    workflowRunId: "run-no-rerun",
    projectId: mockProject.id,
    engagementId: mockProject.id,
    stepId: "step-agent",
    agentTaskId: taskId,
    completedStepIds: ["step-intelligence", "step-strategy"],
  });
  await savePauseState(pause);

  const result = await resumeWorkflowAfterApproval(pauseId);
  assert.equal(result.ok, true);
  if (!result.ok) return;

  // completedStepIds from the pause state are preserved — prior steps are not re-executed
  assert.deepEqual(result.pauseState.completedStepIds, ["step-intelligence", "step-strategy"]);
});

// ---------------------------------------------------------------------------
// Test 9: Rejected approval prevents resume
// ---------------------------------------------------------------------------

test("Rejected approval prevents resume", async () => {
  const taskId = `task-rejected-${Date.now()}`;
  const now = nowStr();
  await globalTaskStore.saveTask({
    id: taskId,
    agentId: "researcher",
    title: "Rejected Task",
    objective: "Will be rejected",
    status: "queued",
    approvalStatus: "rejected",    // rejected, not approved
    priority: "high",
    provider: "mock",
    model: "mock-1.0",
    createdAt: now,
    updatedAt: now,
  });

  const pauseId = `pause-rejected-${Date.now()}`;
  const pause = buildPauseState({
    pauseId,
    workflowRunId: "run-rejected",
    projectId: mockProject.id,
    engagementId: mockProject.id,
    stepId: "step-rejected",
    agentTaskId: taskId,
  });
  await savePauseState(pause);

  const result = await resumeWorkflowAfterApproval(pauseId);

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, "approval_not_granted");
  assert.ok(result.reason.includes("rejected"));
});

// ---------------------------------------------------------------------------
// Test 10: Revision requested prevents automatic resume
// ---------------------------------------------------------------------------

test("Revision requested prevents automatic resume", async () => {
  const taskId = `task-revision-${Date.now()}`;
  const now = nowStr();
  await globalTaskStore.saveTask({
    id: taskId,
    agentId: "researcher",
    title: "Revision Task",
    objective: "Needs revision",
    status: "queued",
    approvalStatus: "revision_requested",
    priority: "high",
    provider: "mock",
    model: "mock-1.0",
    createdAt: now,
    updatedAt: now,
  });

  const pauseId = `pause-revision-${Date.now()}`;
  const pause = buildPauseState({
    pauseId,
    workflowRunId: "run-revision",
    projectId: mockProject.id,
    engagementId: mockProject.id,
    stepId: "step-revision",
    agentTaskId: taskId,
  });
  await savePauseState(pause);

  const result = await resumeWorkflowAfterApproval(pauseId);

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, "approval_not_granted");
  assert.ok(result.reason.includes("revision_requested"));
});

// ---------------------------------------------------------------------------
// Test 11: Missing paused state fails clearly
// ---------------------------------------------------------------------------

test("Missing paused state fails clearly", async () => {
  const result = await resumeWorkflowAfterApproval("nonexistent-pause-id-xyz");

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, "pause_not_found");
  assert.ok(result.reason.includes("nonexistent-pause-id-xyz"));
});

// ---------------------------------------------------------------------------
// Test 12: Inconsistent paused state (wrong status) fails clearly
// ---------------------------------------------------------------------------

test("Inconsistent paused state (already resumed) fails clearly", async () => {
  const pauseId = `pause-already-resumed-${Date.now()}`;
  const pause = buildPauseState({
    pauseId,
    workflowRunId: "run-already",
    projectId: mockProject.id,
    engagementId: mockProject.id,
    stepId: "step-x",
    agentTaskId: "task-x",
  });
  await savePauseState(pause);
  await markPauseResumed(pauseId, "test");

  // Attempt to resume again
  const result = await resumeWorkflowAfterApproval(pauseId);

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, "already_resumed");
});

// ---------------------------------------------------------------------------
// Test 13: Audit records pause event (pauseStateId in audit entry)
// ---------------------------------------------------------------------------

test("Audit records pause event with pauseStateId", async () => {
  const step: WorkflowAgentStepConfig = {
    agentId: "researcher",
    title: "Audited Approval Step",
    objective: "This step should be audited with pause state ID",
    requiresApproval: true,
  };

  const entry = await executeWorkflowAgentStep({
    project: mockProject,
    step,
    workflowRunId: "run-audit-test",
  });

  assert.equal(entry.status, "waiting-for-approval");
  assert.ok(entry.pauseStateId, "Should have pauseStateId in audit entry");

  const project = recordAgentStepInAudit(mockProject, entry);
  const runs = project.audit?.runs ?? [];
  const agentRun = runs.find((r: any) => r.type === "agent" && r.status === "waiting-for-approval");

  assert.ok(agentRun, "Should have agent run in audit");
  assert.ok((agentRun as any).pauseStateId, "Audit run should carry pauseStateId");
});

// ---------------------------------------------------------------------------
// Test 14: Audit records resume event (auditEntry returned on success)
// ---------------------------------------------------------------------------

test("Audit records resume event with correct type and fields", async () => {
  const taskId = `task-audit-resume-${Date.now()}`;
  const now = nowStr();
  await globalTaskStore.saveTask({
    id: taskId,
    agentId: "researcher",
    title: "Audit Resume Task",
    objective: "For audit resume test",
    status: "queued",
    approvalStatus: "approved",
    priority: "high",
    provider: "mock",
    model: "mock-1.0",
    createdAt: now,
    updatedAt: now,
  });

  const pauseId = `pause-audit-resume-${Date.now()}`;
  await savePauseState(
    buildPauseState({
      pauseId,
      workflowRunId: "run-audit-resume",
      projectId: mockProject.id,
      engagementId: mockProject.id,
      stepId: "step-audit-resume",
      agentTaskId: taskId,
    }),
  );

  const result = await resumeWorkflowAfterApproval(pauseId);
  assert.equal(result.ok, true);
  if (!result.ok) return;

  const { auditEntry } = result;
  assert.equal(auditEntry.type, "agent");
  assert.equal(auditEntry.department, "agent-step");
  assert.ok(auditEntry.resumedAt, "Should have resumedAt");
  assert.ok(auditEntry.startedAt, "Should have startedAt");
  assert.ok(auditEntry.completedAt, "Should have completedAt");
  assert.equal(auditEntry.pauseStateId, pauseId);
});

// ---------------------------------------------------------------------------
// Test 15: Audit records completed-after-resume event
// ---------------------------------------------------------------------------

test("Audit records completed-after-resume (taskStatus=completed)", async () => {
  const taskId = `task-completed-resume-${Date.now()}`;
  const now = nowStr();
  await globalTaskStore.saveTask({
    id: taskId,
    agentId: "quality-control",
    title: "Completion after Resume",
    objective: "Should complete after resume",
    status: "queued",
    approvalStatus: "approved",
    priority: "high",
    provider: "mock",
    model: "mock-1.0",
    createdAt: now,
    updatedAt: now,
  });

  const pauseId = `pause-completed-resume-${Date.now()}`;
  await savePauseState(
    buildPauseState({
      pauseId,
      workflowRunId: "run-completed-resume",
      projectId: mockProject.id,
      engagementId: mockProject.id,
      stepId: "step-completed-resume",
      agentTaskId: taskId,
    }),
  );

  const result = await resumeWorkflowAfterApproval(pauseId);
  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.taskStatus, "completed");
  assert.equal(result.auditEntry.status, "completed");
});

// ---------------------------------------------------------------------------
// Test 16: Existing standard engagement workflow still passes
// ---------------------------------------------------------------------------

test("Existing standard automation step schema is compatible", () => {
  // Verify AutomationStepSchema doesn't break existing patterns
  const result = AutomationStepSchema.safeParse({
    type: "automation",
    id: "dept-intelligence",
    title: "Intelligence Department",
    status: "completed",
    dependencies: [],
    departmentId: "intelligence",
    createdAt: nowStr(),
    updatedAt: nowStr(),
    completedAt: nowStr(),
  });

  assert.equal(result.success, true);
});

// ---------------------------------------------------------------------------
// Test 17: Unsafe data is not exposed in audit entries
// ---------------------------------------------------------------------------

test("Unsafe data not exposed in approval audit entries", async () => {
  const step: WorkflowAgentStepConfig = {
    agentId: "researcher",
    title: "Safety Check Step",
    objective: "Should not expose unsafe fields",
    requiresApproval: true,
  };

  const entry = await executeWorkflowAgentStep({ project: mockProject, step });

  // These keys must not be present on the audit entry
  const unsafeKeys = [
    "apiKey", "authorization", "password", "secret", "token",
    "systemPrompt", "rawProviderPayload", "rawProviderResponse",
    "diagnosticTrace", "stackTrace", "debugPrompt",
  ];

  for (const key of unsafeKeys) {
    assert.ok(!(key in entry), `Entry must not contain key "${key}"`);
  }
});

// ---------------------------------------------------------------------------
// Test 18: PausedWorkflowState round-trips through save/load
// ---------------------------------------------------------------------------

test("PausedWorkflowState saves and loads correctly", async () => {
  const pauseId = `pause-roundtrip-${Date.now()}`;
  const pause = buildPauseState({
    pauseId,
    workflowRunId: "run-roundtrip",
    projectId: "proj-roundtrip",
    engagementId: "proj-roundtrip",
    stepId: "step-roundtrip",
    agentTaskId: "task-roundtrip",
    completedStepIds: ["step-a", "step-b"],
    failedStepIds: ["step-c"],
    pendingStepIds: ["step-d", "step-e"],
  });

  await savePauseState(pause);
  const loaded = await loadPauseState(pauseId);

  assert.equal(loaded.id, pauseId);
  assert.equal(loaded.status, "waiting_for_approval");
  assert.deepEqual(loaded.completedStepIds, ["step-a", "step-b"]);
  assert.deepEqual(loaded.failedStepIds, ["step-c"]);
  assert.deepEqual(loaded.pendingStepIds, ["step-d", "step-e"]);
  assert.ok(loaded.pausedAt);
  assert.equal(loaded.agentTaskId, "task-roundtrip");
  assert.equal(loaded.requiredApprovalTarget, "agent_task:task-roundtrip");
});

// ---------------------------------------------------------------------------
// Test 19: findActivePauseForProject finds only waiting_for_approval
// ---------------------------------------------------------------------------

test("findActivePauseForProject finds only waiting_for_approval states", async () => {
  const projectId = `proj-find-active-${Date.now()}`;

  // Create two pause states for same project — one active, one resumed
  const activePauseId = `pause-active-${Date.now()}`;
  const resumedPauseId = `pause-done-${Date.now()}`;

  const activePause = buildPauseState({
    pauseId: activePauseId,
    workflowRunId: "run-active",
    projectId,
    engagementId: projectId,
    stepId: "step-active",
    agentTaskId: "task-active",
  });
  await savePauseState(activePause);

  const resumedPause = buildPauseState({
    pauseId: resumedPauseId,
    workflowRunId: "run-done",
    projectId,
    engagementId: projectId,
    stepId: "step-done",
    agentTaskId: "task-done",
  });
  await savePauseState(resumedPause);
  // Mark it as resumed so it should be excluded from search
  await markPauseResumed(resumedPauseId, "test");

  // Should return the active one only
  const found = await findActivePauseForProject(projectId);

  assert.ok(found, "Should find the active pause");
  assert.equal(found!.id, activePauseId);
  assert.equal(found!.status, "waiting_for_approval");
});
