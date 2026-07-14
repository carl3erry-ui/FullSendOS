import { z } from "zod";

export const WorkProductVerifiedStatusSchema = z.enum([
  "user_provided",
  "human_confirmed",
  "retrieved_from_data_room",
  "agent_inferred",
  "unverified",
  "assumption",
  "open_question",
]);

export const WorkProductEvidenceSourceTypeSchema = z.enum([
  "client_brief",
  "human_input",
  "data_room_document",
  "agent_task",
  "department_output",
  "workflow_audit",
]);

export const EvidenceReferenceSchema = z.object({
  id: z.string().min(1),
  sourceType: WorkProductEvidenceSourceTypeSchema,
  citationLabel: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  fileId: z.string().min(1).optional(),
  documentId: z.string().min(1).optional(),
  agentTaskId: z.string().min(1).optional(),
  humanInputRequestId: z.string().min(1).optional(),
  departmentId: z.string().min(1).optional(),
  excerptPreview: z.string().min(1).optional(),
  confidence: z.number().min(0).max(1).optional(),
  verifiedStatus: WorkProductVerifiedStatusSchema,
  createdAt: z.string().min(1),
});

export const WorkProductAssumptionSchema = z.object({
  id: z.string().min(1),
  statement: z.string().min(1),
  departmentId: z.string().min(1).optional(),
  confidence: z.number().min(0).max(1).optional(),
  evidenceReferenceIds: z.array(z.string()).default([]),
});

export const WorkProductOpenQuestionSchema = z.object({
  id: z.string().min(1),
  question: z.string().min(1),
  whyItMatters: z.string().optional(),
  recommendedMethod: z.string().optional(),
  relatedField: z.string().optional(),
  humanInputRequestId: z.string().optional(),
  departmentId: z.string().optional(),
  verifiedStatus: WorkProductVerifiedStatusSchema.default("open_question"),
});

export const WorkProductConfidenceSummarySchema = z.object({
  level: z.enum(["high", "medium", "low", "pending"]),
  score: z.number().min(0).max(1).nullable(),
  rationale: z.string().min(1),
});

export const WorkProductSourceCoverageSchema = z.object({
  dataRoomDocuments: z.number().int().nonnegative(),
  humanConfirmations: z.number().int().nonnegative(),
  clientProvidedAnchors: z.number().int().nonnegative(),
  agentEvidence: z.number().int().nonnegative(),
  openQuestions: z.number().int().nonnegative(),
});

export const WorkProductEvidenceSummarySchema = z.object({
  evidenceUsed: z.array(EvidenceReferenceSchema).default([]),
  assumptions: z.array(WorkProductAssumptionSchema).default([]),
  openQuestions: z.array(WorkProductOpenQuestionSchema).default([]),
  humanConfirmations: z.array(EvidenceReferenceSchema).default([]),
  sourceCoverage: WorkProductSourceCoverageSchema,
  confidenceSummary: WorkProductConfidenceSummarySchema,
  missingEvidence: z.array(z.string()).default([]),
  recommendedNextActions: z.array(z.string()).default([]),
});

export type WorkProductVerifiedStatus = z.infer<typeof WorkProductVerifiedStatusSchema>;
export type WorkProductEvidenceSourceType = z.infer<typeof WorkProductEvidenceSourceTypeSchema>;
export type EvidenceReference = z.infer<typeof EvidenceReferenceSchema>;
export type WorkProductAssumption = z.infer<typeof WorkProductAssumptionSchema>;
export type WorkProductOpenQuestion = z.infer<typeof WorkProductOpenQuestionSchema>;
export type WorkProductConfidenceSummary = z.infer<typeof WorkProductConfidenceSummarySchema>;
export type WorkProductSourceCoverage = z.infer<typeof WorkProductSourceCoverageSchema>;
export type WorkProductEvidenceSummary = z.infer<typeof WorkProductEvidenceSummarySchema>;
