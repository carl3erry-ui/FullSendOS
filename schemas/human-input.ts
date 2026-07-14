import { z } from "zod";

export const HumanInputRequestTypeSchema = z.enum([
  "missing_information",
  "confirm_inferred_fact",
  "approval",
  "clarification",
  "choose_option",
  "upload_required",
  "review_recommendation",
  "continue_with_assumption",
]);

export const HumanInputRequestStatusSchema = z.enum([
  "open",
  "answered",
  "confirmed",
  "rejected",
  "skipped",
  "cancelled",
]);

export const HumanInputRequestPrioritySchema = z.enum(["low", "medium", "high", "critical"]);

export const HumanInputRequestOptionSchema = z.object({
  value: z.string().min(1),
  label: z.string().min(1),
  description: z.string().optional(),
});

export const HumanInputEvidenceSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  confidence: z.number().min(0).max(1).optional(),
  source: z.string().min(1).optional(),
  sourceUrl: z.string().url().optional(),
  sourceType: z.string().min(1).optional(),
});

export const HumanInputSourceReferenceSchema = z.object({
  sourceId: z.string().min(1),
  title: z.string().min(1),
  sourceType: z.string().min(1).optional(),
  sourceUrl: z.string().url().optional(),
  label: z.string().min(1).optional(),
});

export const HumanInputRequestSchema = z.object({
  id: z.string().min(1),
  clientId: z.string().min(1).optional(),
  engagementId: z.string().min(1).optional(),
  workflowRunId: z.string().min(1).optional(),
  agentTaskId: z.string().min(1).optional(),
  type: HumanInputRequestTypeSchema,
  title: z.string().min(1),
  prompt: z.string().min(1),
  status: HumanInputRequestStatusSchema,
  priority: HumanInputRequestPrioritySchema,
  requestedBy: z.string().min(1),
  requestedAt: z.string().min(1),
  resolvedAt: z.string().min(1).optional(),
  resolvedBy: z.string().min(1).optional(),
  response: z.string().optional(),
  options: z.array(HumanInputRequestOptionSchema).default([]),
  relatedField: z.string().min(1).optional(),
  inferredValue: z.unknown().optional(),
  confidence: z.number().min(0).max(1).optional(),
  evidence: z.array(HumanInputEvidenceSchema).default([]),
  sourceReferences: z.array(HumanInputSourceReferenceSchema).default([]),
  requiredToContinue: z.boolean().default(false),
  resumeAction: z.string().optional(),
  metadata: z.record(z.unknown()).default({}),
});

export type HumanInputRequestType = z.infer<typeof HumanInputRequestTypeSchema>;
export type HumanInputRequestStatus = z.infer<typeof HumanInputRequestStatusSchema>;
export type HumanInputRequestPriority = z.infer<typeof HumanInputRequestPrioritySchema>;
export type HumanInputRequestOption = z.infer<typeof HumanInputRequestOptionSchema>;
export type HumanInputEvidence = z.infer<typeof HumanInputEvidenceSchema>;
export type HumanInputSourceReference = z.infer<typeof HumanInputSourceReferenceSchema>;
export type HumanInputRequest = z.infer<typeof HumanInputRequestSchema>;

export const HumanInputRequestCreateSchema = HumanInputRequestSchema.omit({
  id: true,
  status: true,
  requestedAt: true,
  resolvedAt: true,
  resolvedBy: true,
  response: true,
}).extend({
  requestedBy: z.string().min(1).default("system"),
  priority: HumanInputRequestPrioritySchema.default("medium"),
  options: z.array(HumanInputRequestOptionSchema).default([]),
  evidence: z.array(HumanInputEvidenceSchema).default([]),
  sourceReferences: z.array(HumanInputSourceReferenceSchema).default([]),
  requiredToContinue: z.boolean().default(false),
  metadata: z.record(z.unknown()).default({}),
});

export type HumanInputRequestCreate = z.infer<typeof HumanInputRequestCreateSchema>;

export const HumanInputRequestUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  prompt: z.string().min(1).optional(),
  status: HumanInputRequestStatusSchema.optional(),
  priority: HumanInputRequestPrioritySchema.optional(),
  response: z.string().optional(),
  options: z.array(HumanInputRequestOptionSchema).optional(),
  relatedField: z.string().min(1).optional(),
  inferredValue: z.unknown().optional(),
  confidence: z.number().min(0).max(1).optional(),
  evidence: z.array(HumanInputEvidenceSchema).optional(),
  sourceReferences: z.array(HumanInputSourceReferenceSchema).optional(),
  requiredToContinue: z.boolean().optional(),
  resumeAction: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  resolvedBy: z.string().min(1).optional(),
});

export type HumanInputRequestUpdate = z.infer<typeof HumanInputRequestUpdateSchema>;
