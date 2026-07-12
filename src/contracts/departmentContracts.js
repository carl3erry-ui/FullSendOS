import { z } from "zod";
import { ClaimSchema, MetricSchema, UnknownSchema } from "../schemas/common.js";

const BaseOutput = {
  summary: z.string().min(1),
  claims: z.array(ClaimSchema).default([]),
  unknowns: z.array(UnknownSchema).default([]),
  sourceIdsUsed: z.array(z.string()).default([])
};

export const ResearchOutputSchema = z.object({
  ...BaseOutput,
  industryDefinition: z.string(),
  marketContext: z.array(z.string()),
  trends: z.array(z.object({
    name: z.string(),
    direction: z.enum(["growing", "stable", "declining", "uncertain"]),
    implication: z.string(),
    sourceIds: z.array(z.string()).default([])
  })),
  metrics: z.array(MetricSchema),
  opportunities: z.array(z.string()),
  risks: z.array(z.string())
});

export const CompetitorOutputSchema = z.object({
  ...BaseOutput,
  competitors: z.array(z.object({
    name: z.string(),
    category: z.string(),
    geography: z.string().optional(),
    positioning: z.string(),
    strengths: z.array(z.string()),
    weaknesses: z.array(z.string()),
    pricing: z.object({
      value: z.string(),
      classification: z.enum(["fact", "estimate", "unknown"]),
      sourceIds: z.array(z.string()).default([])
    }),
    sourceIds: z.array(z.string()).default([])
  })),
  comparisonDimensions: z.array(z.string()),
  whitespace: z.array(z.string()),
  recommendedPosition: z.string()
});

export const CustomerOutputSchema = z.object({
  ...BaseOutput,
  personas: z.array(z.object({
    name: z.string(),
    segment: z.string(),
    description: z.string(),
    goals: z.array(z.string()),
    painPoints: z.array(z.string()),
    buyingTriggers: z.array(z.string()),
    objections: z.array(z.string()),
    channels: z.array(z.string()),
    evidenceLevel: z.enum(["validated", "inferred", "hypothesis"])
  })),
  customerJourney: z.array(z.object({
    stage: z.string(),
    customerQuestion: z.string(),
    recommendedResponse: z.string(),
    primaryChannel: z.string()
  }))
});

export const StrategyOutputSchema = z.object({
  ...BaseOutput,
  strategicThesis: z.string(),
  positioningStatement: z.string(),
  valueProposition: z.string(),
  strategicPillars: z.array(z.object({
    name: z.string(),
    rationale: z.string(),
    actions: z.array(z.string()),
    kpis: z.array(z.string())
  })),
  goToMarket: z.array(z.object({
    phase: z.string(),
    timing: z.string(),
    objective: z.string(),
    actions: z.array(z.string())
  })),
  ninetyDayPlan: z.array(z.object({
    priority: z.number().int().positive(),
    action: z.string(),
    ownerRole: z.string(),
    timing: z.string(),
    successMeasure: z.string()
  }))
});

export const BrandOutputSchema = z.object({
  ...BaseOutput,
  brandEssence: z.string(),
  mission: z.string(),
  vision: z.string(),
  values: z.array(z.string()),
  personality: z.array(z.string()),
  voice: z.object({
    attributes: z.array(z.string()),
    do: z.array(z.string()),
    avoid: z.array(z.string())
  }),
  messaging: z.object({
    taglineOptions: z.array(z.string()),
    elevatorPitch: z.string(),
    proofPoints: z.array(z.string())
  }),
  visualDirection: z.object({
    palette: z.array(z.object({ name: z.string(), hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/) })),
    typographyDirection: z.array(z.string()),
    imageryDirection: z.array(z.string())
  })
});

export const WebsiteOutputSchema = z.object({
  ...BaseOutput,
  primaryGoal: z.string(),
  targetActions: z.array(z.string()),
  sitemap: z.array(z.object({
    page: z.string(),
    purpose: z.string(),
    sections: z.array(z.string()),
    primaryCta: z.string()
  })),
  homepageWireframe: z.array(z.object({
    order: z.number().int().positive(),
    section: z.string(),
    objective: z.string(),
    content: z.array(z.string()),
    cta: z.string().optional()
  })),
  imagePrompts: z.array(z.object({
    use: z.string(),
    prompt: z.string(),
    aspectRatio: z.string()
  })),
  technicalRecommendations: z.array(z.string())
});

