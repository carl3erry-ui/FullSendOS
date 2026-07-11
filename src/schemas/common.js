import { z } from "zod";

export const SourceSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  url: z.string().url().optional(),
  publisher: z.string().optional(),
  publishedAt: z.string().optional(),
  accessedAt: z.string().optional(),
  sourceType: z.enum([
    "official",
    "government",
    "company",
    "news",
    "industry",
    "academic",
    "client-provided",
    "other"
  ]),
  notes: z.string().optional()
});

export const ClaimSchema = z.object({
  statement: z.string().min(1),
  classification: z.enum(["fact", "estimate", "assumption", "recommendation"]),
  confidence: z.number().min(0).max(1),
  sourceIds: z.array(z.string()).default([]),
  caveat: z.string().optional()
}).superRefine((claim, ctx) => {
  if (claim.classification === "fact" && claim.sourceIds.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Facts require at least one sourceId."
    });
  }
});

export const MetricSchema = z.object({
  name: z.string(),
  value: z.union([z.string(), z.number()]),
  unit: z.string().optional(),
  period: z.string().optional(),
  classification: z.enum(["fact", "estimate", "assumption"]),
  confidence: z.number().min(0).max(1),
  sourceIds: z.array(z.string()).default([])
}).superRefine((metric, ctx) => {
  if (metric.classification === "fact" && metric.sourceIds.length === 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Factual metrics require a sourceId." });
  }
});

export const UnknownSchema = z.object({
  question: z.string(),
  whyItMatters: z.string(),
  recommendedMethod: z.string()
});
