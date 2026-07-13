import { promises as fs } from "fs";
import path from "path";
import { randomBytes } from "crypto";
import {
  ClientDataRoom,
  DataRoomFolder,
  FileReference,
  DEFAULT_FOLDERS
} from "../schemas/client-data-room";

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
function getClientDataRoomPath(clientId: string): string {
  return path.join(DATA_DIR, `${clientId}-data-room.json`);
}

/**
 * Load or initialize client data room
 */
export async function loadClientDataRoom(
  clientId: string
): Promise<ClientDataRoom> {
  await ensureDataDir();
  const storagePath = getClientDataRoomPath(clientId);

  try {
    const data = await fs.readFile(storagePath, "utf-8");
    const parsed = JSON.parse(data);
    
    // Ensure default folders exist on load
    const defaultFolderIds = new Set(DEFAULT_FOLDERS.map((f) => f.id));
    const existingFolderIds = new Set(parsed.folders.map((f: DataRoomFolder) => f.id));
    
    const missingFolders = DEFAULT_FOLDERS.filter(
      (f) => !existingFolderIds.has(f.id)
    ).map((f) => ({ ...f, clientId }));
    
    if (missingFolders.length > 0) {
      parsed.folders.push(...missingFolders);
      await saveClientDataRoom(parsed);
    }
    
    return parsed;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      // Initialize new data room with default folders
      const now = new Date().toISOString();
      const folders = DEFAULT_FOLDERS.map((f) => ({ ...f, clientId }));
      const dataRoom: ClientDataRoom = {
        clientId,
        folders,
        files: [],
        createdAt: now,
        updatedAt: now,
        fileCount: 0,
        totalSize: 0
      };
      await saveClientDataRoom(dataRoom);
      return dataRoom;
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
  const storagePath = getClientDataRoomPath(dataRoom.clientId);
  const now = new Date().toISOString();
  dataRoom.updatedAt = now;
  await fs.writeFile(storagePath, JSON.stringify(dataRoom, null, 2), "utf-8");
}

/**
 * Add file reference to client data room
 */
export async function addFileReference(
  clientId: string,
  file: {
    name: string;
    mimeType: string;
    size: number;
    folderId?: string;
    description?: string;
    tags?: string[];
    type?: string;
    engagementIds?: string[];
    approvedForAgentUse?: boolean;
    sensitive?: boolean;
  },
  uploadedBy: string,
  internalStoragePath: string
): Promise<FileReference> {
  const dataRoom = await loadClientDataRoom(clientId);

  // Validate file size (100MB limit per file)
  const MAX_FILE_SIZE = 100 * 1024 * 1024;
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File exceeds maximum size of 100MB. Received: ${file.size} bytes`);
  }

  // Validate total storage per client (5GB limit)
  const MAX_TOTAL_SIZE = 5 * 1024 * 1024 * 1024;
  if (dataRoom.totalSize + file.size > MAX_TOTAL_SIZE) {
    throw new Error(`Client storage quota exceeded. Limit: 5GB`);
  }

  // Default folder
  const folderId = file.folderId || "misc";
  
  // Verify folder exists
  const folder = dataRoom.folders.find((f) => f.id === folderId);
  if (!folder) {
    throw new Error(`Folder not found: ${folderId}`);
  }

  const fileRef: FileReference = {
    id: generateId(),
    clientId,
    folderId,
    name: file.name,
    type: (file.type as any) || "other",
    mimeType: file.mimeType,
    size: file.size,
    uploadedAt: new Date().toISOString(),
    uploadedBy,
    description: file.description,
    tags: file.tags || [],
    engagementIds: file.engagementIds || [],
    storagePath: internalStoragePath,
    isArchived: false,
    approvedForAgentUse: file.approvedForAgentUse || false,
    sensitive: file.sensitive || false
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
 * List all active files in client data room
 */
export async function listFiles(
  clientId: string,
  options?: { folderId?: string; engagementId?: string }
): Promise<FileReference[]> {
  const dataRoom = await loadClientDataRoom(clientId);
  let files = dataRoom.files.filter((f) => !f.isArchived);

  if (options?.folderId) {
    files = files.filter((f) => f.folderId === options.folderId);
  }

  if (options?.engagementId) {
    files = files.filter((f) => f.engagementIds.includes(options.engagementId!));
  }

  return files;
}

/**
 * Get file reference by ID
 */
export async function getFileReference(
  clientId: string,
  fileId: string
): Promise<FileReference | null> {
  const dataRoom = await loadClientDataRoom(clientId);
  const file = dataRoom.files.find((f) => f.id === fileId && !f.isArchived);
  return file || null;
}

/**
 * Archive (soft delete) file
 */
export async function archiveFile(
  clientId: string,
  fileId: string
): Promise<void> {
  const dataRoom = await loadClientDataRoom(clientId);
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
 * Update file metadata
 */
export async function updateFileMetadata(
  clientId: string,
  fileId: string,
  updates: {
    description?: string;
    tags?: string[];
    type?: string;
    engagementIds?: string[];
    approvedForAgentUse?: boolean;
    sensitive?: boolean;
  }
): Promise<FileReference> {
  const dataRoom = await loadClientDataRoom(clientId);
  const file = dataRoom.files.find((f) => f.id === fileId && !f.isArchived);
  if (!file) throw new Error(`File not found: ${fileId}`);

  if (updates.description !== undefined) file.description = updates.description;
  if (updates.tags !== undefined) file.tags = updates.tags;
  if (updates.type !== undefined) file.type = updates.type as any;
  if (updates.engagementIds !== undefined) file.engagementIds = updates.engagementIds;
  if (updates.approvedForAgentUse !== undefined) file.approvedForAgentUse = updates.approvedForAgentUse;
  if (updates.sensitive !== undefined) file.sensitive = updates.sensitive;

  await saveClientDataRoom(dataRoom);
  return file;
}

/**
 * Search files
 */
export async function searchFiles(
  clientId: string,
  query: {
    tags?: string[];
    name?: string;
    type?: string;
    folderId?: string;
    engagementId?: string;
  }
): Promise<FileReference[]> {
  const files = await listFiles(clientId, {
    folderId: query.folderId,
    engagementId: query.engagementId
  });

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

/**
 * Get client data room folders
 */
export async function getFolders(clientId: string): Promise<DataRoomFolder[]> {
  const dataRoom = await loadClientDataRoom(clientId);
  return dataRoom.folders.sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * Link file to engagement (add engagement ID)
 */
export async function linkFileToEngagement(
  clientId: string,
  fileId: string,
  engagementId: string
): Promise<FileReference> {
  const dataRoom = await loadClientDataRoom(clientId);
  const file = dataRoom.files.find((f) => f.id === fileId && !f.isArchived);
  if (!file) throw new Error(`File not found: ${fileId}`);

  if (!file.engagementIds.includes(engagementId)) {
    file.engagementIds.push(engagementId);
  }

  await saveClientDataRoom(dataRoom);
  return file;
}

/**
 * Unlink file from engagement (remove engagement ID)
 */
export async function unlinkFileFromEngagement(
  clientId: string,
  fileId: string,
  engagementId: string
): Promise<FileReference> {
  const dataRoom = await loadClientDataRoom(clientId);
  const file = dataRoom.files.find((f) => f.id === fileId && !f.isArchived);
  if (!file) throw new Error(`File not found: ${fileId}`);

  file.engagementIds = file.engagementIds.filter((id) => id !== engagementId);

  await saveClientDataRoom(dataRoom);
  return file;
}
