import { z } from "zod";

const StringListSchema = z.array(z.string().trim().min(1)).default([]);

export const DOCUMENT_CHECKLIST = [
  "business plan",
  "menu/product list",
  "financials",
  "pitch deck",
  "website copy",
  "brand guide",
  "market research",
  "lease/property docs",
  "investor docs",
  "SOPs",
  "org chart",
  "other files",
] as const;

export const CompanyOverviewSchema = z.object({
  companyName: z.string().trim().default(""),
  website: z.string().trim().default(""),
  industry: z.string().trim().default(""),
  locationMarketsServed: z.string().trim().default(""),
  currentStage: z.string().trim().default(""),
  teamCount: z.string().trim().default(""),
  locations: StringListSchema,
});

export const BusinessModelSchema = z.object({
  model: z.string().trim().default(""),
  servicesOrProducts: StringListSchema,
  revenueDrivers: StringListSchema,
  majorCosts: StringListSchema,
});

export const CustomersSchema = z.object({
  targetCustomers: z.string().trim().default(""),
  customerSegments: StringListSchema,
  priceSensitivity: z.string().trim().default(""),
  buyingMotivations: StringListSchema,
  keyProblems: StringListSchema,
});

export const GoalsSchema = z.object({
  growthGoal: z.string().trim().default(""),
  engagementPurpose: z.string().trim().default(""),
  desiredDeliverable: z.string().trim().default(""),
  timeline: z.string().trim().default(""),
  finalAudience: z.string().trim().default(""),
  successDefinition: z.string().trim().default(""),
});

export const CompetitorsSchema = z.object({
  knownCompetitors: StringListSchema,
  marketConcerns: StringListSchema,
  advantages: StringListSchema,
  weaknesses: StringListSchema,
});

export const BrandVoiceSchema = z.object({
  tone: z.string().trim().default(""),
  positioning: z.string().trim().default(""),
  writingStyle: z.string().trim().default(""),
  wordsToUse: StringListSchema,
  wordsToAvoid: StringListSchema,
});

export const OperationsSchema = z.object({
  servicesOrProducts: StringListSchema,
  revenueDrivers: StringListSchema,
  majorCosts: StringListSchema,
  constraints: StringListSchema,
  currentBottlenecks: StringListSchema,
});

export const ClientBaselineSchema = z.object({
  clientId: z.string().min(1),
  companyOverview: CompanyOverviewSchema,
  businessModel: BusinessModelSchema,
  markets: StringListSchema,
  customers: CustomersSchema,
  goals: GoalsSchema,
  competitors: CompetitorsSchema,
  brandVoice: BrandVoiceSchema,
  operations: OperationsSchema,
  knownConstraints: StringListSchema,
  availableDocuments: StringListSchema,
  missingDocuments: StringListSchema,
  recommendedEngagementTypes: StringListSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const ClientBaselineUpsertSchema = ClientBaselineSchema.omit({
  clientId: true,
  createdAt: true,
  updatedAt: true,
});

export type ClientBaseline = z.infer<typeof ClientBaselineSchema>;
export type ClientBaselineUpsertInput = z.infer<typeof ClientBaselineUpsertSchema>;

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const raw of values) {
    const normalized = raw.trim();
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    ordered.push(normalized);
  }
  return ordered;
}

export function createEmptyClientBaseline(clientId: string, companyName = ""): ClientBaseline {
  const now = new Date().toISOString();
  return {
    clientId,
    companyOverview: {
      companyName,
      website: "",
      industry: "",
      locationMarketsServed: "",
      currentStage: "",
      teamCount: "",
      locations: [],
    },
    businessModel: {
      model: "",
      servicesOrProducts: [],
      revenueDrivers: [],
      majorCosts: [],
    },
    markets: [],
    customers: {
      targetCustomers: "",
      customerSegments: [],
      priceSensitivity: "",
      buyingMotivations: [],
      keyProblems: [],
    },
    goals: {
      growthGoal: "",
      engagementPurpose: "",
      desiredDeliverable: "",
      timeline: "",
      finalAudience: "",
      successDefinition: "",
    },
    competitors: {
      knownCompetitors: [],
      marketConcerns: [],
      advantages: [],
      weaknesses: [],
    },
    brandVoice: {
      tone: "",
      positioning: "",
      writingStyle: "",
      wordsToUse: [],
      wordsToAvoid: [],
    },
    operations: {
      servicesOrProducts: [],
      revenueDrivers: [],
      majorCosts: [],
      constraints: [],
      currentBottlenecks: [],
    },
    knownConstraints: [],
    availableDocuments: [],
    missingDocuments: [...DOCUMENT_CHECKLIST],
    recommendedEngagementTypes: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function deriveMissingDocuments(availableDocuments: string[]): string[] {
  const available = new Set(availableDocuments.map((item) => item.trim().toLowerCase()).filter(Boolean));
  return DOCUMENT_CHECKLIST.filter((item) => !available.has(item.toLowerCase()));
}

export function deriveRecommendedEngagementTypes(input: ClientBaselineUpsertInput): string[] {
  const suggestions: string[] = [];

  if (input.goals.desiredDeliverable.toLowerCase().includes("investor")) {
    suggestions.push("Investor Narrative and Fundraising Strategy");
  }
  if (input.customers.customerSegments.length > 0 || input.competitors.knownCompetitors.length > 0) {
    suggestions.push("Market Positioning and Growth Strategy");
  }
  if (input.availableDocuments.some((doc) => doc.toLowerCase().includes("financial"))) {
    suggestions.push("Financial Scenario Planning");
  }
  if (input.brandVoice.positioning || input.brandVoice.tone) {
    suggestions.push("Brand and Messaging System");
  }
  if (input.operations.currentBottlenecks.length > 0 || input.knownConstraints.length > 0) {
    suggestions.push("Operational Improvement Roadmap");
  }

  if (suggestions.length === 0) {
    suggestions.push("Executive Baseline Discovery Sprint");
  }

  return uniqueStrings(suggestions);
}

export function normalizeUpsertInput(input: ClientBaselineUpsertInput): ClientBaselineUpsertInput {
  const availableDocuments = uniqueStrings(input.availableDocuments);
  const missingDocuments = input.missingDocuments.length
    ? uniqueStrings(input.missingDocuments)
    : deriveMissingDocuments(availableDocuments);

  return {
    ...input,
    markets: uniqueStrings(input.markets),
    knownConstraints: uniqueStrings(input.knownConstraints),
    availableDocuments,
    missingDocuments,
    recommendedEngagementTypes: input.recommendedEngagementTypes.length
      ? uniqueStrings(input.recommendedEngagementTypes)
      : deriveRecommendedEngagementTypes({ ...input, availableDocuments, missingDocuments }),
  };
}
