import type { ZodType } from "zod";
import type { AIProvider, AIProviderRequest, NormalizedAIResponse } from "./provider";

// ---------------------------------------------------------------------------
// Mock outputs — meaningful, schema-conformant, not lorem ipsum.
// ---------------------------------------------------------------------------

const MOCK_ORCHESTRATOR_OUTPUT = {
  summary:
    "Strategic engagement plan developed. Market research and competitive analysis are recommended first priorities before strategy and brand work.",
  assumptions: [
    "Client has defined target market segments",
    "Budget allocation is approved for full engagement scope",
    "Key stakeholders are available for milestone review sessions",
  ],
  tasks: [
    {
      id: "task-research-001",
      title: "Market and Competitive Research",
      objective:
        "Identify primary market segments, key competitors, and positioning opportunities",
      recommendedAgentId: "researcher",
      department: "research",
      priority: "high",
      dependencies: [],
      requiresApproval: false,
      expectedOutput:
        "Market segmentation analysis with competitive landscape and positioning gaps",
    },
    {
      id: "task-qc-001",
      title: "Research Quality Review",
      objective:
        "Validate research findings and identify unsupported claims before strategy development",
      recommendedAgentId: "quality-control",
      department: "research",
      priority: "medium",
      dependencies: ["task-research-001"],
      requiresApproval: false,
      expectedOutput:
        "Quality assessment with confidence scores and required revisions",
    },
  ],
  dependencies: [],
  risks: [
    "Market data may be incomplete without live research tools",
    "Assumptions may require client validation before proceeding",
  ],
  approvalGates: [],
  successCriteria: [
    "All research questions answered with confidence above 70%",
    "Competitive positioning clearly defined",
    "Actionable recommendations delivered within engagement timeline",
  ],
  recommendedNextAction: "Begin market research phase with researcher agent",
};

const MOCK_RESEARCH_OUTPUT = {
  executiveSummary:
    "Research conducted based on provided engagement context and general domain knowledge. Note: No live research tools are available in mock mode — findings represent structured analysis rather than verified market data.",
  researchQuestions: [
    "What are the primary market segments for this engagement?",
    "Who are the key competitors and what differentiates them?",
    "What is the current market sizing and growth trajectory?",
  ],
  findings: [
    {
      topic: "Market Positioning",
      summary:
        "Based on provided context, the client occupies a mid-market position with opportunity to differentiate on service quality and specialized expertise.",
      confidence: 0.65,
      sources: ["engagement-context", "general-domain-knowledge"],
    },
    {
      topic: "Competitive Landscape",
      summary:
        "Established players dominate the high-end segment. The mid-market shows fragmentation, presenting an opportunity for a focused entrant with consistent delivery.",
      confidence: 0.6,
      sources: ["engagement-context"],
    },
  ],
  evidence: [
    {
      type: "internal" as const,
      title: "Engagement Brief Analysis",
      content:
        "Client objectives and constraints extracted from the engagement brief and validated against stated priorities.",
      source: "engagement-brief",
      confidence: 0.9,
      retrievedAt: new Date().toISOString(),
    },
  ],
  assumptions: [
    "No live research tools available — findings based on provided context and general knowledge",
    "Market data reflects general patterns rather than real-time information",
    "Competitive landscape may require validation against current primary sources",
  ],
  gaps: [
    "Live market data not available in this mode",
    "Primary research interviews not yet conducted",
    "Proprietary competitive pricing data unavailable",
  ],
  risks: [
    "Confidence levels are limited by absence of live data sources",
    "Competitive landscape may have shifted since last available reference data",
  ],
  recommendations: [
    "Supplement these findings with client-provided market data before strategy development",
    "Conduct primary research interviews to validate key assumptions",
    "Commission competitive intelligence study if budget permits",
  ],
  confidence: 0.65,
};

