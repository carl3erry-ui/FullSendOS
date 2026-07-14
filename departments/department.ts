import type { ZodType } from "zod";
import type { AIProvider, AIProviderRequest } from "../ai/provider";
import type { Project, WorkflowStageId } from "../types/project";

export type DepartmentContext = {
  project: Project;
  departmentId: WorkflowStageId;
  dependencyResults: Partial<Record<WorkflowStageId, unknown>>;
};

export type DepartmentPromptBuilder = (context: DepartmentContext) => AIProviderRequest;

export type DepartmentDefinition<T> = {
  id: WorkflowStageId;
  name: string;
  description: string;
  dependencies: WorkflowStageId[];
  promptBuilder: DepartmentPromptBuilder;
  outputSchema: ZodType<T>;
  execute: (context: DepartmentContext & { provider: AIProvider }) => Promise<T>;
};

export function buildJsonInstruction(schemaName: string): string {
  return [
    `Return strictly valid JSON matching ${schemaName}.`,
    "Do not wrap JSON in markdown.",
    "Clearly separate facts, assumptions, estimates, and recommendations.",
    "Do not invent client-specific details.",
    "Do not reference internal agents or system implementation details.",
  ].join("\n");
}
