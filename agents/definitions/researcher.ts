import type { ZodType } from "zod";
import { z } from "zod";
import type { AIProvider } from "../../ai/provider";
import { parseStructuredJson } from "../../ai/response-parser";
import { GrokProviderError } from "../../ai/types";
import type { BaseAgent } from "../base-agent";
import { ResearchOutputSchema, type ResearchOutput } from "../output-schemas";
import type { AgentDefinition, AgentTask } from "../types";
import { AgentPermissions } from "../permissions";

function toStringValue(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return undefined;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (item && typeof item === "object") {
        const obj = item as Record<string, unknown>;
        return (
          toStringValue(obj.question) ||
          toStringValue(obj.topic) ||
          toStringValue(obj.title) ||
          toStringValue(obj.label) ||
          toStringValue(obj.summary) ||
          toStringValue(obj.note)
        );
      }
      return undefined;
    })
    .filter((item): item is string => Boolean(item && item.length > 0));
}

function toConfidence(value: unknown, fallback = 0.6): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value >= 0 && value <= 1) return value;
    if (value >= 1 && value <= 100) return Math.max(0, Math.min(1, value / 100));
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.trim());
    if (Number.isFinite(parsed)) {
      if (parsed >= 0 && parsed <= 1) return parsed;
      if (parsed >= 1 && parsed <= 100) return Math.max(0, Math.min(1, parsed / 100));
    }
  }
  return fallback;
}

function normalizeFinding(finding: unknown, index: number): ResearchOutput["findings"][number] {
  const raw = finding && typeof finding === "object" ? (finding as Record<string, unknown>) : {};
  const topic =
    toStringValue(raw.topic) ||
    toStringValue(raw.title) ||
    toStringValue(raw.area) ||
    toStringValue(raw.theme) ||
    `Finding ${index + 1}`;

  const summary =
    toStringValue(raw.summary) ||
    toStringValue(raw.finding) ||
    toStringValue(raw.insight) ||
    toStringValue(raw.description) ||
    toStringValue(raw.details) ||
    "No summary provided.";

  const sources = toStringArray(raw.sources || raw.citations || raw.references || raw.source || []);

  return {
    topic,
    summary,
    confidence: toConfidence(raw.confidence),
    sources,
  };
}

function normalizeEvidence(item: unknown): ResearchOutput["evidence"][number] {
  const raw = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
  const typeRaw = (toStringValue(raw.type) || toStringValue(raw.sourceType) || "analysis").toLowerCase();
  const type: ResearchOutput["evidence"][number]["type"] =
    typeRaw === "internal" ||
    typeRaw === "web" ||
    typeRaw === "document" ||
    typeRaw === "analysis" ||
    typeRaw === "external"
      ? typeRaw
      : "analysis";

  const source =
    toStringValue(raw.source) ||
    toStringValue(raw.reference) ||
    toStringValue(raw.citation) ||
    "model-output";

  const sourceUrlRaw = toStringValue(raw.sourceUrl) || toStringValue(raw.url);
  const sourceUrl = sourceUrlRaw && /^https?:\/\//i.test(sourceUrlRaw) ? sourceUrlRaw : undefined;

  return {
    type,
    title:
      toStringValue(raw.title) ||
      toStringValue(raw.name) ||
      toStringValue(raw.topic) ||
      "Evidence item",
    content:
      toStringValue(raw.content) ||
      toStringValue(raw.summary) ||
      toStringValue(raw.snippet) ||
      toStringValue(raw.description) ||
      "No content provided.",
    source,
    ...(sourceUrl ? { sourceUrl } : {}),
    confidence: toConfidence(raw.confidence),
    retrievedAt:
      toStringValue(raw.retrievedAt) ||
      toStringValue(raw.timestamp) ||
      toStringValue(raw.date) ||
      new Date().toISOString(),
  };
}

function normalizeResearchOutput(parsed: unknown): ResearchOutput {
  const raw = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  const hasTopLevelSignal = [
    raw.executiveSummary,
    raw.summary,
    raw.findings,
    raw.researchQuestions,
    raw.questions,
    raw.evidence,
    raw.recommendations,
  ].some((value) => value !== undefined && value !== null);

  if (!hasTopLevelSignal) {
    throw new GrokProviderError({
      kind: "validation",
      message: "Structured result failed schema validation: insufficient researcher fields.",
    });
  }

  const findingsRaw =
    Array.isArray(raw.findings)
      ? raw.findings
      : Array.isArray(raw.insights)
        ? raw.insights
        : Array.isArray(raw.results)
          ? raw.results
          : [];

  const evidenceRaw =
    Array.isArray(raw.evidence)
      ? raw.evidence
      : Array.isArray(raw.sources)
        ? raw.sources
        : Array.isArray(raw.supportingEvidence)
          ? raw.supportingEvidence
          : [];

  return ResearchOutputSchema.parse({
    executiveSummary:
      toStringValue(raw.executiveSummary) ||
      toStringValue(raw.summary) ||
      toStringValue(raw.overview) ||
      toStringValue(raw.notes) ||
      "Research summary unavailable.",
    researchQuestions: toStringArray(raw.researchQuestions || raw.questions || raw.checks),
    findings: findingsRaw.map((item, index) => normalizeFinding(item, index)),
    evidence: evidenceRaw.map((item) => normalizeEvidence(item)),
    assumptions: toStringArray(raw.assumptions),
    gaps: toStringArray(raw.gaps || raw.unknowns || raw.openQuestions),
    risks: toStringArray(raw.risks || raw.limitations),
    recommendations: toStringArray(raw.recommendations || raw.nextActions || raw.actions),
    confidence: toConfidence(raw.confidence),
  });
}

