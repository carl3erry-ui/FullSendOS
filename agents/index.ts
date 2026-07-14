/**
 * agents/index.ts
 *
 * Convenience re-exports and global registry population.
 * Import this module in your server entry point to ensure all agents
 * and providers are registered before request handling begins.
 */

import { globalAgentRegistry, globalInstanceRegistry } from "./registry";
import { orchestratorDefinition, OrchestratorAgent } from "./definitions/orchestrator";
import { researcherDefinition, ResearcherAgent } from "./definitions/researcher";
import { qualityControlDefinition, QualityControlAgent } from "./definitions/quality-control";
import {
  workforceDefinitions,
  createWorkforceAgentInstance,
} from "./definitions/workforce";

/**
 * Register all built-in agents into the provided registry.
 * Safe to call multiple times only if using a fresh registry instance.
 */
export function registerAllAgents(
  registry: typeof globalAgentRegistry = globalAgentRegistry,
): void {
  if (!registry.getById(orchestratorDefinition.id)) {
    registry.register(orchestratorDefinition);
  }
  if (!registry.getById(researcherDefinition.id)) {
    registry.register(researcherDefinition);
  }
  if (!registry.getById(qualityControlDefinition.id)) {
    registry.register(qualityControlDefinition);
  }

  for (const definition of workforceDefinitions) {
    if (!registry.getById(definition.id)) {
      registry.register(definition);
    }
  }
}

export function registerAllAgentInstances(): void {
  if (!globalInstanceRegistry.get(orchestratorDefinition.id)) {
    globalInstanceRegistry.register(new OrchestratorAgent());
  }
  if (!globalInstanceRegistry.get(researcherDefinition.id)) {
    globalInstanceRegistry.register(new ResearcherAgent());
  }
  if (!globalInstanceRegistry.get(qualityControlDefinition.id)) {
    globalInstanceRegistry.register(new QualityControlAgent());
  }

  for (const definition of workforceDefinitions) {
    if (!globalInstanceRegistry.get(definition.id)) {
      globalInstanceRegistry.register(createWorkforceAgentInstance(definition.id));
    }
  }
}

registerAllAgents(globalAgentRegistry);
registerAllAgentInstances();

// Public re-exports
export * from "./types";
export * from "./permissions";
export * from "./output-schemas";
export * from "./base-agent";
export { AgentRegistry, AgentInstanceRegistry, globalAgentRegistry, globalInstanceRegistry, type PublicAgentMetadata } from "./registry";
export { orchestratorDefinition, OrchestratorAgent } from "./definitions/orchestrator";
export { researcherDefinition, ResearcherAgent } from "./definitions/researcher";
export { qualityControlDefinition, QualityControlAgent } from "./definitions/quality-control";
export { workforceDefinitions, workforceSchemas, createWorkforceAgentInstance } from "./definitions/workforce";
export {
  WORKFORCE_DEPARTMENT_MAPPINGS,
  WORKFORCE_TASK_TEMPLATES,
  getPublicWorkforceCatalog,
  hasDangerousPermissions,
} from "./workforce-catalog";
export * from "./errors";
export { AgentTaskStore, globalTaskStore, type AgentTaskFilter } from "./task-store";
export { AgentExecutionStore, globalExecutionStore } from "./execution-store";
export { AgentExecutor, type AgentExecutorOptions, type AgentExecutorResult } from "./executor";
