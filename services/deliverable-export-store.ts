import { promises as fs } from "node:fs";
import path from "node:path";
import {
  DeliverableExportSchema,
  DeliverableExportSummarySchema,
  type DeliverableExport,
  type DeliverableExportSummary,
} from "@/schemas/deliverable-export";

const EXPORTS_DIR = path.join(process.cwd(), "data", "deliverable-exports");

type DeliverableExportIndex = {
  engagementId: string;
  exports: DeliverableExport[];
  createdAt: string;
  updatedAt: string;
};

function sanitizeId(id: string): string {
  return String(id).replace(/[^A-Za-z0-9._-]/g, "");
}

async function ensureDir(): Promise<void> {
  await fs.mkdir(EXPORTS_DIR, { recursive: true });
}

function indexPathFor(engagementId: string): string {
  return path.join(EXPORTS_DIR, `${sanitizeId(engagementId)}.json`);
}

async function loadIndex(engagementId: string): Promise<DeliverableExportIndex> {
  await ensureDir();
  const now = new Date().toISOString();

  try {
    const raw = await fs.readFile(indexPathFor(engagementId), "utf8");
    const parsed = JSON.parse(raw) as DeliverableExportIndex;
    const exports = Array.isArray(parsed.exports)
      ? parsed.exports.map((item) => DeliverableExportSchema.parse(item))
      : [];

    return {
      engagementId,
      exports,
      createdAt: parsed.createdAt || now,
      updatedAt: parsed.updatedAt || now,
    };
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "ENOENT") {
      return {
        engagementId,
        exports: [],
        createdAt: now,
        updatedAt: now,
      };
    }
    throw error;
  }
}

async function saveIndex(index: DeliverableExportIndex): Promise<void> {
  await ensureDir();
  index.updatedAt = new Date().toISOString();
  await fs.writeFile(indexPathFor(index.engagementId), JSON.stringify(index, null, 2), "utf8");
}

export async function createDeliverableExport(record: DeliverableExport): Promise<DeliverableExport> {
  const parsed = DeliverableExportSchema.parse(record);
  const index = await loadIndex(parsed.engagementId);

  index.exports = [parsed, ...index.exports.filter((item) => item.id !== parsed.id)];
  await saveIndex(index);
  return parsed;
}

export async function listDeliverableExports(engagementId: string): Promise<DeliverableExportSummary[]> {
  const index = await loadIndex(engagementId);
  return index.exports
    .map((item) => DeliverableExportSummarySchema.parse(item))
    .sort((left, right) => new Date(right.generatedAt).getTime() - new Date(left.generatedAt).getTime());
}

export async function getDeliverableExport(
  engagementId: string,
  exportId: string,
): Promise<DeliverableExport | null> {
  const index = await loadIndex(engagementId);
  return index.exports.find((item) => item.id === exportId) || null;
}
