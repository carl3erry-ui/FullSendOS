/**
 * agents/index.ts
 *
 * Convenience re-exports and global registry population.
 * Import this module in your server entry point to ensure all agents
 * and providers are registered before request handling begins.
 */

import { globalAgentRegistry } from "./registry";
import { orchestratorDefinition } from "./definitions/orchestrator";
import { researcherDefinition } from "./definitions/researcher";
import { qualityControlDefinition } from "./definitions/quality-control";

/**
 * Register all built-in agents into the provided registry.
 * Safe to call multiple times only if using a fresh registry instance.
 */
export function registerAllAgents(
  registry: typeof globalAgentRegistry = globalAgentRegistry,
): void {
  registry.register(orchestratorDefinition);
  registry.register(researcherDefinition);
  registry.register(qualityControlDefinition);
}

// Public re-exports
export * from "./types";
export * from "./permissions";
export * from "./output-schemas";
export * from "./base-agent";
export { AgentRegistry, globalAgentRegistry, type PublicAgentMetadata } from "./registry";
export { orchestratorDefinition, OrchestratorAgent } from "./definitions/orchestrator";
export { researcherDefinition, ResearcherAgent } from "./definitions/researcher";
export { qualityControlDefinition, QualityControlAgent } from "./definitions/quality-control";
