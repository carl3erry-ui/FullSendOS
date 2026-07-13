import type { ZodType } from "zod";
import type { AIProvider } from "../../ai/provider";
import type { BaseAgent } from "../base-agent";
import { ResearchOutputSchema, type ResearchOutput } from "../output-schemas";
import type { AgentDefinition, AgentTask } from "../types";
import { AgentPermissions } from "../permissions";

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
        content: `Research objective: ${task.objective}\n\nConduct research and return findings as JSON.`,
      },
    ];
  }

  async execute(task: AgentTask, provider: AIProvider): Promise<ResearchOutput> {
    const messages = this.buildMessages(task);
    const result = await provider.generateStructuredResult(
      {
        systemPrompt: this.buildSystemPrompt(task),
        userPrompt: messages[0].content,
        metadata: { agentId: this.definition.id },
      },
      ResearchOutputSchema,
    );
    return result;
  }

  parseOutput(raw: string): ResearchOutput {
    return ResearchOutputSchema.parse(JSON.parse(raw));
  }

  validateOutput(output: unknown): output is ResearchOutput {
    return ResearchOutputSchema.safeParse(output).success;
  }
}
