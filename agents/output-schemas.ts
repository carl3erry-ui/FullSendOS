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
// Department workforce schemas (Slice 11)
// ---------------------------------------------------------------------------

const ConfidenceSchema = z.number().min(0).max(1);

export const ExecutiveOrchestratorOutputSchema = z.object({
  executiveSummary: z.string().min(1),
  recommendedWorkplan: z.array(z.string()),
  departmentAssignments: z.array(
    z.object({
      department: z.string().min(1),
      agentId: z.string().min(1),
      objective: z.string().min(1),
    }),
  ),
  criticalRisks: z.array(z.string()),
  decisionPoints: z.array(z.string()),
  approvalRequired: z.boolean(),
  nextActions: z.array(z.string()),
});

export const ProjectManagerOutputSchema = z.object({
  projectPlan: z.array(z.string()),
  milestones: z.array(z.string()),
  owners: z.array(z.object({ role: z.string().min(1), owner: z.string().min(1) })),
  dependencies: z.array(z.string()),
  blockers: z.array(z.string()),
  timelineRisks: z.array(z.string()),
  nextActions: z.array(z.string()),
});

export const DepartmentResearchOutputSchema = z.object({
  findings: z.array(z.string()),
  sources: z.array(z.string()),
  unknowns: z.array(z.string()),
  confidence: ConfidenceSchema,
  assumptions: z.array(z.string()),
  recommendedFollowups: z.array(z.string()),
});

export const MarketResearchOutputSchema = z.object({
  marketDefinition: z.string().min(1),
  targetSegments: z.array(z.string()),
  competitors: z.array(z.string()),
  demandSignals: z.array(z.string()),
  localMarketFactors: z.array(z.string()),
  opportunities: z.array(z.string()),
  risks: z.array(z.string()),
  confidence: ConfidenceSchema,
});

export const FinanceOutputSchema = z.object({
  financialSummary: z.string().min(1),
  assumptions: z.array(z.string()),
  revenueDrivers: z.array(z.string()),
  costDrivers: z.array(z.string()),
  cashFlowConsiderations: z.array(z.string()),
  valuationConsiderations: z.array(z.string()),
  risks: z.array(z.string()),
  openQuestions: z.array(z.string()),
  disclaimers: z
    .array(z.string())
    .default([
      "This output is analytical support only and not certified accounting advice.",
    ]),
});

export const StrategyOutputSchema = z.object({
  strategicOptions: z.array(z.string()),
  recommendation: z.string().min(1),
  rationale: z.array(z.string()),
  tradeoffs: z.array(z.string()),
  risks: z.array(z.string()),
  milestones: z.array(z.string()),
  decisionRequired: z.array(z.string()),
});

export const BrandStrategyOutputSchema = z.object({
  brandPositioning: z.string().min(1),
  audience: z.array(z.string()),
  messaging: z.array(z.string()),
  voice: z.array(z.string()),
  differentiation: z.array(z.string()),
  brandRisks: z.array(z.string()),
  recommendations: z.array(z.string()),
});

export const CreativeDirectorOutputSchema = z.object({
  creativeDirection: z.string().min(1),
  visualConcepts: z.array(z.string()),
  campaignIdeas: z.array(z.string()),
  assetNeeds: z.array(z.string()),
  brandConsistencyNotes: z.array(z.string()),
  risks: z.array(z.string()),
});

export const WebsiteDigitalOutputSchema = z.object({
  websiteAssessment: z.array(z.string()),
  userJourney: z.array(z.string()),
  conversionOpportunities: z.array(z.string()),
  contentNeeds: z.array(z.string()),
  seoConsiderations: z.array(z.string()),
  technicalRisks: z.array(z.string()),
});

export const OperationsOutputSchema = z.object({
  operationalAssessment: z.array(z.string()),
  processGaps: z.array(z.string()),
  staffingConsiderations: z.array(z.string()),
  vendorConsiderations: z.array(z.string()),
  implementationPlan: z.array(z.string()),
  risks: z.array(z.string()),
});

export const LegalReviewOutputSchema = z.object({
  legalIssueSpotting: z.array(z.string()),
  complianceRisks: z.array(z.string()),
  contractConsiderations: z.array(z.string()),
  licensingConsiderations: z.array(z.string()),
  requiredAttorneyReview: z.array(z.string()),
  disclaimers: z
    .array(z.string())
    .default([
      "This output identifies issues for attorney review and is not legal advice.",
    ]),
});

export const SalesRevenueOutputSchema = z.object({
  revenueOpportunities: z.array(z.string()),
  salesChannels: z.array(z.string()),
  pricingConsiderations: z.array(z.string()),
  pipelineIdeas: z.array(z.string()),
  accountTargets: z.array(z.string()),
  risks: z.array(z.string()),
});

export const InvestorRelationsOutputSchema = z.object({
  investorNarrative: z.array(z.string()),
  keyMetrics: z.array(z.string()),
  diligenceNeeds: z.array(z.string()),
  riskDisclosures: z.array(z.string()),
  fundraisingMaterialsNeeded: z.array(z.string()),
  nextActions: z.array(z.string()),
});

export const WorkforceQualityControlOutputSchema = z.object({
  verdict: z.enum(["approved", "approved_with_notes", "revision_required", "rejected"]),
  issues: z.array(z.string()),
  missingEvidence: z.array(z.string()),
  inconsistencies: z.array(z.string()),
  recommendedFixes: z.array(z.string()),
  confidence: ConfidenceSchema,
});

export const ExecutiveReviewOutputSchema = z.object({
  finalRecommendation: z.string().min(1),
  decisionSummary: z.array(z.string()),
  confidence: ConfidenceSchema,
  unresolvedQuestions: z.array(z.string()),
  approvalRecommendation: z.string().min(1),
  nextActions: z.array(z.string()),
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
export type ExecutiveOrchestratorOutput = z.infer<typeof ExecutiveOrchestratorOutputSchema>;
export type ProjectManagerOutput = z.infer<typeof ProjectManagerOutputSchema>;
export type DepartmentResearchOutput = z.infer<typeof DepartmentResearchOutputSchema>;
export type MarketResearchOutput = z.infer<typeof MarketResearchOutputSchema>;
export type FinanceOutput = z.infer<typeof FinanceOutputSchema>;
export type StrategyWorkforceOutput = z.infer<typeof StrategyOutputSchema>;
export type BrandStrategyOutput = z.infer<typeof BrandStrategyOutputSchema>;
export type CreativeDirectorOutput = z.infer<typeof CreativeDirectorOutputSchema>;
export type WebsiteDigitalOutput = z.infer<typeof WebsiteDigitalOutputSchema>;
export type OperationsOutput = z.infer<typeof OperationsOutputSchema>;
export type LegalReviewOutput = z.infer<typeof LegalReviewOutputSchema>;
export type SalesRevenueOutput = z.infer<typeof SalesRevenueOutputSchema>;
export type InvestorRelationsOutput = z.infer<typeof InvestorRelationsOutputSchema>;
export type WorkforceQualityControlOutput = z.infer<typeof WorkforceQualityControlOutputSchema>;
export type ExecutiveReviewOutput = z.infer<typeof ExecutiveReviewOutputSchema>;
