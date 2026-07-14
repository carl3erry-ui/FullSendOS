import { z } from "zod";
import { DeliverableTemplateIdSchema } from "./deliverable-template";

export const DeliverableExportFormatSchema = z.enum(["markdown", "html", "text", "json"]);
export type DeliverableExportFormat = z.infer<typeof DeliverableExportFormatSchema>;

export const DeliverableExportStatusSchema = z.enum(["created", "failed"]);
export type DeliverableExportStatus = z.infer<typeof DeliverableExportStatusSchema>;

export const DeliverableExportMetadataSchema = z.object({
  generatedBy: z.literal("FullSendOS"),
  generatedAt: z.string(),
  engagementTitle: z.string(),
  clientName: z.string().optional(),
  includedSections: z.array(z.string()),
  evidenceReferenceCount: z.number().int().nonnegative(),
  assumptionCount: z.number().int().nonnegative(),
  openQuestionCount: z.number().int().nonnegative(),
  humanConfirmationCount: z.number().int().nonnegative(),
  confidenceSummary: z.object({
    level: z.enum(["high", "medium", "low", "pending"]),
    score: z.number().min(0).max(1).nullable(),
    rationale: z.string(),
  }).optional(),
  limitations: z.array(z.string()).default([]),
});
export type DeliverableExportMetadata = z.infer<typeof DeliverableExportMetadataSchema>;

export const DeliverableExportSafetySummarySchema = z.object({
  hiddenReasoningExcluded: z.literal(true),
  providerPayloadExcluded: z.literal(true),
  storagePathExcluded: z.literal(true),
  fullExtractedTextExcluded: z.literal(true),
  stackTraceExcluded: z.literal(true),
  apiKeyExcluded: z.literal(true),
  privatePromptExcluded: z.literal(true),
});
export type DeliverableExportSafetySummary = z.infer<typeof DeliverableExportSafetySummarySchema>;

export const DeliverableExportSchema = z.object({
  id: z.string().min(1),
  engagementId: z.string().min(1),
  clientId: z.string().optional(),
  format: DeliverableExportFormatSchema,
  templateId: DeliverableTemplateIdSchema,
  templateName: z.string().min(1),
  templateVersion: z.string().min(1),
  filename: z.string().min(1),
  title: z.string().min(1),
  status: DeliverableExportStatusSchema,
  createdAt: z.string(),
  generatedAt: z.string(),
  sourceWorkProductId: z.string().optional(),
  contentType: z.string().min(1),
  byteSize: z.number().int().nonnegative(),
  checksum: z.string().optional(),
  exportMetadata: DeliverableExportMetadataSchema,
  safetySummary: DeliverableExportSafetySummarySchema,
  content: z.string(),
  error: z.string().optional(),
});
export type DeliverableExport = z.infer<typeof DeliverableExportSchema>;

export const DeliverableExportSummarySchema = DeliverableExportSchema.omit({ content: true });
export type DeliverableExportSummary = z.infer<typeof DeliverableExportSummarySchema>;

export const DeliverableExportCreateInputSchema = z.object({
  format: DeliverableExportFormatSchema,
  templateId: DeliverableTemplateIdSchema.optional(),
});
export type DeliverableExportCreateInput = z.infer<typeof DeliverableExportCreateInputSchema>;