const MOCK_QC_OUTPUT = {
  verdict: "approved_with_notes" as const,
  score: 78,
  summary:
    "Work product meets baseline quality standards with noted limitations. Key findings are logically structured and actionable. Confidence is limited by mock mode — no live data verification was possible.",
  passedChecks: [
    {
      id: "check-structure",
      label: "Document structure is complete",
      passed: true,
      notes: "All required sections present and populated",
    },
    {
      id: "check-recommendations",
      label: "Recommendations are actionable",
      passed: true,
      notes: "Each recommendation includes rationale and success criteria",
    },
    {
      id: "check-evidence",
      label: "Evidence is cited",
      passed: true,
      notes: "Sources identified; confidence levels disclosed",
    },
  ],
  failedChecks: [],
  unsupportedClaims: [],
  missingInformation: [
    "Live market data validation",
    "Primary research interview results",
  ],
  requiredRevisions: [],
  approvalRecommendation:
    "Proceed to strategy phase with documented assumption gaps. Commission live research validation before final deliverable.",
};

const WORKFORCE_MOCK_PAYLOADS: Record<string, unknown> = {
  "project-manager": {
    projectPlan: ["Define scope", "Sequence milestones", "Assign owners"],
    milestones: ["Discovery complete", "Strategy approved", "Execution kickoff"],
    owners: [{ role: "project-manager", owner: "engagement-lead" }],
    dependencies: ["Research summary"],
    blockers: [],
    timelineRisks: ["Stakeholder alignment delay"],
    nextActions: ["Confirm owners", "Finalize schedule"],
  },
  "market-research": {
    marketDefinition: "Target regional services market",
    targetSegments: ["SMB", "Mid-market"],
    competitors: ["Competitor A", "Competitor B"],
    demandSignals: ["Increasing category search", "Repeat purchase behavior"],
    localMarketFactors: ["Regional seasonality"],
    opportunities: ["Segment-focused packaging"],
    risks: ["Price sensitivity"],
    confidence: 0.62,
  },
  finance: {
    financialSummary: "Preliminary financial support analysis.",
    assumptions: ["Current cost structure remains stable"],
    revenueDrivers: ["New channel activation"],
    costDrivers: ["Customer acquisition"],
    cashFlowConsiderations: ["Working capital timing"],
    valuationConsiderations: ["Comparable multiples"],
    risks: ["Demand volatility"],
    openQuestions: ["Verified churn data unavailable"],
  },
  strategy: {
    strategicOptions: ["Option A", "Option B"],
    recommendation: "Prioritize Option A with phased rollout.",
    rationale: ["Higher near-term upside", "Lower execution complexity"],
    tradeoffs: ["Reduced flexibility in later phases"],
    risks: ["Execution bandwidth"],
    milestones: ["Phase 1 launch", "Phase 2 optimization"],
    decisionRequired: ["Budget approval"],
  },
  "brand-strategy": {
    brandPositioning: "Trusted specialist for high-accountability engagements.",
    audience: ["Operators", "Executive buyers"],
    messaging: ["Confidence through execution", "Clarity over noise"],
    voice: ["Direct", "Credible"],
    differentiation: ["Integrated strategy-to-delivery model"],
    brandRisks: ["Over-broad messaging"],
    recommendations: ["Narrow primary audience positioning"],
  },
  "creative-director": {
    creativeDirection: "Performance-led storytelling with practical proof points.",
    visualConcepts: ["Concept A", "Concept B"],
    campaignIdeas: ["Case-study-led launch"],
    assetNeeds: ["Landing page", "Social cutdowns"],
    brandConsistencyNotes: ["Maintain core message hierarchy"],
    risks: ["Concept sprawl"],
  },
  "website-digital": {
    websiteAssessment: ["Navigation friction on core flows"],
    userJourney: ["Awareness > Consideration > Conversion"],
    conversionOpportunities: ["Tighten CTA hierarchy"],
    contentNeeds: ["Proof-focused case studies"],
    seoConsiderations: ["Improve intent-aligned page structure"],
    technicalRisks: ["Slow mobile performance"],
  },
  operations: {
    operationalAssessment: ["Delivery process is partially standardized"],
    processGaps: ["Handoff ownership ambiguity"],
    staffingConsiderations: ["Need dedicated PM bandwidth"],
    vendorConsiderations: ["Reporting tooling alignment"],
    implementationPlan: ["Define SOPs", "Pilot new flow", "Scale"],
    risks: ["Change resistance"],
  },
  "legal-review": {
    legalIssueSpotting: ["Potential claims substantiation exposure"],
    complianceRisks: ["Channel-specific disclosure requirements"],
    contractConsiderations: ["SLA obligations"],
    licensingConsiderations: ["Jurisdictional variance"],
    requiredAttorneyReview: ["External counsel sign-off before publication"],
  },
  "sales-revenue": {
    revenueOpportunities: ["Verticalized offer packaging"],
    salesChannels: ["Inbound", "Partnership"],
    pricingConsiderations: ["Tiered pricing experiment"],
    pipelineIdeas: ["Account-based sequence"],
    accountTargets: ["Segment A ICP"],
    risks: ["Longer sales cycles"],
  },
  "investor-relations": {
    investorNarrative: ["Clear problem-solution-outcome arc"],
    keyMetrics: ["Revenue growth", "Retention"],
    diligenceNeeds: ["Cohort analysis", "Unit economics"],
    riskDisclosures: ["Market concentration risk"],
    fundraisingMaterialsNeeded: ["Investor memo", "Data room index"],
    nextActions: ["Finalize diligence checklist"],
  },
  "executive-review": {
    finalRecommendation: "Proceed with phased execution contingent on approvals.",
    decisionSummary: ["Core strategy approved", "Key risks are manageable"],
    confidence: 0.67,
    unresolvedQuestions: ["Final legal review pending"],
    approvalRecommendation: "Approve Phase 1 and hold Phase 2 pending legal sign-off.",
    nextActions: ["Start Phase 1", "Schedule legal checkpoint"],
  },
};

