import { z } from "zod";

export const IntelligenceResultSchema = z.object({
  marketSummary: z.string(),
  competitors: z.array(z.string()),
  evidence: z.array(z.string()),
  assumptions: z.array(z.string()),
  risks: z.array(z.string()),
  openQuestions: z.array(z.string()),
});

export const StrategyResultSchema = z.object({
  positioning: z.string(),
  targetCustomers: z.array(z.string()),
  valueProposition: z.string(),
  recommendations: z.array(z.string()),
  priorities: z.array(z.string()),
  actionPlan: z.array(z.string()),
});

export const CreativeResultSchema = z.object({
  messaging: z.array(z.string()),
  brandDirection: z.string(),
  websiteDirection: z.string(),
  campaignConcepts: z.array(z.string()),
  creativeRecommendations: z.array(z.string()),
});

export const PublishingResultSchema = z.object({
  executiveSummary: z.string(),
  reportSections: z.array(z.string()),
  keyRecommendations: z.array(z.string()),
  nextSteps: z.array(z.string()),
  deliverableOutline: z.array(z.string()),
});

export type IntelligenceResult = z.infer<typeof IntelligenceResultSchema>;
export type StrategyResult = z.infer<typeof StrategyResultSchema>;
export type CreativeResult = z.infer<typeof CreativeResultSchema>;
export type PublishingResult = z.infer<typeof PublishingResultSchema>;
