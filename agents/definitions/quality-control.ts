import type { ZodType } from "zod";
import type { AIProvider } from "../../ai/provider";
import type { BaseAgent } from "../base-agent";
import { QualityControlOutputSchema, type QualityControlOutput } from "../output-schemas";
import type { AgentDefinition, AgentTask } from "../types";
import { AgentPermissions } from "../permissions";

export const qualityControlDefinition: AgentDefinition = {
  id: "quality-control",
  name: "Quality Control Agent",
  description:
    "Reviews consulting work products for accuracy, completeness, and logical consistency. Issues verdicts with confidence scores and specific revision requirements.",
  role: "quality-reviewer",
  version: "1.0.0",
  capabilities: [
    "claim-verification",
    "completeness-review",
    "logical-consistency-check",
    "evidence-validation",
    "revision-recommendation",
  ],
  department: "quality-control",
  roleSummary:
    "Validates engagement outputs for quality, consistency, and policy-safe delivery.",
  allowedTools: [
    AgentPermissions.READ_PROJECT,
    AgentPermissions.READ_ENGAGEMENT,
    AgentPermissions.READ_DOCUMENTS,
    AgentPermissions.READ_ENGAGEMENT_CONTEXT,
    AgentPermissions.READ_CLIENT_PROFILE,
    AgentPermissions.READ_DATA_ROOM_METADATA,
    AgentPermissions.RETRIEVE_DATA_ROOM_CONTEXT,
    AgentPermissions.CREATE_QUALITY_CONTROL_REVIEW,
    AgentPermissions.REQUEST_HUMAN_APPROVAL,
  ],
  permissions: [
    AgentPermissions.READ_PROJECT,
    AgentPermissions.READ_ENGAGEMENT,
    AgentPermissions.READ_DOCUMENTS,
    AgentPermissions.READ_ENGAGEMENT_CONTEXT,
    AgentPermissions.READ_CLIENT_PROFILE,
    AgentPermissions.READ_DATA_ROOM_METADATA,
    AgentPermissions.RETRIEVE_DATA_ROOM_CONTEXT,
    AgentPermissions.CREATE_QUALITY_CONTROL_REVIEW,
    AgentPermissions.REQUEST_HUMAN_APPROVAL,
  ],
  defaultProvider: "xai",
  allowedProviders: ["xai", "mock"],
  defaultModel: process.env.XAI_DEFAULT_MODEL ?? "grok-4.5",
  systemPrompt: `You are the FullSendOS Quality Control Agent.

Your role is to review consulting work products and issue structured quality verdicts.
You check for factual accuracy, unsupported claims, missing information, logical
consistency, and completeness.

Verdict options:
- approved: Work product meets quality bar with no required changes.
- approved_with_notes: Meets the bar; minor gaps documented but not blocking.
- revision_required: Substantive issues found; specific revisions required before approval.
- rejected: Work product does not meet minimum quality standards.

Rules:
- Be specific about which checks passed and which failed.
- List every unsupported claim individually.
- Score from 0 to 100 — be calibrated, not generous.
- If reviewing mock or demo outputs, note this in your summary.
- Return a valid JSON object conforming to the QualityControlOutput schema.`,
  outputSchema: QualityControlOutputSchema as unknown as ZodType<unknown>,
  requiresApproval: false,
  approvalRequirements: {
    required: false,
    reason: "QC output guides revisions before final executive approval.",
    mode: "none",
  },
  riskLevel: "medium",
  inputContract: {
    description: "Target output plus review goals and acceptance criteria.",
    requiredFields: ["objective"],
    optionalFields: ["instructions", "context", "engagementId"],
  },
  outputContract: {
    description: "Structured quality verdict output safe for UI and workflow.",
    schemaName: "QualityControlOutputSchema",
    safeFields: [
      "verdict",
      "score",
      "summary",
      "passedChecks",
      "failedChecks",
      "unsupportedClaims",
      "missingInformation",
      "requiredRevisions",
      "approvalRecommendation",
    ],
  },
  typicalTasks: [
    "Review strategy output for gaps",
    "Validate evidence quality",
    "Recommend remediation actions",
  ],
  workflowStepMapping: ["publishing"],
  supportsDataRoomMetadata: true,
  requiresHumanReview: true,
  maximumIterations: 2,
  timeoutMs: 60_000,
  enabled: true,
  createdAt: "2026-07-12T00:00:00.000Z",
  updatedAt: "2026-07-12T00:00:00.000Z",
};

export class QualityControlAgent implements BaseAgent<QualityControlOutput> {
  readonly definition = qualityControlDefinition;

  validateTask(task: AgentTask): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!task.objective || task.objective.trim().length === 0) {
      errors.push("task.objective is required for the Quality Control Agent.");
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
        content: `Review objective: ${task.objective}\n\nReview the provided work product and return a quality verdict as JSON.`,
      },
    ];
  }

  async execute(task: AgentTask, provider: AIProvider): Promise<QualityControlOutput> {
    const messages = this.buildMessages(task);
    const result = await provider.generateStructuredResult(
      {
        systemPrompt: this.buildSystemPrompt(task),
        userPrompt: messages[0].content,
        metadata: { agentId: this.definition.id },
      },
      QualityControlOutputSchema,
    );
    return result;
  }

  parseOutput(raw: string): QualityControlOutput {
    return QualityControlOutputSchema.parse(JSON.parse(raw));
  }

  validateOutput(output: unknown): output is QualityControlOutput {
    return QualityControlOutputSchema.safeParse(output).success;
  }
}
