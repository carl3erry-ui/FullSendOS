/**
 * Workflow Pause Store (Slice 7)
 *
 * File-based persistence for paused workflow states.
 * Stored under data/workflow-pauses/{pauseId}.json
 *
 * A pause record is created when a workflow step requires approval.
 * It is updated to "resumed" when the approval is granted and the
 * workflow successfully continues.
 */

import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { PausedWorkflowStateSchema, type PausedWorkflowState } from "./workflow-step-schema";

export type { PausedWorkflowState };

const PAUSE_DIR = path.resolve(process.cwd(), "data", "workflow-pauses");

async function ensureDir(): Promise<void> {
  await fs.mkdir(PAUSE_DIR, { recursive: true });
}

function pauseFilePath(id: string): string {
  // Sanitize id — allow alphanumeric, dash, underscore only
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    throw new Error(`Invalid pause state id: "${id}"`);
  }
  return path.join(PAUSE_DIR, `${id}.json`);
}

function resumeClaimFilePath(id: string): string {
  pauseFilePath(id);
  return path.join(PAUSE_DIR, `${id}.resume-claim`);
}

export class WorkflowPauseClaimError extends Error {
  readonly code: "already_claimed";

  constructor() {
    super("Workflow resume is already in progress.");
    this.code = "already_claimed";
  }
}

export type WorkflowPauseResumeClaim = {
  pauseState: PausedWorkflowState;
  release: () => Promise<void>;
};

export async function claimPauseForResume(id: string): Promise<WorkflowPauseResumeClaim> {
  await ensureDir();
  const claimPath = resumeClaimFilePath(id);
  const token = randomUUID();
  let handle: Awaited<ReturnType<typeof fs.open>>;

  try {
    handle = await fs.open(claimPath, "wx");
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "EEXIST") {
      throw new WorkflowPauseClaimError();
    }
    throw error;
  }

  try {
    await handle.writeFile(JSON.stringify({ token, claimedAt: new Date().toISOString() }), "utf8");
  } finally {
    await handle.close();
  }

  try {
    const pauseState = await loadPauseState(id);
    let released = false;

    return {
      pauseState,
      release: async () => {
        if (released) return;
        released = true;

        try {
          const claim = JSON.parse(await fs.readFile(claimPath, "utf8")) as { token?: unknown };
          if (claim.token === token) {
            await fs.rm(claimPath, { force: true });
          }
        } catch {
          // Missing or malformed claims fail closed and are never removed by a non-owner.
        }
      },
    };
  } catch (error) {
    await fs.rm(claimPath, { force: true });
    throw error;
  }
}

/**
 * Save a new or updated paused workflow state to disk.
 */
export async function savePauseState(state: PausedWorkflowState): Promise<void> {
  await ensureDir();
  const validated = PausedWorkflowStateSchema.parse(state);
  await fs.writeFile(pauseFilePath(validated.id), JSON.stringify(validated, null, 2), "utf-8");
}

/**
 * Load a paused workflow state by ID.
 * Throws if not found.
 */
export async function loadPauseState(id: string): Promise<PausedWorkflowState> {
  let raw: string;
  try {
    raw = await fs.readFile(pauseFilePath(id), "utf-8");
  } catch {
    throw new Error(`Paused workflow state not found: "${id}"`);
  }

  const parsed = JSON.parse(raw);
  return PausedWorkflowStateSchema.parse(parsed);
}

/**
 * Find the active (waiting_for_approval) pause state for a project.
 * Returns the most recently created pause, or null if none exist.
 */
export async function findActivePauseForProject(
  projectId: string,
): Promise<PausedWorkflowState | null> {
  await ensureDir();

  let files: string[];
  try {
    files = await fs.readdir(PAUSE_DIR);
  } catch {
    return null;
  }

  const states: PausedWorkflowState[] = [];

  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    try {
      const raw = await fs.readFile(path.join(PAUSE_DIR, file), "utf-8");
      const parsed = PausedWorkflowStateSchema.parse(JSON.parse(raw));
      if (parsed.projectId === projectId && parsed.status === "waiting_for_approval") {
        states.push(parsed);
      }
    } catch {
      // Skip malformed or unrelated files
    }
  }

  if (states.length === 0) return null;

  // Return most recently paused
  return states.sort((a, b) => b.pausedAt.localeCompare(a.pausedAt))[0];
}

/**
 * Find the active pause state for a specific agent task.
 */
export async function findPauseForTask(
  agentTaskId: string,
): Promise<PausedWorkflowState | null> {
  await ensureDir();

  let files: string[];
  try {
    files = await fs.readdir(PAUSE_DIR);
  } catch {
    return null;
  }

  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    try {
      const raw = await fs.readFile(path.join(PAUSE_DIR, file), "utf-8");
      const parsed = PausedWorkflowStateSchema.parse(JSON.parse(raw));
      if (
        parsed.agentTaskId === agentTaskId &&
        parsed.status === "waiting_for_approval"
      ) {
        return parsed;
      }
    } catch {
      // Skip
    }
  }

  return null;
}

/**
 * Mark a pause state as resumed.
 */
export async function markPauseResumed(
  id: string,
  resumedBy?: string,
): Promise<PausedWorkflowState> {
  const state = await loadPauseState(id);

  if (state.status !== "waiting_for_approval") {
    throw new Error(
      `Cannot resume pause state "${id}" with status "${state.status}". Expected "waiting_for_approval".`,
    );
  }

  const updated: PausedWorkflowState = {
    ...state,
    status: "resumed",
    resumedAt: new Date().toISOString(),
    resumedBy,
  };

  await savePauseState(updated);
  return updated;
}

/**
 * Mark a pause state as cancelled.
 */
export async function markPauseCancelled(
  id: string,
  reason: string,
): Promise<PausedWorkflowState> {
  const state = await loadPauseState(id);

  const updated: PausedWorkflowState = {
    ...state,
    status: "cancelled",
    cancelledAt: new Date().toISOString(),
    cancelReason: reason,
  };

  await savePauseState(updated);
  return updated;
}
