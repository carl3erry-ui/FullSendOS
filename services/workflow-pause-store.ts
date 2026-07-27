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
