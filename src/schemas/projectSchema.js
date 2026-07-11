import { z } from "zod";
import { SourceSchema } from "./common.js";
import {
  ResearchOutputSchema,
  CompetitorOutputSchema,
  CustomerOutputSchema,
  StrategyOutputSchema,
  BrandOutputSchema,
  WebsiteOutputSchema,
  PublisherOutputSchema
} from "../contracts/departmentContracts.js";

export const ProjectStatusSchema = z.enum([
  "draft",
  "running",
  "needs-review",
  "complete",
  "failed"
]);

export const ProjectSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  id: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),
  status: ProjectStatusSchema,

  client: z.object({
    companyName: z.string().min(1),
    contactName: z.string().optional(),
    website: z.string().url().optional(),
    industry: z.string().optional(),
    geography: z.array(z.string()).default([])
  }),

  brief: z.object({
    objective: z.string().min(1),
    audience: z.array(z.string()).default([]),
    requestedDeliverables: z.array(z.string()).default([]),
    knownFacts: z.array(z.string()).default([]),
    constraints: z.array(z.string()).default([]),
    clientProvidedContext: z.string().default("")
  }),

  evidence: z.object({
    sources: z.array(SourceSchema).default([]),
    sourcePolicy: z.object({
      requireSourcesForFacts: z.literal(true),
      allowUnsourcedEstimates: z.literal(true),
      labelAssumptions: z.literal(true)
    })
  }),

  departments: z.object({
    research: ResearchOutputSchema.nullable(),
    competitors: CompetitorOutputSchema.nullable(),
    customers: CustomerOutputSchema.nullable(),
    strategy: StrategyOutputSchema.nullable(),
    brand: BrandOutputSchema.nullable(),
    website: WebsiteOutputSchema.nullable(),
    publishing: PublisherOutputSchema.nullable()
  }),

  deliverables: z.object({
    executiveReport: z.string().optional(),
    onePageSummary: z.string().optional(),
    deckOutline: z.array(z.object({
      slide: z.number().int().positive(),
      title: z.string(),
      purpose: z.string(),
      keyPoints: z.array(z.string())
    })).default([])
  }),

  audit: z.object({
    runs: z.array(z.object({
      department: z.string(),
      startedAt: z.string(),
      completedAt: z.string().optional(),
      status: z.enum(["running", "complete", "failed", "repaired"]),
      model: z.string().optional(),
      error: z.string().optional()
    })).default([]),
    warnings: z.array(z.string()).default([])
  })
});

export function createEmptyProject(input) {
  const now = new Date().toISOString();
  const slug = input.companyName
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 18) || "PROJECT";

  return ProjectSchema.parse({
    schemaVersion: "1.0.0",
    id: `${slug}-${Date.now()}`,
    createdAt: now,
    updatedAt: now,
    status: "draft",
    client: {
      companyName: input.companyName,
      contactName: input.contactName,
      website: input.website,
      industry: input.industry,
      geography: input.geography ?? []
    },
    brief: {
      objective: input.objective,
      audience: input.audience ?? [],
      requestedDeliverables: input.requestedDeliverables ?? ["executive-report"],
      knownFacts: input.knownFacts ?? [],
      constraints: input.constraints ?? [],
      clientProvidedContext: input.clientProvidedContext ?? ""
    },
    evidence: {
      sources: input.sources ?? [],
      sourcePolicy: {
        requireSourcesForFacts: true,
        allowUnsourcedEstimates: true,
        labelAssumptions: true
      }
    },
    departments: {
      research: null,
      competitors: null,
      customers: null,
      strategy: null,
      brand: null,
      website: null,
      publishing: null
    },
    deliverables: { deckOutline: [] },
    audit: { runs: [], warnings: [] }
  });
}
