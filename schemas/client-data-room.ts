import { z } from "zod";

/**
 * Epic 1.1: Client-Level Data Room
 *
 * File-based storage for client-provided evidence, documents, and supporting materials.
 * Promotes data room from engagement-level to client-level.
 * Files belong to clients and may optionally be linked to engagements.
 */

// ============ Folder Schema ============
export const DataRoomFolderSchema = z.object({
  id: z.string().min(1).describe("Stable folder ID (slug-based)"),
  clientId: z.string().min(1).describe("Client this folder belongs to"),
  name: z.string().min(1).describe("Display name (e.g., 'Financials')"),
  slug: z.string().min(1).describe("URL-safe slug (e.g., 'financials')"),
  description: z.string().optional().describe("Folder description"),
  category: z.enum([
    "financials",
    "brand",
    "legal",
    "operations",
    "marketing",
    "website",
    "investor",
    "real-estate",
    "hr",
    "misc"
  ]).describe("Folder category"),
  sortOrder: z.number().int().nonnegative().describe("Display order"),
  isSystem: z.boolean().default(true).describe("System folder (cannot delete)")
});

export type DataRoomFolder = z.infer<typeof DataRoomFolderSchema>;

// ============ File Reference Schema ============
export const FileReferenceSchema = z.object({
  id: z.string().min(1).describe("Unique file ID"),
  clientId: z.string().min(1).describe("File belongs to this client"),
  folderId: z.string().min(1).describe("File stored in this folder"),
  name: z.string().min(1).describe("Original filename"),
  type: z.enum([
    "document",
    "research",
    "contract",
    "financial",
    "correspondence",
    "media",
    "other"
  ]).describe("File classification"),
  mimeType: z.string().describe("MIME type (e.g., 'application/pdf')"),
  size: z.number().int().positive().describe("File size in bytes"),
  uploadedAt: z.string().describe("ISO timestamp of upload"),
  uploadedBy: z.string().min(1).describe("User/system identifier"),
  description: z.string().optional().describe("File context"),
  tags: z.array(z.string()).default([]).describe("Classification tags"),
  engagementIds: z.array(z.string()).default([]).describe("Optional engagement linkage"),
  storagePath: z.string().min(1).describe("Internal storage path (do not expose)"),
  isArchived: z.boolean().default(false).describe("Soft-delete flag"),
  approvedForAgentUse: z.boolean().default(false).describe("Can agents read this file"),
  sensitive: z.boolean().default(false).describe("Contains sensitive data")
});

export type FileReference = z.infer<typeof FileReferenceSchema>;

// ============ Client Data Room Schema ============
export const ClientDataRoomSchema = z.object({
  clientId: z.string().min(1),
  folders: z.array(DataRoomFolderSchema).default([]),
  files: z.array(FileReferenceSchema).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
  fileCount: z.number().int().nonnegative().default(0),
  totalSize: z.number().int().nonnegative().default(0)
});

export type ClientDataRoom = z.infer<typeof ClientDataRoomSchema>;

// ============ Safe Response Schemas ============
export const FileReferenceSafeSchema = FileReferenceSchema.omit({ storagePath: true });
export type FileReferenceSafe = z.infer<typeof FileReferenceSafeSchema>;

export const DataRoomFolderSafeSchema = DataRoomFolderSchema;
export type DataRoomFolderSafe = z.infer<typeof DataRoomFolderSafeSchema>;

// ============ Request Schemas ============
export const FileUploadRequestSchema = z.object({
  description: z.string().optional(),
  tags: z.array(z.string()).default([]),
  type: z.enum([
    "document",
    "research",
    "contract",
    "financial",
    "correspondence",
    "media",
    "other"
  ]).optional(),
  folderId: z.string().optional(),
  engagementIds: z.array(z.string()).default([]),
  approvedForAgentUse: z.boolean().default(false),
  sensitive: z.boolean().default(false)
});

export type FileUploadRequest = z.infer<typeof FileUploadRequestSchema>;

// ============ Data Room Document Processing Schemas (Slice 12) ============
export const DataRoomDocumentProcessingStatusSchema = z.enum([
  "not_started",
  "queued",
  "processing",
  "completed",
  "failed",
  "skipped",
  "unsupported",
]);

export type DataRoomDocumentProcessingStatus = z.infer<
  typeof DataRoomDocumentProcessingStatusSchema
>;

export const DataRoomDocumentSchema = z.object({
  id: z.string().min(1),
  fileId: z.string().min(1),
  clientId: z.string().min(1),
  engagementId: z.string().optional(),
  folderId: z.string().min(1),
  originalFilename: z.string().min(1),
  displayName: z.string().min(1),
  mimeType: z.string().min(1),
  extension: z.string().min(1),
  sourceType: z.string().min(1),
  processingStatus: DataRoomDocumentProcessingStatusSchema,
  processingStartedAt: z.string().optional(),
  processingCompletedAt: z.string().optional(),
  parserVersion: z.string().min(1),
  // Internal extracted text is intentionally omitted from safe API responses.
  textExtracted: z.string().optional(),
  textPreview: z.string().default(""),
  textLength: z.number().int().nonnegative().default(0),
  summary: z.string().default(""),
  keywords: z.array(z.string()).default([]),
  detectedDocumentType: z.string().default("unknown"),
  confidence: z.number().min(0).max(1).default(0),
  extractionWarnings: z.array(z.string()).default([]),
  approvedForAgentUse: z.boolean().default(false),
  sensitive: z.boolean().default(false),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type DataRoomDocument = z.infer<typeof DataRoomDocumentSchema>;

export const DataRoomDocumentSafeSchema = DataRoomDocumentSchema.omit({
  textExtracted: true,
});

export type DataRoomDocumentSafe = z.infer<typeof DataRoomDocumentSafeSchema>;

// ============ Default Folders ============
export const DEFAULT_FOLDERS: DataRoomFolder[] = [
  { id: "financials", name: "Financials", slug: "financials", category: "financials", sortOrder: 1, isSystem: true, clientId: "", description: "Financial documents and reports" },
  { id: "brand", name: "Brand Assets", slug: "brand", category: "brand", sortOrder: 2, isSystem: true, clientId: "", description: "Logos, brand guidelines, visual assets" },
  { id: "legal", name: "Legal", slug: "legal", category: "legal", sortOrder: 3, isSystem: true, clientId: "", description: "Contracts, agreements, legal documents" },
  { id: "operations", name: "Operations", slug: "operations", category: "operations", sortOrder: 4, isSystem: true, clientId: "", description: "Operational processes and documentation" },
  { id: "marketing", name: "Marketing", slug: "marketing", category: "marketing", sortOrder: 5, isSystem: true, clientId: "", description: "Marketing materials and campaigns" },
  { id: "website", name: "Website", slug: "website", category: "website", sortOrder: 6, isSystem: true, clientId: "", description: "Website designs and content" },
  { id: "investor", name: "Investor Materials", slug: "investor", category: "investor", sortOrder: 7, isSystem: true, clientId: "", description: "Investor decks and financial materials" },
  { id: "real-estate", name: "Real Estate", slug: "real-estate", category: "real-estate", sortOrder: 8, isSystem: true, clientId: "", description: "Property documents and details" },
  { id: "hr", name: "HR / Payroll", slug: "hr", category: "hr", sortOrder: 9, isSystem: true, clientId: "", description: "HR policies and payroll information" },
  { id: "misc", name: "Miscellaneous", slug: "misc", category: "misc", sortOrder: 10, isSystem: true, clientId: "", description: "Other files and materials" }
];
