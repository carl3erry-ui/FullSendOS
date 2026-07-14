import { promises as fs } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import {
  HumanInputRequest,
  HumanInputRequestCreate,
  HumanInputRequestCreateSchema,
  HumanInputRequestSchema,
  HumanInputRequestStatus,
  HumanInputRequestUpdate,
  HumanInputRequestUpdateSchema,
} from "../schemas/human-input";

export type HumanInputRequestFilter = {
  clientId?: string;
  engagementId?: string;
  workflowRunId?: string;
  agentTaskId?: string;
  status?: HumanInputRequestStatus;
  openOnly?: boolean;
  blockingOnly?: boolean;
};

const DEFAULT_STORAGE_DIR = path.resolve("data/human-input-requests");

function sanitizeId(id: string): string {
  return String(id).replace(/[^A-Za-z0-9._-]/g, "");
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === "object" && error !== null && "code" in error;
}

function generateId(): string {
  return `hir-${randomBytes(12).toString("hex")}`;
}

export class HumanInputRequestStore {
  private readonly storageDir: string;

  constructor(storageDir: string = DEFAULT_STORAGE_DIR) {
    this.storageDir = storageDir;
  }

  private async ensureDir(): Promise<void> {
    await fs.mkdir(this.storageDir, { recursive: true });
  }

  private requestFilePath(id: string): string {
    return path.join(this.storageDir, `${sanitizeId(id)}.json`);
  }

  async saveRequest(request: HumanInputRequest): Promise<void> {
    const validated = HumanInputRequestSchema.parse(request);
    await this.ensureDir();
    const file = this.requestFilePath(validated.id);
    const tempFile = `${file}.tmp-${process.pid}-${Date.now()}`;
    await fs.writeFile(tempFile, JSON.stringify(validated, null, 2), "utf8");
    await fs.rename(tempFile, file);
  }

  async createRequest(input: HumanInputRequestCreate): Promise<HumanInputRequest> {
    const parsed = HumanInputRequestCreateSchema.parse(input);
    const now = new Date().toISOString();
    const request: HumanInputRequest = HumanInputRequestSchema.parse({
      ...parsed,
      id: generateId(),
      status: "open",
      requestedAt: now,
      evidence: parsed.evidence ?? [],
      sourceReferences: parsed.sourceReferences ?? [],
      metadata: parsed.metadata ?? {},
    });

    await this.saveRequest(request);
    return request;
  }

  async loadRequest(id: string): Promise<HumanInputRequest> {
    const file = this.requestFilePath(id);
    try {
      const raw = await fs.readFile(file, "utf8");
      return HumanInputRequestSchema.parse(JSON.parse(raw));
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") {
        throw new Error(`Human input request not found: "${id}"`);
      }
      throw error;
    }
  }

  async updateRequest(id: string, updates: HumanInputRequestUpdate): Promise<HumanInputRequest> {
    const current = await this.loadRequest(id);
    const parsed = HumanInputRequestUpdateSchema.parse(updates);
    const next: HumanInputRequest = HumanInputRequestSchema.parse({
      ...current,
      ...parsed,
      updatedAt: current.requestedAt,
    });
    await this.saveRequest(next);
    return next;
  }

  async answerRequest(id: string, response: string, resolvedBy: string): Promise<HumanInputRequest> {
    const current = await this.loadRequest(id);
    const next: HumanInputRequest = HumanInputRequestSchema.parse({
      ...current,
      status: "answered",
      response,
      resolvedAt: new Date().toISOString(),
      resolvedBy,
    });
    await this.saveRequest(next);
    return next;
  }

  async confirmRequest(id: string, response: string, resolvedBy: string): Promise<HumanInputRequest> {
    const current = await this.loadRequest(id);
    const next: HumanInputRequest = HumanInputRequestSchema.parse({
      ...current,
      status: "confirmed",
      response,
      resolvedAt: new Date().toISOString(),
      resolvedBy,
    });
    await this.saveRequest(next);
    return next;
  }

  async rejectRequest(id: string, response: string, resolvedBy: string): Promise<HumanInputRequest> {
    const current = await this.loadRequest(id);
    const next: HumanInputRequest = HumanInputRequestSchema.parse({
      ...current,
      status: "rejected",
      response,
      resolvedAt: new Date().toISOString(),
      resolvedBy,
    });
    await this.saveRequest(next);
    return next;
  }

  async skipRequest(id: string, response: string, resolvedBy: string): Promise<HumanInputRequest> {
    const current = await this.loadRequest(id);
    const next: HumanInputRequest = HumanInputRequestSchema.parse({
      ...current,
      status: "skipped",
      response,
      resolvedAt: new Date().toISOString(),
      resolvedBy,
    });
    await this.saveRequest(next);
    return next;
  }

  async cancelRequest(id: string, resolvedBy: string): Promise<HumanInputRequest> {
    const current = await this.loadRequest(id);
    const next: HumanInputRequest = HumanInputRequestSchema.parse({
      ...current,
      status: "cancelled",
      resolvedAt: new Date().toISOString(),
      resolvedBy,
    });
    await this.saveRequest(next);
    return next;
  }

  async listRequests(filter: HumanInputRequestFilter = {}): Promise<HumanInputRequest[]> {
    await this.ensureDir();
    const files = (await fs.readdir(this.storageDir)).filter((name) => name.endsWith(".json"));
    const all = await Promise.all(
      files.map(async (name) => {
        try {
          const raw = JSON.parse(await fs.readFile(path.join(this.storageDir, name), "utf8"));
          return HumanInputRequestSchema.parse(raw);
        } catch {
          return null;
        }
      }),
    );

    let requests = all.filter((request): request is HumanInputRequest => request !== null);

    if (filter.clientId !== undefined) {
      requests = requests.filter((request) => request.clientId === filter.clientId);
    }
    if (filter.engagementId !== undefined) {
      requests = requests.filter((request) => request.engagementId === filter.engagementId);
    }
    if (filter.workflowRunId !== undefined) {
      requests = requests.filter((request) => request.workflowRunId === filter.workflowRunId);
    }
    if (filter.agentTaskId !== undefined) {
      requests = requests.filter((request) => request.agentTaskId === filter.agentTaskId);
    }
    if (filter.status !== undefined) {
      requests = requests.filter((request) => request.status === filter.status);
    }
    if (filter.openOnly) {
      requests = requests.filter((request) => request.status === "open");
    }
    if (filter.blockingOnly) {
      requests = requests.filter((request) => request.status === "open" && request.requiredToContinue);
    }

    return requests.sort((left, right) => new Date(right.requestedAt).getTime() - new Date(left.requestedAt).getTime());
  }
}

export const globalHumanInputRequestStore = new HumanInputRequestStore();