// ---------------------------------------------------------------------------
// Agent type detection
// ---------------------------------------------------------------------------

type MockAgentType = "orchestrator" | "researcher" | "quality-control" | "default";

function detectAgentType(request: AIProviderRequest): MockAgentType {
  const id = (request.metadata?.agentId as string | undefined) ?? "";
  if (id === "orchestrator") return "orchestrator";
  if (id === "researcher") return "researcher";
  if (id === "quality-control") return "quality-control";

  // Fall back to system-prompt keyword detection
  const prompt = (request.systemPrompt ?? "").toLowerCase();
  if (prompt.includes("orchestrator")) return "orchestrator";
  if (prompt.includes("research")) return "researcher";
  if (prompt.includes("quality control") || prompt.includes("quality-control")) return "quality-control";

  return "default";
}

function buildMockPayload(request: AIProviderRequest): unknown {
  const id = (request.metadata?.agentId as string | undefined) ?? "";
  if (id && WORKFORCE_MOCK_PAYLOADS[id]) {
    return WORKFORCE_MOCK_PAYLOADS[id];
  }

  const type = detectAgentType(request);
  if (type === "orchestrator") return MOCK_ORCHESTRATOR_OUTPUT;
  if (type === "researcher") return MOCK_RESEARCH_OUTPUT;
  if (type === "quality-control") return MOCK_QC_OUTPUT;
  return { text: "Mock response — no agent type detected." };
}

function buildMockTextResponse(request: AIProviderRequest): string {
  return JSON.stringify(buildMockPayload(request));
}

// ---------------------------------------------------------------------------
// MockAIProvider
// ---------------------------------------------------------------------------

/**
 * MockAIProvider returns deterministic, schema-conformant outputs for the
 * three core FullSendOS agents without making any network calls.
 *
 * Activate via AI_PROVIDER_MODE=mock or by registering this provider
 * directly in the AIProviderRegistry.
 *
 * Do NOT use in production.
 */
export function createMockProvider(): AIProvider {
  return {
    async generateText(request: AIProviderRequest): Promise<NormalizedAIResponse> {
      return {
        text: buildMockTextResponse(request),
        model: "mock-1.0",
        provider: "mock",
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      };
    },

    async generateStructuredResult<T>(
      request: AIProviderRequest,
      schema: ZodType<T>,
    ): Promise<T> {
      const payload = buildMockPayload(request);
      // Validates mock data against the caller's schema — will throw immediately
      // if the mock output is ever inconsistent with the schema definition.
      return schema.parse(payload);
    },
  };
}
