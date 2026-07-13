/**
 * Formal Workflow Step Schema (Slice 7)
 *
 * Defines the three formal workflow step types:
 *   - automation  : deterministic code (existing departments)
 *   - agent       : AI agent task execution with optional approval gate
 *   - human_approval : explicit human decision point
 *
 * These types share a common base and extend it with type-specific fields.
 * The schema is designed to be additive — existing workflows are unaffected.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Shared base
// ---------------------------------------------------------------------------

export const WorkflowStepStatusSchema = z.enum([
  "pending",
  "running",
  "completed",
  "failed",
  "waiting_for_approval",
  "skipped",
]);
export type WorkflowStepStatus = z.infer<typeof WorkflowStepStatusSchema>;

const BaseWorkflowStepSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  status: WorkflowStepStatusSchema,
  dependencies: z.array(z.string()).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
});

// ---------------------------------------------------------------------------
// Automation step — deterministic code, no agent, no approval
// ---------------------------------------------------------------------------

export const AutomationStepSchema = BaseWorkflowStepSchema.extend({
  type: z.literal("automation"),
  departmentId: z.string().optional(),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
  error: z.string().optional(),
});
export type AutomationStep = z.infer<typeof AutomationStepSchema>;

// ---------------------------------------------------------------------------
// Agent step — AI agent task execution with optional approval gate
// ---------------------------------------------------------------------------

export const ApprovalModeSchema = z.enum([
  "pre_execution",  // pause before running the agent
  "post_execution", // pause after running, requires sign-off on output
]);
export type ApprovalMode = z.infer<typeof ApprovalModeSchema>;

export const AgentStepSchema = BaseWorkflowStepSchema.extend({
  type: z.literal("agent"),
  agentId: z.string().min(1),
  taskId: z.string().optional(),
  provider: z.string().optional(),
  model: z.string().optional(),
  inputMapping: z.record(z.unknown()).optional(),
  outputMapping: z.record(z.unknown()).optional(),
  requiresApproval: z.boolean().default(false),
  approvalMode: ApprovalModeSchema.default("pre_execution"),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
  error: z.string().optional(),
});
export type AgentStep = z.infer<typeof AgentStepSchema>;

// ---------------------------------------------------------------------------
// Human approval step — explicit human decision gate
// ---------------------------------------------------------------------------

export const ApprovalDecisionSchema = z.enum([
  "approved",
  "rejected",
  "revision_requested",
]);
export type ApprovalDecision = z.infer<typeof ApprovalDecisionSchema>;

export const HumanApprovalStepSchema = BaseWorkflowStepSchema.extend({
  type: z.literal("human_approval"),
  approvalGateId: z.string().optional(),
  linkedTaskId: z.string().optional(),
  reason: z.string().min(1),
  requestedBy: z.string().optional(),
  reviewedBy: z.string().optional(),
  reviewerNotes: z.string().optional(),
  decision: ApprovalDecisionSchema.optional(),
  decidedAt: z.string().optional(),
});
export type HumanApprovalStep = z.infer<typeof HumanApprovalStepSchema>;

// ---------------------------------------------------------------------------
// Union — a step is one of the three types
// ---------------------------------------------------------------------------

export const WorkflowStepSchema = z.discriminatedUnion("type", [
  AutomationStepSchema,
  AgentStepSchema,
  HumanApprovalStepSchema,
]);
export type WorkflowStep = z.infer<typeof WorkflowStepSchema>;

// ---------------------------------------------------------------------------
// Paused workflow state — persisted when a step requires approval
// ---------------------------------------------------------------------------

export const PausedWorkflowStateSchema = z.object({
  id: z.string().min(1),             // unique pause record ID
  workflowRunId: z.string().min(1),
  projectId: z.string().min(1),
  engagementId: z.string().min(1),
  currentStepId: z.string().min(1),  // step waiting for approval
  pausedAt: z.string(),
  pauseReason: z.string(),
  agentTaskId: z.string().optional(),// the task pending approval (if agent step)
  requiredApprovalTarget: z.string(),// "agent_task:{taskId}" or "human:{gateId}"
  status: z.enum(["waiting_for_approval", "resumed", "expired", "cancelled"]),
  completedStepIds: z.array(z.string()),
  failedStepIds: z.array(z.string()),
  pendingStepIds: z.array(z.string()),
  resumedAt: z.string().optional(),
  resumedBy: z.string().optional(),
  cancelledAt: z.string().optional(),
  cancelReason: z.string().optional(),
});
export type PausedWorkflowState = z.infer<typeof PausedWorkflowStateSchema>;

// ---------------------------------------------------------------------------
// Audit event types for pause/resume lifecycle
// ---------------------------------------------------------------------------

export const WorkflowPauseEventSchema = z.object({
  type: z.literal("workflow_paused"),
  workflowRunId: z.string(),
  pauseStateId: z.string(),
  pausedAt: z.string(),
  reason: z.string(),
  agentTaskId: z.string().optional(),
  stepId: z.string(),
});
export type WorkflowPauseEvent = z.infer<typeof WorkflowPauseEventSchema>;

export const WorkflowResumeEventSchema = z.object({
  type: z.literal("workflow_resumed"),
  workflowRunId: z.string(),
  pauseStateId: z.string(),
  resumedAt: z.string(),
  resumedBy: z.string().optional(),
  agentTaskId: z.string().optional(),
  stepId: z.string(),
});
export type WorkflowResumeEvent = z.infer<typeof WorkflowResumeEventSchema>;

export const WorkflowStepCompletedEventSchema = z.object({
  type: z.literal("workflow_step_completed"),
  workflowRunId: z.string(),
  stepId: z.string(),
  stepType: z.enum(["automation", "agent", "human_approval"]),
  completedAt: z.string(),
  agentTaskId: z.string().optional(),
});
export type WorkflowStepCompletedEvent = z.infer<typeof WorkflowStepCompletedEventSchema>;
