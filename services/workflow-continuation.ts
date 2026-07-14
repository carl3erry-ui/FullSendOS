/**
 * Workflow Pipeline Continuation Service (Slice 8)
 *
 * After an approved agent step executes via resumeWorkflowAfterApproval(),
 * this service continues running the remaining PIPELINE departments and
 * completes the workflow (setting deliverables, final status, audit trail).
 *
 * Continuation flow:
 *   1. Load PausedWorkflowState to determine pendingStepIds
 *   2. Filter pendingStepIds to PIPELINE departments only
 *   3. Load project from disk
 *   4. Ensure project.status = "running" (begin run if needed)
 *   5. Call runExistingProject with departmentsToRun = remaining departments
 *   6. Record continuation audit entries
 *   7. Return ContinuationResult
 *
 * Limitations:
 *   - Only continues agent-step approval paths where pendingStepIds are PIPELINE
 *     department names ("research", "competitors", etc.)
 *   - Does not support nested agent steps mid-continuation
 *   - Continuation is fire-and-forget when called from the API route
 *   - Production path requires xAI; tests use mock invokeModel
 */

import { loadPauseState } from "./workflow-pause-store";
import type { PausedWorkflowState } from "./workflow-step-schema";

// ---------------------------------------------------------------------------
// Re-export PIPELINE so callers can reference the canonical order
// ---------------------------------------------------------------------------

// Lazy import to avoid ESM/CJS issues in tests — resolved at call time
async function getOrchestrator() {
  // Dynamic import avoids circular resolution issues in test environments
  return import("../src/orchestrator/orchestrator.js") as Promise<{
    runExistingProject: (project: unknown, options?: unknown) => Promise<unknown>;
    PIPELINE: string[];
  }>;
}

async function getProjectStore() {
  return import("../src/storage/projectStore.js") as Promise<{
    loadProject: (id: string) => Promise<unknown>;
  }>;
}

async function getRunLifecycle() {
  return import("../src/orchestrator/runLifecycle.js") as Promise<{
    isActiveRun: (project: unknown) => boolean;
    beginWorkflowRun: (project: unknown, opts: { model?: string }) => Promise<unknown>;
  }>;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ContinuationResult =
  | {
      ok: true;
      projectId: string;
      projectStatus: string;
      ranDepartments: string[];
      skippedAlreadyComplete: string[];
      pauseStateId: string;
    }
  | { ok: false; reason: string; code: ContinuationErrorCode; pauseStateId: string };

export type ContinuationErrorCode =
  | "pause_not_found"
  | "no_pending_pipeline_steps"
  | "project_not_found"
  | "continuation_failed"
  | "invalid_state";

// ---------------------------------------------------------------------------
// Main continuation function
// ---------------------------------------------------------------------------

/**
 * Continue the workflow pipeline after a paused agent step was approved and executed.
 *
 * @param pauseStateId - ID of the PausedWorkflowState record (must be "resumed")
 * @param options.invokeModel - Injectable AI caller for testing (defaults to callXai)
 * @param options.model - AI model name (defaults to XAI_MODEL env or "grok-4.5")
 * @param options.onProgress - Optional progress callback
 */
export async function continueWorkflowAfterResume(
  pauseStateId: string,
  options: {
    invokeModel?: (args: { department: string; prompt: string; model: string }) => Promise<{ text: string }>;
    model?: string;
    onProgress?: (event: { type: string; department?: string }) => void;
  } = {},
): Promise<ContinuationResult> {
  // 1. Load pause state
  let pauseState: PausedWorkflowState;
  try {
    pauseState = await loadPauseState(pauseStateId);
  } catch {
    return {
      ok: false,
      reason: `Paused workflow state not found: "${pauseStateId}"`,
      code: "pause_not_found",
      pauseStateId,
    };
  }

  // 2. Must be in "resumed" status (agent step already executed)
  if (pauseState.status !== "resumed") {
    return {
      ok: false,
      reason: `Cannot continue workflow from pause state "${pauseStateId}" with status "${pauseState.status}" — expected "resumed".`,
      code: "invalid_state",
      pauseStateId,
    };
  }

  // 3. Resolve remaining PIPELINE departments from pendingStepIds
  const { PIPELINE } = await getOrchestrator();
  const pipelineDepts = pauseState.pendingStepIds.filter((id) => PIPELINE.includes(id));

  if (pipelineDepts.length === 0) {
    return {
      ok: false,
      reason: `No remaining pipeline departments in pause state "${pauseStateId}". pendingStepIds=${JSON.stringify(pauseState.pendingStepIds)}`,
      code: "no_pending_pipeline_steps",
      pauseStateId,
    };
  }

  // 4. Load project
  const { loadProject } = await getProjectStore();
  let project: any;
  try {
    project = await loadProject(pauseState.projectId);
  } catch {
    return {
      ok: false,
      reason: `Project not found: "${pauseState.projectId}"`,
      code: "project_not_found",
      pauseStateId,
    };
  }

  // 5. Determine which departments still need to run
  // Skip any that already have valid output in project.departments
  const alreadyComplete = pipelineDepts.filter(
    (dept) => project.departments?.[dept]?.status === "complete" || project.departments?.[dept]?.status === "repaired",
  );
  const depsToRun = pipelineDepts.filter((dept) => !alreadyComplete.includes(dept));

  if (depsToRun.length === 0) {
    return {
      ok: false,
      reason: `All pending pipeline departments already completed for project "${pauseState.projectId}".`,
      code: "no_pending_pipeline_steps",
      pauseStateId,
    };
  }

  // 6. Ensure workflow is in running state (restart if not active)
  const { isActiveRun, beginWorkflowRun } = await getRunLifecycle();
  const model = options.model ?? process.env.XAI_MODEL ?? "grok-4.5";

  if (!isActiveRun(project)) {
    await beginWorkflowRun(project, { model });
  }

  // 7. Run remaining PIPELINE departments + set deliverables + complete workflow
  const { runExistingProject } = await getOrchestrator();
  try {
    await runExistingProject(project, {
      skipRunStart: true,
      departmentsToRun: depsToRun,
      model,
      invokeModel: options.invokeModel,
      onProgress: (event: { type: string; department?: string }) => {
        options.onProgress?.(event);
      },
    });

    return {
      ok: true,
      projectId: pauseState.projectId,
      projectStatus: project.status,
      ranDepartments: depsToRun,
      skippedAlreadyComplete: alreadyComplete,
      pauseStateId,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown continuation error";
    return {
      ok: false,
      reason: `Workflow continuation failed: ${message}`,
      code: "continuation_failed",
      pauseStateId,
    };
  }
}
