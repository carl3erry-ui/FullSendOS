import type { ZodType } from "zod";
import type { AIProvider } from "../../ai/provider";
import type { BaseAgent } from "../base-agent";
import { OrchestratorOutputSchema, type OrchestratorOutput } from "../output-schemas";
import type { AgentDefinition, AgentTask } from "../types";
import { AgentPermissions } from "../permissions";

export const orchestratorDefinition: AgentDefinition = {
  id: "orchestrator",
  name: "Orchestrator",
  description:
    "Plans and coordinates consulting engagements. Breaks objectives into structured tasks, identifies dependencies, surfaces risks, and determines which agents to activate at each stage.",
  role: "engagement-planner",
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
  ],
  defaultProvider: "xai",
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
    const result = await provider.generateStructuredResult(
      {
        systemPrompt: this.buildSystemPrompt(task),
        userPrompt: messages[0].content,
        metadata: { agentId: this.definition.id },
      },
      OrchestratorOutputSchema,
    );
    return result;
  }

  parseOutput(raw: string): OrchestratorOutput {
    return OrchestratorOutputSchema.parse(JSON.parse(raw));
  }

  validateOutput(output: unknown): output is OrchestratorOutput {
    return OrchestratorOutputSchema.safeParse(output).success;
  }
}
