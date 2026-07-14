import fs from "node:fs/promises";
import path from "node:path";
import { AgentExecutionSchema, type AgentExecution } from "./types";
import { AgentExecutorError } from "./errors";

// ---------------------------------------------------------------------------
// ID helpers
// ---------------------------------------------------------------------------

function sanitizeId(id: string): string {
  return String(id).replace(/[^A-Za-z0-9._-]/g, "");
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === "object" && error !== null && "code" in error;
}

// ---------------------------------------------------------------------------
// AgentExecutionStore
// ---------------------------------------------------------------------------

const DEFAULT_STORAGE_DIR = path.resolve("data/agent-executions");

/**
 * File-based persistence store for AgentExecution records.
 *
 * Storage layout: data/agent-executions/<execution-id>.json
 * Write strategy: atomic temp-file + rename (matches existing projectStore pattern).
 * Schema validation: applied on every save and load.
 *
 * Security: rawResponse is stored as a sanitized string only.
 * The execution record must never contain authorization headers or API keys.
 *
 * Pass a custom storageDir for test isolation.
 */
export class AgentExecutionStore {
  private readonly storageDir: string;

  constructor(storageDir: string = DEFAULT_STORAGE_DIR) {
    this.storageDir = storageDir;
  }

  /** Persist an execution record (create or update). Validates before writing. */
  async saveExecution(execution: AgentExecution): Promise<void> {
    const validated = AgentExecutionSchema.parse(execution);
    await fs.mkdir(this.storageDir, { recursive: true });
    const file = path.join(this.storageDir, `${validated.id}.json`);
    const tempFile = `${file}.tmp-${process.pid}-${Date.now()}`;
    await fs.writeFile(tempFile, JSON.stringify(validated, null, 2), "utf8");
    await fs.rename(tempFile, file);
  }

  /** Load an execution by ID. Throws AgentExecutorError(task_not_found) if missing. */
  async loadExecution(id: string): Promise<AgentExecution> {
    const safeId = sanitizeId(id);
    const file = path.join(this.storageDir, `${safeId}.json`);
    let raw: string;
    try {
      raw = await fs.readFile(file, "utf8");
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") {
        throw new AgentExecutorError({
          code: "task_not_found",
          message: `Agent execution "${id}" not found.`,
        });
      }
      throw error;
    }
    return AgentExecutionSchema.parse(JSON.parse(raw));
  }

  /** List all executions for a given taskId, in ascending attempt order. */
  async listByTaskId(taskId: string): Promise<AgentExecution[]> {
    await fs.mkdir(this.storageDir, { recursive: true });
    const files = (await fs.readdir(this.storageDir)).filter((n) => n.endsWith(".json"));
    const all = await Promise.all(
      files.map(async (name) => {
        try {
          const raw = JSON.parse(await fs.readFile(path.join(this.storageDir, name), "utf8"));
          return AgentExecutionSchema.parse(raw);
        } catch {
          return null;
        }
      }),
    );
    return all
      .filter((e): e is AgentExecution => e !== null && e.agentTaskId === taskId)
      .sort((a, b) => a.attempt - b.attempt);
  }
}

/** Global default execution store. */
export const globalExecutionStore = new AgentExecutionStore();
