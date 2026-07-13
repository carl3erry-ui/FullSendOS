import fs from "node:fs/promises";
import path from "node:path";
import { AgentTaskSchema, type AgentTask, type AgentTaskStatus } from "./types";
import { AgentExecutorError } from "./errors";

// ---------------------------------------------------------------------------
// Filter
// ---------------------------------------------------------------------------

export type AgentTaskFilter = {
  /** Match tasks belonging to a specific project. Pass null to match tasks with no project. */
  projectId?: string | null;
  /** Match tasks belonging to a specific engagement. Pass null for tasks without one. */
  engagementId?: string | null;
  /** Match tasks in a specific workflow run. */
  workflowRunId?: string | null;
  /** Match tasks assigned to a specific agent. */
  agentId?: string;
  /** Match tasks with a specific status. */
  status?: AgentTaskStatus;
};

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
// AgentTaskStore
// ---------------------------------------------------------------------------

const DEFAULT_STORAGE_DIR = path.resolve("data/agent-tasks");

/**
 * File-based persistence store for AgentTask records.
 *
 * Storage layout: data/agent-tasks/<task-id>.json
 * Write strategy: atomic temp-file + rename (matches existing projectStore pattern).
 * Schema validation: applied on every save and load.
 *
 * Pass a custom storageDir for test isolation.
 */
export class AgentTaskStore {
  private readonly storageDir: string;

  constructor(storageDir: string = DEFAULT_STORAGE_DIR) {
    this.storageDir = storageDir;
  }

  /** Persist a task (create or update). Validates against AgentTaskSchema before writing. */
  async saveTask(task: AgentTask): Promise<void> {
    const validated = AgentTaskSchema.parse(task);
    await fs.mkdir(this.storageDir, { recursive: true });
    const file = path.join(this.storageDir, `${validated.id}.json`);
    const tempFile = `${file}.tmp-${process.pid}-${Date.now()}`;
    await fs.writeFile(tempFile, JSON.stringify(validated, null, 2), "utf8");
    await fs.rename(tempFile, file);
  }

  /** Load a task by ID. Throws AgentExecutorError(task_not_found) if missing. */
  async loadTask(id: string): Promise<AgentTask> {
    const safeId = sanitizeId(id);
    const file = path.join(this.storageDir, `${safeId}.json`);
    let raw: string;
    try {
      raw = await fs.readFile(file, "utf8");
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") {
        throw new AgentExecutorError({
          code: "task_not_found",
          message: `Agent task "${id}" not found.`,
          taskId: id,
        });
      }
      throw error;
    }
    return AgentTaskSchema.parse(JSON.parse(raw));
  }

  /** List all tasks, optionally filtered. Corrupted files are skipped silently. */
  async listTasks(filter?: AgentTaskFilter): Promise<AgentTask[]> {
    await fs.mkdir(this.storageDir, { recursive: true });
    const files = (await fs.readdir(this.storageDir)).filter((n) => n.endsWith(".json"));
    const all = await Promise.all(
      files.map(async (name) => {
        try {
          const raw = JSON.parse(await fs.readFile(path.join(this.storageDir, name), "utf8"));
          return AgentTaskSchema.parse(raw);
        } catch {
          return null;
        }
      }),
    );

    let tasks = all.filter((t): t is AgentTask => t !== null);

    if (filter) {
      if (filter.projectId !== undefined) {
        tasks = tasks.filter((t) => t.projectId === filter.projectId);
      }
      if (filter.engagementId !== undefined) {
        tasks = tasks.filter((t) => t.engagementId === filter.engagementId);
      }
      if (filter.workflowRunId !== undefined) {
        tasks = tasks.filter((t) => t.workflowRunId === filter.workflowRunId);
      }
      if (filter.agentId !== undefined) {
        tasks = tasks.filter((t) => t.agentId === filter.agentId);
      }
      if (filter.status !== undefined) {
        tasks = tasks.filter((t) => t.status === filter.status);
      }
    }

    return tasks.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }
}

/** Global default task store. */
export const globalTaskStore = new AgentTaskStore();