export const researcherDefinition: AgentDefinition = {
  id: "researcher",
  name: "Research Agent",
  department: "intelligence",
  description:
    "Conducts structured research for consulting engagements. Produces findings, evidence, and recommendations from available context. Always discloses when live research tools are unavailable.",
  role: "researcher",
  roleSummary:
    "Builds evidence-backed research outputs and clearly labels assumptions and unknowns.",
  version: "1.0.0",
  capabilities: [
    "market-research",
    "competitive-analysis",
    "evidence-collection",
    "assumption-identification",
    "gap-analysis",
  ],
  allowedTools: [
    AgentPermissions.READ_PROJECT,
    AgentPermissions.READ_ENGAGEMENT,
    AgentPermissions.READ_DOCUMENTS,
    AgentPermissions.SEARCH_INTERNAL_KNOWLEDGE,
    AgentPermissions.READ_ENGAGEMENT_CONTEXT,
    AgentPermissions.READ_CLIENT_PROFILE,
    AgentPermissions.READ_DATA_ROOM_METADATA,
    AgentPermissions.RETRIEVE_DATA_ROOM_CONTEXT,
    AgentPermissions.REQUEST_DATA_ROOM_FILE_ACCESS_LATER,
    AgentPermissions.CREATE_RESEARCH_SUMMARY,
  ],
  permissions: [
    AgentPermissions.READ_PROJECT,
    AgentPermissions.READ_ENGAGEMENT,
    AgentPermissions.READ_DOCUMENTS,
    AgentPermissions.SEARCH_INTERNAL_KNOWLEDGE,
    AgentPermissions.READ_ENGAGEMENT_CONTEXT,
    AgentPermissions.READ_CLIENT_PROFILE,
    AgentPermissions.READ_DATA_ROOM_METADATA,
    AgentPermissions.RETRIEVE_DATA_ROOM_CONTEXT,
    AgentPermissions.REQUEST_DATA_ROOM_FILE_ACCESS_LATER,
    AgentPermissions.CREATE_RESEARCH_SUMMARY,
  ],
  defaultProvider: "xai",
  allowedProviders: ["xai", "mock"],
  defaultModel: process.env.XAI_DEFAULT_MODEL ?? "grok-4.5",
  systemPrompt: `You are the FullSendOS Research Agent.

Your role is to conduct structured research for consulting engagements and produce
evidence-backed findings. You identify market trends, competitive dynamics, and
customer insights relevant to the client's objective.

IMPORTANT: If live research tools are not available, you must explicitly state this
in your assumptions array. Never fabricate market data or cite sources you cannot
verify. Label all assumptions clearly.

Rules:
- Answer the research questions derived from the engagement objective.
- Cite every finding with a source identifier.
- Express confidence as a decimal between 0 and 1.
- List gaps where data is missing or unverifiable.
- Return JSON only (no markdown fences, no extra commentary).
- Return a valid JSON object conforming to the ResearchOutput schema.`,
  outputSchema: ResearchOutputSchema as unknown as ZodType<unknown>,
  requiresApproval: false,
  approvalRequirements: {
    required: false,
    reason: "Research output is reviewed by quality and executive layers.",
    mode: "none",
  },
  riskLevel: "medium",
  inputContract: {
    description: "Research objective with optional context and constraints.",
    requiredFields: ["objective"],
    optionalFields: ["instructions", "context", "engagementId"],
  },
  outputContract: {
    description: "Structured research output without hidden reasoning fields.",
    schemaName: "ResearchOutputSchema",
    safeFields: [
      "executiveSummary",
      "researchQuestions",
      "findings",
      "evidence",
      "assumptions",
      "gaps",
      "risks",
      "recommendations",
      "confidence",
    ],
  },
  typicalTasks: [
    "Research this company",
    "Enrich missing business information",
    "Synthesize research assumptions",
  ],
  workflowStepMapping: ["intelligence", "strategy"],
  supportsDataRoomMetadata: true,
  requiresHumanReview: true,
  maximumIterations: 3,
  timeoutMs: 90_000,
  enabled: true,
  createdAt: "2026-07-12T00:00:00.000Z",
  updatedAt: "2026-07-12T00:00:00.000Z",
};

export class ResearcherAgent implements BaseAgent<ResearchOutput> {
  readonly definition = researcherDefinition;

  validateTask(task: AgentTask): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!task.objective || task.objective.trim().length === 0) {
      errors.push("task.objective is required for the Research Agent.");
    }
    if (task.agentId !== this.definition.id) {
      errors.push(`task.agentId must be "${this.definition.id}".`);
    }
    return { valid: errors.length === 0, errors };
  }

  buildSystemPrompt(_task: AgentTask): string {
    return this.definition.systemPrompt;
  }

  buildMessages(task: AgentTask): Array<{ role: "user" | "assistant"; content: string }> {
    return [
      {
        role: "user",
        content: `Research objective: ${task.objective}\n\nConduct research and return findings as JSON only.\nRequired top-level keys: executiveSummary, researchQuestions, findings, evidence, assumptions, gaps, risks, recommendations, confidence.`,
      },
    ];
  }

  async execute(task: AgentTask, provider: AIProvider): Promise<ResearchOutput> {
    const messages = this.buildMessages(task);
    const response = await provider.generateText(
      {
        systemPrompt: this.buildSystemPrompt(task),
        userPrompt: messages[0].content,
        metadata: { agentId: this.definition.id },
        maxOutputTokens: 900,
      },
    );
    const parsed = parseStructuredJson(response.text, z.record(z.unknown()));
    return normalizeResearchOutput(parsed);
  }

  parseOutput(raw: string): ResearchOutput {
    return ResearchOutputSchema.parse(JSON.parse(raw));
  }

  validateOutput(output: unknown): output is ResearchOutput {
    return ResearchOutputSchema.safeParse(output).success;
  }
}
