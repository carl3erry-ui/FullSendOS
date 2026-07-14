import { z } from "zod";

const MAX_DEFAULT_DOCUMENTS = 5;
const MAX_DEFAULT_EXCERPTS = 12;
const MAX_DEFAULT_EXCERPT_CHARS = 280;
const MAX_DEFAULT_TOTAL_CHARS = 2400;

export const DataRoomRetrievalRequestSchema = z.object({
  clientId: z.string().min(1),
  engagementId: z.string().min(1).optional(),
  agentId: z.string().min(1),
  taskId: z.string().min(1),
  query: z.string().default(""),
  documentTypes: z.array(z.string()).default([]),
  folderIds: z.array(z.string()).default([]),
  fileIds: z.array(z.string()).default([]),
  keywords: z.array(z.string()).default([]),
  maxDocuments: z.number().int().positive().max(20).default(MAX_DEFAULT_DOCUMENTS),
  maxExcerpts: z.number().int().positive().max(40).default(MAX_DEFAULT_EXCERPTS),
  maxCharacters: z.number().int().positive().max(1000).default(MAX_DEFAULT_EXCERPT_CHARS),
  maxTotalCharacters: z
    .number()
    .int()
    .positive()
    .max(20_000)
    .default(MAX_DEFAULT_TOTAL_CHARS),
  includeSummaries: z.boolean().default(true),
  includePreviews: z.boolean().default(true),
  allowSensitive: z.boolean().default(false),
});

export type DataRoomRetrievalRequest = z.infer<typeof DataRoomRetrievalRequestSchema>;

export const DataRoomSourceReferenceSchema = z.object({
  sourceId: z.string().min(1),
  documentId: z.string().min(1),
  fileId: z.string().min(1),
  clientId: z.string().min(1),
  engagementId: z.string().optional(),
  displayName: z.string().min(1),
  folderId: z.string().min(1),
  detectedDocumentType: z.string().min(1),
  processingStatus: z.string().min(1),
  approvedForAgentUse: z.boolean(),
  sensitive: z.boolean(),
  citationLabel: z.string().min(1),
});

export type DataRoomSourceReference = z.infer<typeof DataRoomSourceReferenceSchema>;

export const DataRoomExcerptSchema = z.object({
  documentId: z.string().min(1),
  fileId: z.string().min(1),
  citationLabel: z.string().min(1),
  text: z.string().min(1),
  characterCount: z.number().int().positive(),
  basis: z.enum(["keyword", "summary", "preview", "heuristic"]),
  confidence: z.number().min(0).max(1),
});

export type DataRoomExcerpt = z.infer<typeof DataRoomExcerptSchema>;

export const DataRoomRetrievalSkippedDocumentSchema = z.object({
  documentId: z.string().min(1),
  fileId: z.string().min(1),
  reason: z.string().min(1),
});

export type DataRoomRetrievalSkippedDocument = z.infer<
  typeof DataRoomRetrievalSkippedDocumentSchema
>;

export const DataRoomRetrievalResultSchema = z.object({
  sources: z.array(DataRoomSourceReferenceSchema),
  excerpts: z.array(DataRoomExcerptSchema),
  summaries: z
    .array(
      z.object({
        sourceId: z.string().min(1),
        summary: z.string().min(1),
      })
    )
    .default([]),
  skippedDocuments: z.array(DataRoomRetrievalSkippedDocumentSchema).default([]),
  warnings: z.array(z.string()).default([]),
  retrievalAuditId: z.string().min(1),
  totalCharacters: z.number().int().nonnegative(),
  confidence: z.number().min(0).max(1),
});

export type DataRoomRetrievalResult = z.infer<typeof DataRoomRetrievalResultSchema>;

export const AgentTaskDataRoomRetrievalConfigSchema = z.object({
  enabled: z.boolean().default(false),
  clientId: z.string().min(1).optional(),
  query: z.string().optional(),
  documentTypes: z.array(z.string()).optional(),
  folderIds: z.array(z.string()).optional(),
  fileIds: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional(),
  maxDocuments: z.number().int().positive().max(20).optional(),
  maxExcerpts: z.number().int().positive().max(40).optional(),
  maxCharacters: z.number().int().positive().max(1000).optional(),
  maxTotalCharacters: z.number().int().positive().max(20_000).optional(),
  includeSummaries: z.boolean().optional(),
  includePreviews: z.boolean().optional(),
  allowSensitive: z.boolean().optional(),
});

export type AgentTaskDataRoomRetrievalConfig = z.infer<
  typeof AgentTaskDataRoomRetrievalConfigSchema
>;
