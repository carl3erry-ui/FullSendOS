import { WorkflowStateSchema } from "../schemas/project";
import type { Project, WorkflowStage, WorkflowStageId } from "../types/project";

const WORKFLOW_ORDER: Array<{ id: WorkflowStageId; label: string }> = [
  { id: "intelligence", label: "Intelligence" },
  { id: "strategy", label: "Strategy" },
  { id: "creative", label: "Creative" },
  { id: "publishing", label: "Publishing" },
];

function now() {
  return new Date().toISOString();
}

function stageIndex(stageId: WorkflowStageId): number {
  return WORKFLOW_ORDER.findIndex((stage) => stage.id === stageId);
}

function getStage(workflow: Project["workflow"], stageId: WorkflowStageId): WorkflowStage {
  const stage = workflow.stages.find((item) => item.id === stageId);
  if (!stage) {
    throw new Error(`Unknown stage: ${stageId}`);
  }
  return stage;
}

function assertPriorStagesCompleted(workflow: Project["workflow"], stageId: WorkflowStageId) {
  const currentIndex = stageIndex(stageId);
  if (currentIndex < 0) {
    throw new Error(`Unknown stage: ${stageId}`);
  }

  const blockers = WORKFLOW_ORDER.slice(0, currentIndex)
    .map((item) => getStage(workflow, item.id))
    .filter((item) => item.status !== "completed" && item.status !== "skipped");

  if (blockers.length > 0) {
    throw new Error(`Stage ${stageId} cannot run before ${blockers.map((item) => item.id).join(", ")}.`);
  }
}

function withValidatedWorkflow(project: Project): Project {
  WorkflowStateSchema.parse(project.workflow);
  return {
    ...project,
    workflow: WorkflowStateSchema.parse(project.workflow),
  };
}

export function initializeWorkflow(project: Project): Project {
  const initializedProject: Project = {
    ...project,
    status: "in-progress",
    updatedAt: now(),
    workflow: {
      initializedAt: now(),
      currentStageId: undefined,
      stages: WORKFLOW_ORDER.map((stage) => ({
        id: stage.id,
        label: stage.label,
        status: "pending",
      })),
      stageResults: {},
    },
  };

  return withValidatedWorkflow(initializedProject);
}

export function startStage(project: Project, stageId: WorkflowStageId): Project {
  assertPriorStagesCompleted(project.workflow, stageId);

  const target = getStage(project.workflow, stageId);
  if (target.status === "running") {
    return project;
  }

  if (target.status === "completed" || target.status === "skipped") {
    throw new Error(`Stage ${stageId} is already complete.`);
  }

  const nextProject: Project = {
    ...project,
    updatedAt: now(),
    status: "in-progress",
    workflow: {
      ...project.workflow,
      currentStageId: stageId,
      stages: project.workflow.stages.map((stage) =>
        stage.id === stageId
          ? {
              ...stage,
              status: "running",
              startedAt: stage.startedAt || now(),
              completedAt: undefined,
              error: undefined,
            }
          : stage,
      ),
    },
  };

  return withValidatedWorkflow(nextProject);
}

export function completeStage(project: Project, stageId: WorkflowStageId, result?: unknown): Project {
  const target = getStage(project.workflow, stageId);
  if (target.status !== "running") {
    throw new Error(`Stage ${stageId} must be running before completion.`);
  }

  const completedProject: Project = {
    ...project,
    updatedAt: now(),
    workflow: {
      ...project.workflow,
      currentStageId: undefined,
      stages: project.workflow.stages.map((stage) =>
        stage.id === stageId
          ? {
              ...stage,
              status: "completed",
              completedAt: now(),
              error: undefined,
            }
          : stage,
      ),
      stageResults:
        result === undefined
          ? project.workflow.stageResults
          : { ...project.workflow.stageResults, [stageId]: result },
    },
  };

  const allCompleted = completedProject.workflow.stages.every(
    (stage) => stage.status === "completed" || stage.status === "skipped",
  );

  const finalProject: Project = {
    ...completedProject,
    status: allCompleted ? "completed" : completedProject.status,
  };

  return withValidatedWorkflow(finalProject);
}

export function failStage(project: Project, stageId: WorkflowStageId, error: string): Project {
  const target = getStage(project.workflow, stageId);
  if (target.status !== "running") {
    throw new Error(`Stage ${stageId} must be running before failure can be recorded.`);
  }

  const failedProject: Project = {
    ...project,
    updatedAt: now(),
    status: "failed",
    workflow: {
      ...project.workflow,
      currentStageId: undefined,
      stages: project.workflow.stages.map((stage) =>
        stage.id === stageId
          ? {
              ...stage,
              status: "failed",
              completedAt: now(),
              error,
            }
          : stage,
      ),
    },
  };

  return withValidatedWorkflow(failedProject);
}

export function getNextRunnableStage(project: Project): WorkflowStageId | null {
  for (const stage of WORKFLOW_ORDER) {
    const current = getStage(project.workflow, stage.id);
    if (current.status !== "pending") continue;

    const priorStages = WORKFLOW_ORDER.slice(0, stageIndex(stage.id)).map((item) => getStage(project.workflow, item.id));
    const runnable = priorStages.every(
      (priorStage) => priorStage.status === "completed" || priorStage.status === "skipped",
    );

    if (runnable) return stage.id;
  }

  return null;
}

export function calculateWorkflowProgress(project: Project): number {
  const total = project.workflow.stages.length;
  if (total === 0) return 0;

  const completed = project.workflow.stages.filter(
    (stage) => stage.status === "completed" || stage.status === "skipped",
  ).length;

  return Math.round((completed / total) * 100);
}
