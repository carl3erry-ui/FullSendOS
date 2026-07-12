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
