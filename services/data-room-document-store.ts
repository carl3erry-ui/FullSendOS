import { promises as fs } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import {
  DataRoomDocument,
  DataRoomDocumentSafe,
  DataRoomDocumentSafeSchema,
  DataRoomDocumentSchema,
} from "../schemas/client-data-room";

const DATA_DIR = path.join(process.cwd(), "data", "clients");

type DataRoomDocumentIndex = {
  clientId: string;
  documents: DataRoomDocument[];
  createdAt: string;
  updatedAt: string;
};

function generateId(): string {
  return randomBytes(16).toString("hex");
}

async function ensureDataDir(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

function getClientDocumentIndexPath(clientId: string): string {
  return path.join(DATA_DIR, `${clientId}-documents.json`);
}

async function loadDocumentIndex(clientId: string): Promise<DataRoomDocumentIndex> {
  await ensureDataDir();
  const indexPath = getClientDocumentIndexPath(clientId);

  try {
    const raw = await fs.readFile(indexPath, "utf8");
    const parsed = JSON.parse(raw) as DataRoomDocumentIndex;
    const validatedDocuments = (parsed.documents || []).map((doc) =>
      DataRoomDocumentSchema.parse(doc)
    );

    return {
      clientId,
      documents: validatedDocuments,
      createdAt: parsed.createdAt || new Date().toISOString(),
      updatedAt: parsed.updatedAt || new Date().toISOString(),
    };
  } catch (error) {
    if (
      typeof error === "object" &&
      error &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      const now = new Date().toISOString();
      return {
        clientId,
        documents: [],
        createdAt: now,
        updatedAt: now,
      };
    }

    throw error;
  }
}

async function saveDocumentIndex(index: DataRoomDocumentIndex): Promise<void> {
  await ensureDataDir();
  const indexPath = getClientDocumentIndexPath(index.clientId);

  index.updatedAt = new Date().toISOString();
  await fs.writeFile(indexPath, JSON.stringify(index, null, 2), "utf8");
}

export type DataRoomDocumentQuery = {
  fileId?: string;
  engagementId?: string;
  folderId?: string;
  detectedDocumentType?: string;
  keywords?: string[];
  processingStatus?: string;
};

export async function listDataRoomDocuments(
  clientId: string,
  query: DataRoomDocumentQuery = {}
): Promise<DataRoomDocument[]> {
  const index = await loadDocumentIndex(clientId);

  return index.documents.filter((doc) => {
    if (query.fileId && doc.fileId !== query.fileId) return false;
    if (query.engagementId && doc.engagementId !== query.engagementId) return false;
    if (query.folderId && doc.folderId !== query.folderId) return false;
    if (
      query.detectedDocumentType &&
      doc.detectedDocumentType !== query.detectedDocumentType
    ) {
      return false;
    }
    if (query.processingStatus && doc.processingStatus !== query.processingStatus) {
      return false;
    }
    if (query.keywords && query.keywords.length > 0) {
      const set = new Set(doc.keywords.map((kw) => kw.toLowerCase()));
      const hasKeyword = query.keywords.some((kw) => set.has(kw.toLowerCase()));
      if (!hasKeyword) return false;
    }

    return true;
  });
}

export async function getDataRoomDocument(
  clientId: string,
  documentId: string
): Promise<DataRoomDocument | null> {
  const index = await loadDocumentIndex(clientId);
  return index.documents.find((doc) => doc.id === documentId) || null;
}

export async function getDataRoomDocumentByFileId(
  clientId: string,
  fileId: string
): Promise<DataRoomDocument | null> {
  const index = await loadDocumentIndex(clientId);
  return index.documents.find((doc) => doc.fileId === fileId) || null;
}

export async function upsertDataRoomDocument(
  clientId: string,
  input: Omit<DataRoomDocument, "id" | "createdAt" | "updatedAt"> & {
    id?: string;
    createdAt?: string;
  }
): Promise<DataRoomDocument> {
  const index = await loadDocumentIndex(clientId);
  const now = new Date().toISOString();

  const existingIndex = input.id
    ? index.documents.findIndex((doc) => doc.id === input.id)
    : index.documents.findIndex((doc) => doc.fileId === input.fileId);

  const existing = existingIndex >= 0 ? index.documents[existingIndex] : null;

  const document: DataRoomDocument = DataRoomDocumentSchema.parse({
    ...input,
    id: existing?.id || input.id || generateId(),
    createdAt: existing?.createdAt || input.createdAt || now,
    updatedAt: now,
  });

  if (existingIndex >= 0) {
    index.documents[existingIndex] = document;
  } else {
    index.documents.push(document);
  }

  await saveDocumentIndex(index);
  return document;
}

export function toSafeDataRoomDocument(document: DataRoomDocument): DataRoomDocumentSafe {
  return DataRoomDocumentSafeSchema.parse(document);
}

export function toSafeDataRoomDocuments(
  documents: DataRoomDocument[]
): DataRoomDocumentSafe[] {
  return documents.map(toSafeDataRoomDocument);
}
