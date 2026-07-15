import type { ZodType } from "zod";
import { z } from "zod";
import type { AIProvider } from "../../ai/provider";
import { parseStructuredJson } from "../../ai/response-parser";
import { GrokProviderError } from "../../ai/types";
import type { BaseAgent } from "../base-agent";
import { OrchestratorOutputSchema, type OrchestratorOutput } from "../output-schemas";
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
          toStringValue(obj.risk) ||
          toStringValue(obj.title) ||
          toStringValue(obj.summary) ||
          toStringValue(obj.description) ||
          toStringValue(obj.name)
        );
      }
      return undefined;
    })
    .filter((item): item is string => Boolean(item && item.length > 0));
}

function toPriority(value: unknown): "low" | "medium" | "high" | "critical" {
  const raw = (toStringValue(value) || "medium").toLowerCase();
  if (raw === "low" || raw === "medium" || raw === "high" || raw === "critical") {
    return raw;
  }
  return "medium";
}

function normalizeTask(task: unknown, index: number) {
  const raw = task && typeof task === "object" ? (task as Record<string, unknown>) : {};
  const title =
    toStringValue(raw.title) ||
    toStringValue(raw.task) ||
    toStringValue(raw.name) ||
    toStringValue(raw.objective) ||
    `Task ${index + 1}`;

  const objective = toStringValue(raw.objective) || toStringValue(raw.description) || title;

  return {
    id: toStringValue(raw.id) || toStringValue(raw.taskId) || `task-${index + 1}`,
    title,
    objective,
    recommendedAgentId:
      toStringValue(raw.recommendedAgentId) ||
      toStringValue(raw.agentId) ||
      toStringValue(raw.assignedAgent) ||
      "researcher",
    department: toStringValue(raw.department) || toStringValue(raw.team) || "strategy",
    priority: toPriority(raw.priority),
    dependencies: toStringArray(raw.dependencies || raw.dependsOn || raw.prerequisites),
    requiresApproval: Boolean(raw.requiresApproval ?? raw.approvalRequired ?? false),
    expectedOutput:
      toStringValue(raw.expectedOutput) ||
      toStringValue(raw.deliverable) ||
      toStringValue(raw.output) ||
      "Structured recommendation",
  };
}

function normalizeOrchestratorOutput(parsed: unknown): OrchestratorOutput {
  const raw = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  const hasTopLevelSignal = [
    raw.summary,
    raw.executiveSummary,
    raw.tasks,
    raw.recommendedNextAction,
    raw.nextAction,
    raw.nextStep,
  ].some((value) => value !== undefined && value !== null);

  if (!hasTopLevelSignal) {
    throw new GrokProviderError({
      kind: "validation",
      message: "Structured result failed schema validation: insufficient orchestrator fields.",
    });
  }

  const rawTasks = Array.isArray(raw.tasks) ? raw.tasks : [];
  if (rawTasks.length === 0) {
    throw new GrokProviderError({
      kind: "validation",
      message: "Structured result failed schema validation: tasks are required.",
    });
  }

  return OrchestratorOutputSchema.parse({
    summary:
      toStringValue(raw.summary) ||
      toStringValue(raw.executiveSummary) ||
      toStringValue(raw.overview) ||
      "Structured orchestration plan.",
    assumptions: toStringArray(raw.assumptions),
    tasks: rawTasks.map((task, index) => normalizeTask(task, index)),
    dependencies: toStringArray(raw.dependencies || raw.globalDependencies),
    risks: toStringArray(raw.risks),
    approvalGates: toStringArray(raw.approvalGates || raw.decisionPoints || raw.gates),
    successCriteria: toStringArray(raw.successCriteria || raw.successMetrics || raw.outcomes),
    recommendedNextAction:
      toStringValue(raw.recommendedNextAction) ||
      toStringValue(raw.nextAction) ||
      toStringValue(raw.nextStep) ||
      "Review and confirm execution priorities.",
  });
}

