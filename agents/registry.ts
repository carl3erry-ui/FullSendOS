import type { AgentDefinition } from "./types";

/**
 * Public-safe agent metadata — excludes the full system prompt which
 * is an internal implementation detail and must not be exposed to clients.
 */
export type PublicAgentMetadata = Omit<AgentDefinition, "systemPrompt">;

/**
 * AgentRegistry manages the lifecycle of registered agent definitions.
 *
 * - Prevents duplicate registration.
 * - Exposes public-safe metadata for UI and API consumers.
 * - Does not hold agent instances; those are created on demand.
 */
export class AgentRegistry {
  private readonly agents = new Map<string, AgentDefinition>();

  /**
   * Register an agent definition.
   * Throws if an agent with the same id is already registered.
   */
  register(definition: AgentDefinition): void {
    if (this.agents.has(definition.id)) {
      throw new Error(
        `Agent "${definition.id}" is already registered. Use a unique id.`,
      );
    }
    this.agents.set(definition.id, definition);
  }

  /** Return the raw definition for a given id, or undefined. */
  getById(id: string): AgentDefinition | undefined {
    return this.agents.get(id);
  }

  /** Return all enabled agent definitions. */
  listEnabled(): AgentDefinition[] {
    return Array.from(this.agents.values()).filter((a) => a.enabled);
  }

  /**
   * Return public-safe metadata for a given id.
   * The systemPrompt field is omitted.
   */
  getPublicMetadata(id: string): PublicAgentMetadata | undefined {
    const agent = this.agents.get(id);
    if (!agent) return undefined;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { systemPrompt: _omit, ...meta } = agent;
    return meta;
  }

  /** Return public-safe metadata for all enabled agents. */
  listPublicMetadata(): PublicAgentMetadata[] {
    return this.listEnabled().map(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      ({ systemPrompt: _omit, ...meta }) => meta,
    );
  }

  /** Total number of registered agents (enabled and disabled). */
  get size(): number {
    return this.agents.size;
  }
}

/**
 * Global agent registry.
 * Call registerAllAgents() in your application entry point to populate it.
 */
export const globalAgentRegistry = new AgentRegistry();
