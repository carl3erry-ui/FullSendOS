import { promises as fs } from "node:fs";
import {
  DataRoomDocument,
  DataRoomDocumentSafe,
  DataRoomDocumentProcessingStatus,
} from "../schemas/client-data-room";
import { getFileReference } from "./client-data-room-store";
import {
  getDataRoomDocumentByFileId,
  upsertDataRoomDocument,
  toSafeDataRoomDocument,
} from "./data-room-document-store";
import { inferExtension, parseDataRoomDocument } from "./data-room-document-parser";

const PARSER_VERSION = "slice12-v1";

function nowIso(): string {
  return new Date().toISOString();
}

async function writeStatusDocument(params: {
  existing?: DataRoomDocument | null;
  clientId: string;
  fileId: string;
  engagementId?: string;
  folderId: string;
  originalFilename: string;
  displayName: string;
  mimeType: string;
  extension: string;
  sourceType: string;
  status: DataRoomDocumentProcessingStatus;
  approvedForAgentUse: boolean;
  sensitive: boolean;
  summary: string;
  warnings: string[];
  processingStartedAt?: string;
  processingCompletedAt?: string;
  textExtracted?: string;
  textPreview?: string;
  textLength?: number;
  keywords?: string[];
  detectedDocumentType?: string;
  confidence?: number;
}): Promise<DataRoomDocument> {
  return upsertDataRoomDocument(params.clientId, {
    id: params.existing?.id,
    fileId: params.fileId,
    clientId: params.clientId,
    engagementId: params.engagementId,
    folderId: params.folderId,
    originalFilename: params.originalFilename,
    displayName: params.displayName,
    mimeType: params.mimeType,
    extension: params.extension || "unknown",
    sourceType: params.sourceType,
    processingStatus: params.status,
    processingStartedAt: params.processingStartedAt,
    processingCompletedAt: params.processingCompletedAt,
    parserVersion: PARSER_VERSION,
    textExtracted: params.textExtracted,
    textPreview: params.textPreview || "",
    textLength: params.textLength || 0,
    summary: params.summary,
    keywords: params.keywords || [],
    detectedDocumentType: params.detectedDocumentType || "unknown",
    confidence: params.confidence ?? 0,
    extractionWarnings: params.warnings,
    approvedForAgentUse: params.approvedForAgentUse,
    sensitive: params.sensitive,
  });
}

export async function processDataRoomFile(
  clientId: string,
  fileId: string,
  options: { engagementId?: string } = {}
): Promise<DataRoomDocumentSafe> {
  const fileRef = await getFileReference(clientId, fileId);
  if (!fileRef) {
    throw new Error("File not found");
  }

  if (options.engagementId && !fileRef.engagementIds.includes(options.engagementId)) {
    throw new Error("File not linked to engagement");
  }

  const existing = await getDataRoomDocumentByFileId(clientId, fileId);
  const extension = inferExtension(fileRef.name, fileRef.mimeType).toLowerCase();
  const startedAt = nowIso();

  if (fileRef.sensitive) {
    const skippedSensitive = await writeStatusDocument({
      existing,
      clientId,
      fileId,
      engagementId: options.engagementId || fileRef.engagementIds[0],
      folderId: fileRef.folderId,
      originalFilename: fileRef.name,
      displayName: fileRef.name,
      mimeType: fileRef.mimeType,
      extension,
      sourceType: "client_data_room_upload",
      status: "skipped",
      approvedForAgentUse: fileRef.approvedForAgentUse,
      sensitive: fileRef.sensitive,
      summary: "Sensitive files are not processed in this slice.",
      warnings: ["sensitive_file_skipped"],
      processingStartedAt: startedAt,
      processingCompletedAt: nowIso(),
    });

    return toSafeDataRoomDocument(skippedSensitive);
  }

  if (!fileRef.approvedForAgentUse) {
    const skippedUnapproved = await writeStatusDocument({
      existing,
      clientId,
      fileId,
      engagementId: options.engagementId || fileRef.engagementIds[0],
      folderId: fileRef.folderId,
      originalFilename: fileRef.name,
      displayName: fileRef.name,
      mimeType: fileRef.mimeType,
      extension,
      sourceType: "client_data_room_upload",
      status: "skipped",
      approvedForAgentUse: fileRef.approvedForAgentUse,
      sensitive: fileRef.sensitive,
      summary: "File must be approved for agent use before processing.",
      warnings: ["not_approved_for_agent_use"],
      processingStartedAt: startedAt,
      processingCompletedAt: nowIso(),
    });

    return toSafeDataRoomDocument(skippedUnapproved);
  }

  await writeStatusDocument({
    existing,
    clientId,
    fileId,
    engagementId: options.engagementId || fileRef.engagementIds[0],
    folderId: fileRef.folderId,
    originalFilename: fileRef.name,
    displayName: fileRef.name,
    mimeType: fileRef.mimeType,
    extension,
    sourceType: "client_data_room_upload",
    status: "processing",
    approvedForAgentUse: fileRef.approvedForAgentUse,
    sensitive: fileRef.sensitive,
    summary: "Processing file.",
    warnings: [],
    processingStartedAt: startedAt,
  });

  try {
    const fileBuffer = await fs.readFile(fileRef.storagePath);
    const result = parseDataRoomDocument({
      filename: fileRef.name,
      mimeType: fileRef.mimeType,
      buffer: fileBuffer,
    });

    const finalized = await writeStatusDocument({
      existing,
      clientId,
      fileId,
      engagementId: options.engagementId || fileRef.engagementIds[0],
      folderId: fileRef.folderId,
      originalFilename: fileRef.name,
      displayName: fileRef.name,
      mimeType: fileRef.mimeType,
      extension,
      sourceType: "client_data_room_upload",
      status: result.status,
      approvedForAgentUse: fileRef.approvedForAgentUse,
      sensitive: fileRef.sensitive,
      summary: result.summary,
      warnings: result.warnings,
      processingStartedAt: startedAt,
      processingCompletedAt: nowIso(),
      textExtracted: result.textExtracted,
      textPreview: result.textPreview,
      textLength: result.textLength,
      keywords: result.keywords,
      detectedDocumentType: result.detectedDocumentType,
      confidence: result.confidence,
    });

    return toSafeDataRoomDocument(finalized);
  } catch {
    const failed = await writeStatusDocument({
      existing,
      clientId,
      fileId,
      engagementId: options.engagementId || fileRef.engagementIds[0],
      folderId: fileRef.folderId,
      originalFilename: fileRef.name,
      displayName: fileRef.name,
      mimeType: fileRef.mimeType,
      extension,
      sourceType: "client_data_room_upload",
      status: "failed",
      approvedForAgentUse: fileRef.approvedForAgentUse,
      sensitive: fileRef.sensitive,
      summary: "Failed to process file safely.",
      warnings: ["processing_failed"],
      processingStartedAt: startedAt,
      processingCompletedAt: nowIso(),
    });

    return toSafeDataRoomDocument(failed);
  }
}
