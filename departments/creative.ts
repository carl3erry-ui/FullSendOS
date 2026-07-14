import { CreativeResultSchema } from "../schemas/department-results";
import type { DepartmentDefinition } from "./department";
import { buildJsonInstruction } from "./department";

export const creativeDepartment: DepartmentDefinition<
  ReturnType<typeof CreativeResultSchema.parse>
> = {
  id: "creative",
  name: "Creative",
  description: "Translate strategy into messaging, brand direction, and campaign concepts.",
  dependencies: ["strategy"],
  promptBuilder: ({ project, dependencyResults }) => ({
    systemPrompt: "You are a creative strategy lead.",
    userPrompt: [
      `Client: ${project.client.companyName}`,
      `Objective: ${project.objective.summary}`,
      `Strategy output: ${JSON.stringify(dependencyResults.strategy || {})}`,
      "Produce creative direction aligned to strategy with clear rationale and constraints.",
      buildJsonInstruction("CreativeResultSchema"),
    ].join("\n"),
  }),
  outputSchema: CreativeResultSchema,
  execute: async ({ provider, ...context }) => {
    return provider.generateStructuredResult(
      creativeDepartment.promptBuilder(context),
      creativeDepartment.outputSchema,
    );
  },
};
