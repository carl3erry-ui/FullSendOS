import { z } from "zod";

export const DataRoomSchema = z.object({
  id: z.string().min(1),
  clientId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(""),
  createdAt: z.string(),
  updatedAt: z.string(),
  folderCount: z.number().int().min(0).default(0),
  fileCount: z.number().int().min(0).default(0)
});

export const DataRoomFolderSchema = z.object({
  id: z.string().min(1),
  clientId: z.string().min(1),
  dataRoomId: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().default(""),
  category: z.string().default("general"),
  sortOrder: z.number().int().min(0).default(0),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const FileStatusSchema = z.enum([
  "uploaded",
  "registered",
  "processing_pending",
  "ready",
  "rejected"
]);

export const FileVisibilitySchema = z.enum([
  "internal",
  "client_visible_later"
]);

export const DataRoomFileSchema = z.object({
  id: z.string().min(1),
  clientId: z.string().min(1),
  dataRoomId: z.string().min(1),
  folderId: z.string().min(1),
  engagementId: z.string().optional(),
  originalFilename: z.string().min(1),
  displayName: z.string().min(1),
  mimeType: z.string().default("application/octet-stream"),
  extension: z.string().default(""),
  sizeBytes: z.number().int().min(0).default(0),
  storagePath: z.string().default(""),
  uploadedBy: z.string().default("admin"),
  uploadedAt: z.string(),
  updatedAt: z.string(),
  description: z.string().optional(),
  tags: z.array(z.string()).default([]),
  status: FileStatusSchema.default("uploaded"),
  visibility: FileVisibilitySchema.default("internal"),
  approvedForAgentUse: z.boolean().default(false),
  sensitive: z.boolean().default(false),
  sourceType: z.enum(["upload", "registered"]).default("upload"),
  checksum: z.string().optional(),
  metadata: z.record(z.unknown()).default({})
});
