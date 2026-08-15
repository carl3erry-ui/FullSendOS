import type { AuthenticatedActor } from "./types";
import { forbidden } from "./security-response";

type WorkflowProjectRecord = {
  id: string;
  clientId?: string | null;
};

export type WorkflowAction = "run";

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

  if (input.action !== "run") {
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