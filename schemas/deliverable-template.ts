import { z } from "zod";

export const DeliverableTemplateIdSchema = z.enum([
  "executive-standard",
  "client-ready",
  "investor-brief",
  "internal-review",
]);

export type DeliverableTemplateId = z.infer<typeof DeliverableTemplateIdSchema>;

export const DeliverableTemplateSchema = z.object({
  id: DeliverableTemplateIdSchema,
  name: z.string().min(1),
  description: z.string().min(1),
  format: z.enum(["markdown", "html", "text", "json", "pdf", "any"]),
  brandName: z.string().min(1),
  tone: z.string().min(1),
  layout: z.string().min(1),
  sections: z.array(z.string()).min(1),
  includeMetadata: z.boolean(),
  includeSources: z.boolean(),
  includeAssumptions: z.boolean(),
  includeOpenQuestions: z.boolean(),
  includeHumanConfirmations: z.boolean(),
  includeConfidenceSummary: z.boolean(),
  createdAt: z.string(),
  version: z.string().min(1),
});

export type DeliverableTemplate = z.infer<typeof DeliverableTemplateSchema>;

export const DeliverableTemplateSummarySchema = DeliverableTemplateSchema.omit({
  version: true,
});

export type DeliverableTemplateSummary = z.infer<typeof DeliverableTemplateSummarySchema>;
