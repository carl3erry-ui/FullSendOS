import { IntelligenceResultSchema } from "../schemas/department-results";
import type { DepartmentDefinition } from "./department";
import { buildJsonInstruction } from "./department";

export const intelligenceDepartment: DepartmentDefinition<
  ReturnType<typeof IntelligenceResultSchema.parse>
> = {
  id: "intelligence",
  name: "Intelligence",
  description: "Collect market, competitor, and evidence baseline for project decisions.",
  dependencies: [],
  promptBuilder: ({ project }) => ({
    systemPrompt: "You are a consulting intelligence analyst.",
    userPrompt: [
      `Client: ${project.client.companyName}`,
      `Objective: ${project.objective.summary}`,
      `Constraints: ${project.objective.constraints.join(", ") || "None provided"}`,
      "Produce market and competitor intelligence with explicit evidence and unknowns.",
      buildJsonInstruction("IntelligenceResultSchema"),
    ].join("\n"),
  }),
  outputSchema: IntelligenceResultSchema,
  execute: async ({ provider, ...context }) => {
    return provider.generateStructuredResult(
      intelligenceDepartment.promptBuilder(context),
      intelligenceDepartment.outputSchema,
    );
  },
};
