import { z } from "zod";
import type { ZodType } from "zod";

// ---------------------------------------------------------------------------
// Status enums
// ---------------------------------------------------------------------------

export const AgentTaskStatusSchema = z.enum([
  "queued",
  "running",
  "waiting_for_approval",
  "completed",
  "failed",
  "cancelled",
]);

export const ExecutionStatusSchema = z.enum([
  "pending",
  "running",
  "completed",
  "failed",
  "timed_out",
]);

export const ApprovalStatusSchema = z.enum([
  "not_required",
  "pending",
  "approved",
  "rejected",
  "revision_requested",
]);

export const ProviderNameSchema = z.enum(["xai", "mock"]);
export const AgentRiskLevelSchema = z.enum(["low", "medium", "high", "critical"]);

export const AgentInputContractSchema = z.object({
  description: z.string().min(1),
  requiredFields: z.array(z.string()).default([]),
  optionalFields: z.array(z.string()).default([]),
});

export const AgentOutputContractSchema = z.object({
  description: z.string().min(1),
  schemaName: z.string().min(1),
  safeFields: z.array(z.string()).default([]),
});

export const AgentApprovalRequirementsSchema = z.object({
  required: z.boolean(),
  reason: z.string().min(1),
  mode: z.enum(["none", "pre_execution", "post_execution"]).default("none"),
});

// ---------------------------------------------------------------------------
// Evidence
// ---------------------------------------------------------------------------

export const AgentEvidenceSchema = z.object({
  type: z.enum(["internal", "web", "document", "analysis", "external"]),
  title: z.string().min(1),
  content: z.string().min(1),
  source: z.string().min(1),
  sourceUrl: z.string().url().optional(), // not required for internal evidence
  confidence: z.number().min(0).max(1),
  retrievedAt: z.string(),
});

// ---------------------------------------------------------------------------
// Shared usage schema
// ---------------------------------------------------------------------------

export const AgentUsageSchema = z.object({
  inputTokens: z.number().optional(),
  outputTokens: z.number().optional(),
  totalTokens: z.number().optional(),
});

// ---------------------------------------------------------------------------
// AgentDefinition
// outputSchema is a runtime ZodType reference and cannot itself be
// validated by Zod, so it is modelled as an extension of the inferred type.
// ---------------------------------------------------------------------------

export const AgentDefinitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  department: z.string().min(1),
  description: z.string(),
  role: z.string().min(1),
  roleSummary: z.string().min(1),
  version: z.string().min(1),
  capabilities: z.array(z.string()),
  allowedTools: z.array(z.string()).optional(),
  permissions: z.array(z.string()).default([]),
  defaultProvider: ProviderNameSchema,
  allowedProviders: z.array(ProviderNameSchema).default(["xai", "mock"]),
  defaultModel: z.string().min(1),
  systemPrompt: z.string(),
  requiresApproval: z.boolean(),
  approvalRequirements: AgentApprovalRequirementsSchema,
  riskLevel: AgentRiskLevelSchema,
  inputContract: AgentInputContractSchema,
  outputContract: AgentOutputContractSchema,
  typicalTasks: z.array(z.string()).default([]),
  workflowStepMapping: z.array(z.string()).default([]),
  supportsDataRoomMetadata: z.boolean().default(false),
  requiresHumanReview: z.boolean().default(false),
  maximumIterations: z.number().int().positive(),
  timeoutMs: z.number().int().positive(),
  enabled: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type AgentDefinition = z.infer<typeof AgentDefinitionSchema> & {
  outputSchema?: ZodType<unknown>;
};

// ---------------------------------------------------------------------------
// AgentTask (schema only — persistence not implemented in this slice)
// ---------------------------------------------------------------------------

export const AgentTaskSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().nullable().optional(),
  engagementId: z.string().nullable().optional(),
  workflowRunId: z.string().nullable().optional(),
  departmentId: z.string().nullable().optional(),
  agentId: z.string().min(1),
  title: z.string().min(1),
  objective: z.string().min(1),
  instructions: z.string().optional(),
  input: z.record(z.unknown()).optional(),
  context: z.record(z.unknown()).optional(),
  status: AgentTaskStatusSchema,
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  provider: ProviderNameSchema,
  model: z.string().min(1),
  requestedBy: z.string().optional(),
  assignedAt: z.string().optional(),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
  failedAt: z.string().optional(),
  approvalStatus: ApprovalStatusSchema,
  output: z.string().optional(),
  structuredOutput: z.record(z.unknown()).optional(),
  evidence: z.array(AgentEvidenceSchema).optional(),
  sources: z.array(z.string()).optional(),
  error: z.string().optional(),
  usage: AgentUsageSchema.optional(),
  cost: z.number().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

// ---------------------------------------------------------------------------
// AgentExecution (schema only)
// ---------------------------------------------------------------------------

export const AgentExecutionSchema = z.object({
  id: z.string().min(1),
  agentTaskId: z.string().min(1),
  agentId: z.string().min(1),
  provider: ProviderNameSchema,
  model: z.string().min(1),
  status: ExecutionStatusSchema,
  attempt: z.number().int().min(1),
  inputSnapshot: z.record(z.unknown()).optional(),
  systemPromptSnapshot: z.string().optional(),
  toolPermissionsSnapshot: z.array(z.string()).optional(),
  rawResponse: z.string().optional(),
  parsedResponse: z.record(z.unknown()).optional(),
  validationResult: z
    .object({
      valid: z.boolean(),
      errors: z.array(z.string()),
    })
    .optional(),
  usage: AgentUsageSchema.optional(),
  estimatedCost: z.number().nullable().optional(),
  error: z.string().optional(),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
});

// ---------------------------------------------------------------------------
// ApprovalGate (schema only)
// ---------------------------------------------------------------------------

export const ApprovalGateSchema = z.object({
  id: z.string().min(1),
  agentTaskId: z.string().min(1),
  actionType: z.string().min(1),
  reason: z.string().min(1),
  requestedBy: z.string(),
  requestedAt: z.string(),
  status: ApprovalStatusSchema,
  reviewedBy: z.string().optional(),
  reviewedAt: z.string().optional(),
  reviewerNotes: z.string().optional(),
});

// ---------------------------------------------------------------------------
// TypeScript types
// ---------------------------------------------------------------------------

export type AgentTaskStatus = z.infer<typeof AgentTaskStatusSchema>;
export type ExecutionStatus = z.infer<typeof ExecutionStatusSchema>;
export type ApprovalStatus = z.infer<typeof ApprovalStatusSchema>;
export type ProviderName = z.infer<typeof ProviderNameSchema>;
export type AgentRiskLevel = z.infer<typeof AgentRiskLevelSchema>;
export type AgentEvidence = z.infer<typeof AgentEvidenceSchema>;
export type AgentTask = z.infer<typeof AgentTaskSchema>;
export type AgentExecution = z.infer<typeof AgentExecutionSchema>;
export type ApprovalGate = z.infer<typeof ApprovalGateSchema>;