export const PublisherOutputSchema = z.object({
  ...BaseOutput,
  reportTitle: z.string(),
  subtitle: z.string(),
  executiveSummary: z.string(),
  keyFindings: z.array(z.string()),
  recommendations: z.array(z.object({
    priority: z.enum(["immediate", "near-term", "long-term"]),
    recommendation: z.string(),
    rationale: z.string(),
    successMeasure: z.string()
  })),
  reportMarkdown: z.string().min(1, "Publishing must include reportMarkdown."),
  onePageSummary: z.string().min(1, "Publishing must include onePageSummary."),
  deckOutline: z.array(z.object({
    slide: z.number().int().positive(),
    title: z.string().min(1),
    purpose: z.string().min(1),
    keyPoints: z.array(z.string().min(1)).min(1)
  })).min(1, "Publishing must include deckOutline with at least one slide.")
});

export const DepartmentContracts = {
  research: {
    schema: ResearchOutputSchema,
    dependsOn: [],
    role: "Senior market intelligence researcher",
    objective: "Establish sourced market context without inventing company-specific facts."
  },
  competitors: {
    schema: CompetitorOutputSchema,
    dependsOn: ["research"],
    role: "Competitive intelligence director",
    objective: "Compare verified competitors and clearly label estimates or unknowns."
  },
  customers: {
    schema: CustomerOutputSchema,
    dependsOn: ["research", "competitors"],
    role: "Customer insights strategist",
    objective: "Create evidence-aware customer profiles and a usable customer journey."
  },
  strategy: {
    schema: StrategyOutputSchema,
    dependsOn: ["research", "competitors", "customers"],
    role: "Chief strategy officer",
    objective: "Turn evidence into positioning, priorities, KPIs, and a 90-day plan."
  },
  brand: {
    schema: BrandOutputSchema,
    dependsOn: ["strategy", "customers"],
    role: "Senior brand strategist",
    objective: "Translate the strategy into a coherent verbal and visual brand system."
  },
  website: {
    schema: WebsiteOutputSchema,
    dependsOn: ["strategy", "brand", "customers"],
    role: "Digital experience and conversion director",
    objective: "Create a conversion-focused site concept grounded in the approved strategy."
  },
  publishing: {
    schema: PublisherOutputSchema,
    dependsOn: ["research", "competitors", "customers", "strategy", "brand", "website"],
    role: "Executive editor at a premium strategy consultancy",
    objective: "Produce one client-ready deliverable that distinguishes facts, estimates, assumptions, and recommendations."
  }
};

