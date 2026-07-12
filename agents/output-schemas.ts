import { z } from "zod";

// ---------------------------------------------------------------------------
// Orchestrator output
// ---------------------------------------------------------------------------

export const OrchestratorTaskSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  objective: z.string().min(1),
  recommendedAgentId: z.string().min(1),
  department: z.string().min(1),
  priority: z.enum(["low", "medium", "high", "critical"]),
  dependencies: z.array(z.string()),
  requiresApproval: z.boolean(),
  expectedOutput: z.string().min(1),
});

export const OrchestratorOutputSchema = z.object({
  summary: z.string().min(1),
  assumptions: z.array(z.string()),
  tasks: z.array(OrchestratorTaskSchema),
  dependencies: z.array(z.string()),
  risks: z.array(z.string()),
  approvalGates: z.array(z.string()),
  successCriteria: z.array(z.string()),
  recommendedNextAction: z.string().min(1),
});

// ---------------------------------------------------------------------------
// Research output
// ---------------------------------------------------------------------------

export const ResearchFindingSchema = z.object({
  topic: z.string().min(1),
  summary: z.string().min(1),
  confidence: z.number().min(0).max(1),
  sources: z.array(z.string()),
});

export const ResearchEvidenceItemSchema = z.object({
  type: z.enum(["internal", "web", "document", "analysis", "external"]),
  title: z.string().min(1),
  content: z.string().min(1),
  source: z.string().min(1),
  sourceUrl: z.string().url().optional(),
  confidence: z.number().min(0).max(1),
  retrievedAt: z.string(),
});

export const ResearchOutputSchema = z.object({
  executiveSummary: z.string().min(1),
  researchQuestions: z.array(z.string()),
  findings: z.array(ResearchFindingSchema),
  evidence: z.array(ResearchEvidenceItemSchema),
  assumptions: z.array(z.string()),
  gaps: z.array(z.string()),
  risks: z.array(z.string()),
  recommendations: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});

// ---------------------------------------------------------------------------
// Quality control output
// ---------------------------------------------------------------------------

export const QCVerdictSchema = z.enum([
  "approved",
  "approved_with_notes",
  "revision_required",
  "rejected",
]);

export const QCCheckSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  passed: z.boolean(),
  notes: z.string().optional(),
});

export const QualityControlOutputSchema = z.object({
  verdict: QCVerdictSchema,
  score: z.number().min(0).max(100),
  summary: z.string().min(1),
  passedChecks: z.array(QCCheckSchema),
  failedChecks: z.array(QCCheckSchema),
  unsupportedClaims: z.array(z.string()),
  missingInformation: z.array(z.string()),
  requiredRevisions: z.array(z.string()),
  approvalRecommendation: z.string().min(1),
});

// ---------------------------------------------------------------------------
// TypeScript types
// ---------------------------------------------------------------------------

export type OrchestratorTask = z.infer<typeof OrchestratorTaskSchema>;
export type OrchestratorOutput = z.infer<typeof OrchestratorOutputSchema>;
export type ResearchFinding = z.infer<typeof ResearchFindingSchema>;
export type ResearchEvidenceItem = z.infer<typeof ResearchEvidenceItemSchema>;
export type ResearchOutput = z.infer<typeof ResearchOutputSchema>;
export type QCVerdict = z.infer<typeof QCVerdictSchema>;
export type QCCheck = z.infer<typeof QCCheckSchema>;
export type QualityControlOutput = z.infer<typeof QualityControlOutputSchema>;
