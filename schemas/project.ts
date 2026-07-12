import { z } from "zod";

export const ProjectStatusSchema = z.enum([
  "draft",
  "in-progress",
  "needs-review",
  "completed",
  "failed",
]);

export const WorkflowStageSchema = z.enum([
  "intelligence",
  "strategy",
  "creative",
  "publishing",
]);

export const WorkflowStepStatusSchema = z.enum(["pending", "running", "completed", "failed", "skipped"]);

export const WorkflowStepSchema = z.object({
  id: WorkflowStageSchema,
  label: z.string().min(1),
  status: WorkflowStepStatusSchema,
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
  error: z.string().optional(),
});

export const WorkflowStateSchema = z.object({
  initializedAt: z.string(),
  currentStageId: WorkflowStageSchema.optional(),
  stages: z.array(WorkflowStepSchema).length(4),
  stageResults: z.record(
    z.string(),
    z.unknown(),
  ).refine(
    (value) => Object.keys(value).every((key) => WorkflowStageSchema.options.includes(key as typeof WorkflowStageSchema.options[number])),
    { message: "stageResults keys must be valid workflow stage ids" },
  ),
});

export const ProjectSourceSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  url: z.string().url().optional(),
  type: z.enum(["web", "client-note", "analysis", "generated"]),
  capturedAt: z.string(),
});

export const EvidenceItemSchema = z.object({
  id: z.string().min(1),
  claim: z.string().min(1),
  confidence: z.enum(["low", "medium", "high"]),
  sourceIds: z.array(z.string().min(1)),
  notes: z.string().optional(),
});

export const EvidenceBundleSchema = z.object({
  sources: z.array(ProjectSourceSchema),
  items: z.array(EvidenceItemSchema),
});

export const DepartmentResultSchema = z.object({
  status: WorkflowStepStatusSchema,
  summary: z.string().optional(),
  outputs: z.record(z.string(), z.unknown()),
  unknowns: z.array(z.string()),
  warnings: z.array(z.string()),
  completedAt: z.string().optional(),
});

export const DeliverableSetSchema = z.object({
  executiveReport: z.string().optional(),
  onePageSummary: z.string().optional(),
  deckOutline: z.array(z.string()).optional(),
  websiteDraft: z.string().optional(),
  assets: z.record(z.string(), z.string()),
});

export const ProjectClientSchema = z.object({
  companyName: z.string().min(1),
  contactName: z.string().optional(),
  website: z.string().url().optional(),
  industry: z.string().optional(),
});

export const ProjectObjectiveSchema = z.object({
  summary: z.string().min(1),
  constraints: z.array(z.string()),
  requestedDeliverables: z.array(z.string()),
});

export const ProjectSchema = z.object({
  id: z.string().min(1),
  client: ProjectClientSchema,
  objective: ProjectObjectiveSchema,
  status: ProjectStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  workflow: WorkflowStateSchema,
  deliverables: DeliverableSetSchema,
  evidence: EvidenceBundleSchema,
  departments: z.object({
    intelligence: DepartmentResultSchema,
    strategy: DepartmentResultSchema,
    creative: DepartmentResultSchema,
    publishing: DepartmentResultSchema,
  }),
});

export type ProjectInput = z.infer<typeof ProjectSchema>;
