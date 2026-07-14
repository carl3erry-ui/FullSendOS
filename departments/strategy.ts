import { StrategyResultSchema } from "../schemas/department-results";
import type { DepartmentDefinition } from "./department";
import { buildJsonInstruction } from "./department";

export const strategyDepartment: DepartmentDefinition<
  ReturnType<typeof StrategyResultSchema.parse>
> = {
  id: "strategy",
  name: "Strategy",
  description: "Transform intelligence into positioning and prioritized strategic actions.",
  dependencies: ["intelligence"],
  promptBuilder: ({ project, dependencyResults }) => ({
    systemPrompt: "You are a strategy consultant.",
    userPrompt: [
      `Client: ${project.client.companyName}`,
      `Objective: ${project.objective.summary}`,
      `Intelligence findings: ${JSON.stringify(dependencyResults.intelligence || {})}`,
      "Develop clear positioning, target customer strategy, and prioritized recommendations.",
      buildJsonInstruction("StrategyResultSchema"),
    ].join("\n"),
  }),
  outputSchema: StrategyResultSchema,
  execute: async ({ provider, ...context }) => {
    return provider.generateStructuredResult(
      strategyDepartment.promptBuilder(context),
      strategyDepartment.outputSchema,
    );
  },
};
