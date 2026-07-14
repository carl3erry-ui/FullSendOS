import { promises as fs } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";

export type DataRoomRetrievalAuditEntry = {
  id: string;
  clientId: string;
  engagementId?: string;
  agentId: string;
  taskId: string;
  query: string;
  documentIds: string[];
  fileIds: string[];
  skippedCounts: Record<string, number>;
  totalCharacters: number;
  createdAt: string;
};

const AUDIT_DIR = path.join(process.cwd(), "data", "agent-retrieval-audits");

function generateId(): string {
  return `dra-${randomBytes(12).toString("hex")}`;
}

async function ensureAuditDir(): Promise<void> {
  await fs.mkdir(AUDIT_DIR, { recursive: true });
}

export async function createDataRoomRetrievalAuditEntry(input: {
  clientId: string;
  engagementId?: string;
  agentId: string;
  taskId: string;
  query: string;
  documentIds: string[];
  fileIds: string[];
  skippedReasons: string[];
  totalCharacters: number;
}): Promise<DataRoomRetrievalAuditEntry> {
  await ensureAuditDir();

  const skippedCounts: Record<string, number> = {};
  for (const reason of input.skippedReasons) {
    skippedCounts[reason] = (skippedCounts[reason] || 0) + 1;
  }

  const entry: DataRoomRetrievalAuditEntry = {
    id: generateId(),
    clientId: input.clientId,
    engagementId: input.engagementId,
    agentId: input.agentId,
    taskId: input.taskId,
    query: input.query,
    documentIds: Array.from(new Set(input.documentIds)),
    fileIds: Array.from(new Set(input.fileIds)),
    skippedCounts,
    totalCharacters: input.totalCharacters,
    createdAt: new Date().toISOString(),
  };

  const filePath = path.join(AUDIT_DIR, `${entry.id}.json`);
  await fs.writeFile(filePath, JSON.stringify(entry, null, 2), "utf8");
  return entry;
}

export async function loadDataRoomRetrievalAuditEntry(
  id: string
): Promise<DataRoomRetrievalAuditEntry> {
  await ensureAuditDir();
  const safeId = id.replace(/[^A-Za-z0-9._-]/g, "");
  const filePath = path.join(AUDIT_DIR, `${safeId}.json`);
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}