export const orchestratorDefinition: AgentDefinition = {
  id: "orchestrator",
  name: "CEO / Executive Orchestrator Agent",
  department: "executive",
  description:
    "Plans and coordinates consulting engagements. Breaks objectives into structured tasks, identifies dependencies, surfaces risks, and determines which agents to activate at each stage.",
  role: "engagement-planner",
  roleSummary:
    "Owns executive-level orchestration, cross-department sequencing, and decision framing.",
  version: "1.0.0",
  capabilities: [
    "engagement-planning",
    "task-decomposition",
    "dependency-mapping",
    "risk-identification",
    "agent-coordination",
  ],
  allowedTools: [
    AgentPermissions.READ_PROJECT,
    AgentPermissions.READ_ENGAGEMENT,
    AgentPermissions.CREATE_TASK,
    AgentPermissions.UPDATE_TASK,
    AgentPermissions.READ_ENGAGEMENT_CONTEXT,
    AgentPermissions.READ_CLIENT_PROFILE,
    AgentPermissions.READ_DATA_ROOM_METADATA,
    AgentPermissions.REQUEST_DATA_ROOM_FILE_ACCESS_LATER,
    AgentPermissions.CREATE_EXECUTIVE_SUMMARY,
    AgentPermissions.REQUEST_HUMAN_APPROVAL,
  ],
  permissions: [
    AgentPermissions.READ_PROJECT,
    AgentPermissions.READ_ENGAGEMENT,
    AgentPermissions.CREATE_TASK,
    AgentPermissions.UPDATE_TASK,
    AgentPermissions.READ_ENGAGEMENT_CONTEXT,
    AgentPermissions.READ_CLIENT_PROFILE,
    AgentPermissions.READ_DATA_ROOM_METADATA,
    AgentPermissions.REQUEST_DATA_ROOM_FILE_ACCESS_LATER,
    AgentPermissions.CREATE_EXECUTIVE_SUMMARY,
    AgentPermissions.REQUEST_HUMAN_APPROVAL,
  ],
  defaultProvider: "xai",
  allowedProviders: ["xai", "mock"],
  defaultModel: process.env.XAI_DEFAULT_MODEL ?? "grok-4.5",
  systemPrompt: `You are the FullSendOS Orchestrator Agent.

Your role is to analyze consulting engagements and produce a structured execution plan.
You decompose high-level client objectives into discrete, assignable tasks with clear
dependencies, priorities, and success criteria.

Rules:
- Base your plan on the engagement brief and stated constraints.
- Flag assumptions explicitly — do not invent facts.
- Identify risks that could derail the engagement.
- Specify which agent (researcher, quality-control, etc.) should handle each task.
- Mark tasks that require human approval before execution.
- Return a valid JSON object conforming to the OrchestratorOutput schema.`,
  outputSchema: OrchestratorOutputSchema as unknown as ZodType<unknown>,
  requiresApproval: false,
  approvalRequirements: {
    required: false,
    reason: "Executive planning output is reviewed in standard workflow checkpoints.",
    mode: "none",
  },
  riskLevel: "high",
  inputContract: {
    description: "Engagement objective and constraints to drive orchestration.",
    requiredFields: ["objective"],
    optionalFields: ["instructions", "context", "engagementId"],
  },
  outputContract: {
    description: "Structured orchestration plan safe for workflow and UI display.",
    schemaName: "OrchestratorOutputSchema",
    safeFields: [
      "summary",
      "assumptions",
      "tasks",
      "dependencies",
      "risks",
      "approvalGates",
      "successCriteria",
      "recommendedNextAction",
    ],
  },
  typicalTasks: [
    "Create executive workplan",
    "Assign department responsibilities",
    "Identify decision gates",
  ],
  workflowStepMapping: ["intelligence", "strategy", "creative", "publishing"],
  supportsDataRoomMetadata: true,
  requiresHumanReview: true,
  maximumIterations: 3,
  timeoutMs: 60_000,
  enabled: true,
  createdAt: "2026-07-12T00:00:00.000Z",
  updatedAt: "2026-07-12T00:00:00.000Z",
};

export class OrchestratorAgent implements BaseAgent<OrchestratorOutput> {
  readonly definition = orchestratorDefinition;

  validateTask(task: AgentTask): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!task.objective || task.objective.trim().length === 0) {
      errors.push("task.objective is required for the Orchestrator.");
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
        content: `Engagement objective: ${task.objective}\n\nProduce a structured execution plan as JSON.`,
      },
    ];
  }

  async execute(task: AgentTask, provider: AIProvider): Promise<OrchestratorOutput> {
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
    return normalizeOrchestratorOutput(parsed);
  }

  parseOutput(raw: string): OrchestratorOutput {
    return OrchestratorOutputSchema.parse(JSON.parse(raw));
  }

  validateOutput(output: unknown): output is OrchestratorOutput {
    return OrchestratorOutputSchema.safeParse(output).success;
  }
}
