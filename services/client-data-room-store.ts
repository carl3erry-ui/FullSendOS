import { promises as fs } from "fs";
import path from "path";
import { randomBytes } from "crypto";
import { ClientDataRoom, FileReference } from "../schemas/client-data-room";

function generateId(): string {
  return randomBytes(16).toString("hex");
}

const DATA_DIR = path.join(process.cwd(), "data", "clients");

/**
 * Initialize or get client data room directory
 */
async function ensureDataDir(): Promise<void> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
  }
}

/**
 * Get storage path for client data room file
 */
function getClientDataRoomPath(engagementId: string): string {
  return path.join(DATA_DIR, `${engagementId}.json`);
}

/**
 * Load or initialize client data room for engagement
 */
export async function loadClientDataRoom(
  engagementId: string
): Promise<ClientDataRoom> {
  await ensureDataDir();
  const storagePath = getClientDataRoomPath(engagementId);

  try {
    const data = await fs.readFile(storagePath, "utf-8");
    return JSON.parse(data);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      // Initialize new data room
      const now = new Date().toISOString();
      return {
        engagementId,
        files: [],
        createdAt: now,
        updatedAt: now,
        fileCount: 0,
        totalSize: 0
      };
    }
    throw err;
  }
}

/**
 * Save client data room to storage
 */
export async function saveClientDataRoom(
  dataRoom: ClientDataRoom
): Promise<void> {
  await ensureDataDir();
  const storagePath = getClientDataRoomPath(dataRoom.engagementId);
  const now = new Date().toISOString();
  dataRoom.updatedAt = now;
  await fs.writeFile(storagePath, JSON.stringify(dataRoom, null, 2), "utf-8");
}

/**
 * Add file reference to data room
 * Manages deduplication, size limits, and metadata
 */
export async function addFileReference(
  engagementId: string,
  file: {
    name: string;
    mimeType: string;
    size: number;
    description?: string;
    tags?: string[];
    type?: string;
  },
  uploadedBy: string,
  internalStoragePath: string
): Promise<FileReference> {
  const dataRoom = await loadClientDataRoom(engagementId);

  // Validate file size (100MB limit per file)
  const MAX_FILE_SIZE = 100 * 1024 * 1024;
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File exceeds maximum size of 100MB. Received: ${file.size} bytes`);
  }

  // Validate total storage per engagement (5GB limit to allow testing)
  const MAX_TOTAL_SIZE = 5 * 1024 * 1024 * 1024;
  if (dataRoom.totalSize + file.size > MAX_TOTAL_SIZE) {
    throw new Error(`Engagement storage quota exceeded. Limit: 5GB`);
  }

  const fileRef: FileReference = {
    id: generateId(),
    name: file.name,
    type: (file.type as any) || "other",
    mimeType: file.mimeType,
    size: file.size,
    uploadedAt: new Date().toISOString(),
    uploadedBy,
    description: file.description,
    tags: file.tags || [],
    engagementId,
    storagePath: internalStoragePath,
    isArchived: false
  };

  dataRoom.files.push(fileRef);
  dataRoom.fileCount = dataRoom.files.filter((f) => !f.isArchived).length;
  dataRoom.totalSize = dataRoom.files
    .filter((f) => !f.isArchived)
    .reduce((sum, f) => sum + f.size, 0);

  await saveClientDataRoom(dataRoom);
  return fileRef;
}

/**
 * List all active files in data room
 */
export async function listFiles(
  engagementId: string
): Promise<FileReference[]> {
  const dataRoom = await loadClientDataRoom(engagementId);
  return dataRoom.files.filter((f) => !f.isArchived);
}

/**
 * Get file reference by ID
 */
export async function getFileReference(
  engagementId: string,
  fileId: string
): Promise<FileReference | null> {
  const dataRoom = await loadClientDataRoom(engagementId);
  const file = dataRoom.files.find((f) => f.id === fileId && !f.isArchived);
  return file || null;
}

/**
 * Archive (soft delete) file
 */
export async function archiveFile(
  engagementId: string,
  fileId: string
): Promise<void> {
  const dataRoom = await loadClientDataRoom(engagementId);
  const file = dataRoom.files.find((f) => f.id === fileId);
  if (!file) throw new Error(`File not found: ${fileId}`);

  file.isArchived = true;
  dataRoom.fileCount = dataRoom.files.filter((f) => !f.isArchived).length;
  dataRoom.totalSize = dataRoom.files
    .filter((f) => !f.isArchived)
    .reduce((sum, f) => sum + f.size, 0);

  await saveClientDataRoom(dataRoom);
}

/**
 * Update file metadata (description, tags)
 */
export async function updateFileMetadata(
  engagementId: string,
  fileId: string,
  updates: {
    description?: string;
    tags?: string[];
    type?: string;
  }
): Promise<FileReference> {
  const dataRoom = await loadClientDataRoom(engagementId);
  const file = dataRoom.files.find((f) => f.id === fileId && !f.isArchived);
  if (!file) throw new Error(`File not found: ${fileId}`);

  if (updates.description !== undefined) file.description = updates.description;
  if (updates.tags !== undefined) file.tags = updates.tags;
  if (updates.type !== undefined) file.type = updates.type as any;

  await saveClientDataRoom(dataRoom);
  return file;
}

/**
 * Search files by tag or name
 */
export async function searchFiles(
  engagementId: string,
  query: {
    tags?: string[];
    name?: string;
    type?: string;
  }
): Promise<FileReference[]> {
  const files = await listFiles(engagementId);

  return files.filter((f) => {
    if (query.tags && query.tags.length > 0) {
      if (!query.tags.some((tag) => f.tags.includes(tag))) return false;
    }
    if (query.name && !f.name.toLowerCase().includes(query.name.toLowerCase())) {
      return false;
    }
    if (query.type && f.type !== query.type) return false;
    return true;
  });
}
