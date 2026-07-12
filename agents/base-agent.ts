import type { AIProvider } from "../ai/provider";
import type { AgentDefinition, AgentTask } from "./types";

/**
 * BaseAgent contract.
 *
 * Every FullSendOS agent must satisfy this interface.
 * In the foundation slice execution is kept lightweight and testable.
 * Full task persistence, approval routing, and workflow integration
 * are implemented in later slices.
 */
export interface BaseAgent<TOutput = unknown> {
  /** Immutable agent definition including id, capabilities, and system prompt. */
  readonly definition: AgentDefinition;

  /**
   * Validate that a task is suitable for this agent.
   * Returns a typed validation result rather than throwing.
   */
  validateTask(task: AgentTask): { valid: boolean; errors: string[] };

  /**
   * Build the system prompt for a given task.
   * May augment the definition's base system prompt with task-specific context.
   */
  buildSystemPrompt(task: AgentTask): string;

  /**
   * Build the ordered message sequence for the provider call.
   * Returns an array of role/content pairs for use in the provider request.
   */
  buildMessages(task: AgentTask): Array<{ role: "user" | "assistant"; content: string }>;

  /**
   * Execute the agent task against the given AI provider.
   * Returns a typed, validated output.
   */
  execute(task: AgentTask, provider: AIProvider): Promise<TOutput>;

  /**
   * Parse raw text from the provider response into a typed output.
   * Throws if the text cannot be parsed or fails schema validation.
   */
  parseOutput(raw: string): TOutput;

  /**
   * Type guard — returns true if the value is a valid, schema-conformant output.
   */
  validateOutput(output: unknown): output is TOutput;
}
