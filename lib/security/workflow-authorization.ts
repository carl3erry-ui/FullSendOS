import type { AuthenticatedActor } from "./types";
import { concealedNotFound, forbidden } from "./security-response";

type WorkflowProjectRecord = {
  id: string;
  clientId?: string | null;
};

type WorkflowPauseRecord = {
  projectId: string;
  engagementId: string;
  workflowRunId: string;
  agentTaskId?: string;
  requiredApprovalTarget: string;
};

type WorkflowTaskRecord = {
  id: string;
  projectId?: string | null;
  engagementId?: string | null;
  workflowRunId?: string | null;
};

export type WorkflowAction = "run" | "resume";

export function authorizeWorkflowAction(input: {
  actor: AuthenticatedActor;
  project: WorkflowProjectRecord;
  engagementId?: string;
  action: WorkflowAction;
}): { clientId: string } {
  const clientId = typeof input.project.clientId === "string" ? input.project.clientId.trim() : "";
  if (!clientId) {
    forbidden("workflow_project_missing_client_scope");
  }

  if (input.engagementId && input.engagementId !== input.project.id) {
    forbidden("workflow_engagement_project_mismatch");
  }

  if (input.action !== "run" && input.action !== "resume") {
    forbidden("workflow_action_unsupported");
  }

  if (input.actor.role === "internal_admin") {
    return { clientId };
  }

  if (input.actor.role === "internal_operator") {
    forbidden("internal_operator_assignment_required");
  }

  forbidden("client_user_internal_control_denied");
}

export function validateWorkflowResumeLinkage(input: {
  project: WorkflowProjectRecord;
  pauseState: WorkflowPauseRecord;
  task: WorkflowTaskRecord;
}): void {
  const { project, pauseState, task } = input;
  if (pauseState.projectId !== project.id || pauseState.engagementId !== project.id) {
    concealedNotFound("workflow_pause_project_linkage_mismatch");
  }

  if (
    !pauseState.agentTaskId
    || pauseState.agentTaskId !== task.id
    || pauseState.requiredApprovalTarget !== `agent_task:${task.id}`
  ) {
    concealedNotFound("workflow_pause_task_linkage_mismatch");
  }

  if (task.projectId !== project.id || task.engagementId !== project.id) {
    concealedNotFound("workflow_task_project_linkage_mismatch");
  }

  if (task.workflowRunId && task.workflowRunId !== pauseState.workflowRunId) {
    concealedNotFound("workflow_run_linkage_mismatch");
  }
}