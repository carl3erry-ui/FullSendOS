import type { AgentTask } from "@/agents/types";
import type { AuthenticatedActor } from "./types";
import { concealedNotFound, forbidden } from "./security-response";

type AgentTaskProjectRecord = {
  id: string;
  clientId?: string | null;
};

export type AgentTaskOwnership = {
  project: AgentTaskProjectRecord;
  clientId: string;
};

export type AgentTaskAction = "run" | "approve" | "reject" | "request_revision";

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === "object" && error !== null && "code" in error;
}

export async function resolveAgentTaskRunOwnership(task: AgentTask): Promise<AgentTaskOwnership> {
  if (!task.projectId) {
    forbidden("agent_task_project_link_required");
  }

  const { loadProject } = await import("@/src/storage/projectStore.js");

  let project: AgentTaskProjectRecord;
  try {
    project = await loadProject(task.projectId);
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      concealedNotFound("agent_task_project_not_found");
    }
    throw error;
  }

  // Engagement linkage must agree with project linkage when both are present.
  if (task.engagementId && task.engagementId !== task.projectId) {
    forbidden("agent_task_linkage_mismatch");
  }

  const clientId = typeof project.clientId === "string" ? project.clientId.trim() : "";
  if (!clientId) {
    forbidden("agent_task_project_missing_client_scope");
  }

  return { project, clientId };
}

export function authorizeAgentTaskAction(input: {
  actor: AuthenticatedActor;
  task: AgentTask;
  project: AgentTaskProjectRecord;
  action: AgentTaskAction;
}): void {
  if (
    input.action !== "run"
    && input.action !== "approve"
    && input.action !== "reject"
    && input.action !== "request_revision"
  ) {
    forbidden("agent_task_action_unsupported");
  }

  if (input.actor.role === "internal_admin") {
    return;
  }

  if (input.actor.role === "internal_operator") {
    forbidden("internal_operator_assignment_required");
  }

  forbidden("client_user_internal_control_denied");
}