export function buildDepartmentPrompt({ department, project }) {
  const contract = DepartmentContracts[department];
  const dependencies = Object.fromEntries(
    contract.dependsOn.map(key => [key, project.departments[key]])
  );

  const compactPublishingDependencies = department === "publishing"
    ? {
        research: {
          summary: dependencies.research?.summary,
          opportunities: dependencies.research?.opportunities || [],
          risks: dependencies.research?.risks || [],
          unknowns: dependencies.research?.unknowns || []
        },
        competitors: {
          summary: dependencies.competitors?.summary,
          whitespace: dependencies.competitors?.whitespace || [],
          recommendedPosition: dependencies.competitors?.recommendedPosition,
          unknowns: dependencies.competitors?.unknowns || []
        },
        customers: {
          summary: dependencies.customers?.summary,
          personas: (dependencies.customers?.personas || []).slice(0, 5),
          unknowns: dependencies.customers?.unknowns || []
        },
        strategy: {
          summary: dependencies.strategy?.summary,
          strategicThesis: dependencies.strategy?.strategicThesis,
          strategicPillars: dependencies.strategy?.strategicPillars || [],
          ninetyDayPlan: dependencies.strategy?.ninetyDayPlan || [],
          unknowns: dependencies.strategy?.unknowns || []
        },
        brand: {
          summary: dependencies.brand?.summary,
          brandEssence: dependencies.brand?.brandEssence,
          messaging: dependencies.brand?.messaging || {},
          unknowns: dependencies.brand?.unknowns || []
        },
        website: {
          summary: dependencies.website?.summary,
          primaryGoal: dependencies.website?.primaryGoal,
          targetActions: dependencies.website?.targetActions || [],
          sitemap: dependencies.website?.sitemap || [],
          unknowns: dependencies.website?.unknowns || []
        }
      }
    : dependencies;

  const promptProject = department === "publishing"
    ? {
        client: project.client,
        brief: {
          objective: project.brief?.objective,
          audience: project.brief?.audience || [],
          requestedDeliverables: project.brief?.requestedDeliverables || [],
          constraints: project.brief?.constraints || [],
          knownFacts: project.brief?.knownFacts || [],
        },
        evidence: {
          sourcePolicy: project.evidence?.sourcePolicy,
          sources: (project.evidence?.sources || []).map((source) => ({
            id: source.id,
            title: source.title,
            publisher: source.publisher,
            sourceType: source.sourceType,
          }))
        },
        dependencies: compactPublishingDependencies
      }
    : {
        client: project.client,
        brief: project.brief,
        evidence: project.evidence,
        dependencies
      };

  const researchShapeInstruction = department === "research"
    ? `
RESEARCH JSON SHAPE (MUST MATCH EXACTLY)
- summary: string
- claims: array of { statement: string, classification: "fact"|"estimate"|"assumption"|"recommendation", confidence: number 0..1, sourceIds: string[], caveat?: string }
- unknowns: array of { question: string, whyItMatters: string, recommendedMethod: string }
- sourceIdsUsed: string[]
- industryDefinition: string
- marketContext: string[]
- trends: array of { name: string, direction: "growing"|"stable"|"declining"|"uncertain", implication: string, sourceIds: string[] }
- metrics: array of { name: string, value: string|number, unit?: string, period?: string, classification: "fact"|"estimate"|"assumption", confidence: number 0..1, sourceIds: string[] }
- opportunities: string[]
- risks: string[]

STRICT TYPE RULES
- Do not return objects where a string[] is required.
- Do not return "unknown" for metrics.classification.
- Do not omit unknowns.question, unknowns.whyItMatters, or unknowns.recommendedMethod.
`
    : "";

  const publishingShapeInstruction = department === "publishing"
    ? `
PUBLISHING JSON SHAPE (MUST MATCH EXACTLY)
- summary: string (non-empty)
- claims: array
- unknowns: array
- sourceIdsUsed: string[]
- reportTitle: string (non-empty)
- subtitle: string (non-empty)
- executiveSummary: string (non-empty)
- keyFindings: string[]
- recommendations: array of { priority: "immediate"|"near-term"|"long-term", recommendation: string, rationale: string, successMeasure: string }
- reportMarkdown: string (non-empty markdown)
- onePageSummary: string (non-empty executive decision brief)
- deckOutline: array with at least 1 item
  each item: { slide: positive integer, title: string, purpose: string, keyPoints: string[] }

PUBLISHING STRICT RULES
- Return exactly one JSON object and nothing else.
- Do not omit required fields, even when evidence is limited.
- Do not use alternate field names for required deliverables.
- Disclose uncertainty and evidence gaps within the required fields instead of omitting fields.
- Never invent unsupported facts.
`
    : "";

  return `You are the ${contract.role}.

OBJECTIVE
${contract.objective}

NON-NEGOTIABLE RULES
1. Return JSON only. No markdown fences and no commentary outside JSON.
2. Never invent a company location, facility, track, price, financial result, owner, customer count, or capability.
3. A factual claim must cite one or more source IDs already present in the project evidence.
4. When evidence is missing, classify the statement as an estimate, assumption, recommendation, or unknown.
5. Keep sourceIdsUsed limited to source IDs that actually appear in the supplied project.
6. Prefer explicit uncertainty over false precision.
7. Produce data that is useful in a client deliverable, not internal chain-of-thought.
${researchShapeInstruction}
${publishingShapeInstruction}

PROJECT
${JSON.stringify(promptProject, null, 2)}

Return an object matching the required contract for department: ${department}.`;
}
