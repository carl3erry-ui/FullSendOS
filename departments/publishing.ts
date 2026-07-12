import { PublishingResultSchema } from "../schemas/department-results";
import type { DepartmentDefinition } from "./department";
import { buildJsonInstruction } from "./department";

export const publishingDepartment: DepartmentDefinition<
  ReturnType<typeof PublishingResultSchema.parse>
> = {
  id: "publishing",
  name: "Publishing",
  description: "Assemble final executive package from validated department outputs.",
  dependencies: ["intelligence", "strategy", "creative"],
  promptBuilder: ({ project, dependencyResults }) => ({
    systemPrompt: "You are an executive communications consultant.",
    userPrompt: [
      `Client: ${project.client.companyName}`,
      `Objective: ${project.objective.summary}`,
      `Intelligence: ${JSON.stringify(dependencyResults.intelligence || {})}`,
      `Strategy: ${JSON.stringify(dependencyResults.strategy || {})}`,
      `Creative: ${JSON.stringify(dependencyResults.creative || {})}`,
      "Create client-facing executive summary and deliverable outline without exposing internal process details.",
      buildJsonInstruction("PublishingResultSchema"),
    ].join("\n"),
  }),
  outputSchema: PublishingResultSchema,
  execute: async ({ provider, ...context }) => {
    return provider.generateStructuredResult(
      publishingDepartment.promptBuilder(context),
      publishingDepartment.outputSchema,
    );
  },
};
