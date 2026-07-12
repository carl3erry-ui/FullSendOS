import { saveProject } from "../storage/projectStore.js";

export const RUN_STALE_MS = 15 * 60 * 1000;

function now() {
  return new Date().toISOString();
}

export function createRunId() {
  return `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function isActiveRun(project) {
  return project?.status === "running" && Boolean(project?.audit?.activeRun?.id);
}

export function isRunStale(project, staleMs = RUN_STALE_MS) {
  if (!isActiveRun(project)) return false;

  const heartbeat = project.audit.activeRun?.updatedAt || project.updatedAt;
  const heartbeatTime = Date.parse(heartbeat);
  if (!Number.isFinite(heartbeatTime)) return true;

  return Date.now() - heartbeatTime > staleMs;
}

export function getActiveRunSnapshot(project) {
  if (!isActiveRun(project)) return null;

  return {
    id: project.audit.activeRun.id,
    startedAt: project.audit.activeRun.startedAt,
    updatedAt: project.audit.activeRun.updatedAt,
    model: project.audit.activeRun.model,
  };
}

export async function beginWorkflowRun(project, { model, runId } = {}) {
  const activeRunId = runId || createRunId();
  const timestamp = now();

  project.status = "running";
  project.updatedAt = timestamp;
  project.audit.activeRun = {
    id: activeRunId,
    startedAt: timestamp,
    updatedAt: timestamp,
    model,
  };

  await saveProject(project);
  return project.audit.activeRun;
}

export async function heartbeatWorkflowRun(project) {
  if (!project?.audit?.activeRun) return;
  const timestamp = now();
  project.audit.activeRun.updatedAt = timestamp;
  project.updatedAt = timestamp;
  await saveProject(project);
}

export async function completeWorkflowRun(project, status) {
  project.status = status;
  project.updatedAt = now();
  project.audit.activeRun = null;
  await saveProject(project);
}

export async function failWorkflowRun(project, errorMessage) {
  project.status = "failed";
  project.updatedAt = now();
  project.audit.warnings.push(errorMessage);

  if (project.audit.activeRun) {
    project.audit.activeRun = null;
  }

  const activeDepartmentRun = [...(project.audit.runs || [])].reverse().find((run) => run.status === "running");
  if (activeDepartmentRun) {
    activeDepartmentRun.status = "failed";
    activeDepartmentRun.completedAt = now();
    activeDepartmentRun.error = errorMessage;
  }

  await saveProject(project);
}

export async function markRunStaleAsFailed(project, staleMs = RUN_STALE_MS) {
  if (!isRunStale(project, staleMs)) return false;

  const staleWarning = `Workflow run ${project.audit.activeRun?.id || "unknown"} marked failed after stale inactivity.`;
  await failWorkflowRun(project, staleWarning);
  return true;
}