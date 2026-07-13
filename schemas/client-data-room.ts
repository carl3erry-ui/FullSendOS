import { z } from "zod";

/**
 * Client Data Room Foundation (Epic 1)
 *
 * File-based storage for client-provided evidence, documents, and supporting materials.
 * Enables structured evidence collection without external integrations.
 *
 * Scope: File metadata + references only. No external integrations, no prompt wiring.
 */

export const FileReferenceSchema = z.object({
  id: z.string().min(1).describe("Unique file ID (UUID or slug)"),
  name: z.string().min(1).describe("Original filename"),
  type: z.enum([
    "document",
    "research",
    "contract",
    "financial",
    "correspondence",
    "media",
    "other"
  ]).describe("File classification for organization"),
  mimeType: z.string().describe("MIME type (e.g., 'application/pdf')"),
  size: z.number().int().positive().describe("File size in bytes"),
  uploadedAt: z.string().describe("ISO timestamp of upload"),
  uploadedBy: z.string().min(1).describe("User/system identifier who uploaded"),
  description: z.string().optional().describe("Optional context about the file"),
  tags: z.array(z.string()).default([]).describe("User-provided classification tags"),
  engagementId: z.string().min(1).describe("Associated engagement ID"),
  storagePath: z.string().min(1).describe("Internal storage location (do not expose raw content path)"),
  isArchived: z.boolean().default(false).describe("Soft-delete flag")
});

export const ClientDataRoomSchema = z.object({
  engagementId: z.string().min(1),
  files: z.array(FileReferenceSchema).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
  fileCount: z.number().int().nonnegative().default(0),
  totalSize: z.number().int().nonnegative().default(0)
});

export type FileReference = z.infer<typeof FileReferenceSchema>;
export type ClientDataRoom = z.infer<typeof ClientDataRoomSchema>;

/**
 * Safe API response type (excludes storagePath)
 */
export const FileReferenceSafeSchema = FileReferenceSchema.omit({ storagePath: true });
export type FileReferenceSafe = z.infer<typeof FileReferenceSafeSchema>;

/**
 * Upload request (multipart handled by route)
 */
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
  ]).optional()
});

export type FileUploadRequest = z.infer<typeof FileUploadRequestSchema>;
