import type { HumanInputRequest } from "@/schemas/human-input";
import { requireClientAccess } from "./authorization";
import { forbidden } from "./security-response";
import type { AuthenticatedActor } from "./types";

export function requireHumanInputMutationAccess(
  actor: AuthenticatedActor,
  request: Pick<HumanInputRequest, "clientId">,
): void {
  if (actor.role === "internal_admin") {
    return;
  }

  if (actor.role === "internal_operator") {
    forbidden("internal_operator_assignment_required");
  }

  if (actor.role !== "client_user") {
    forbidden("human_input_access_denied");
  }

  if (!request.clientId) {
    forbidden("client_scope_required");
  }

  requireClientAccess(actor, request.clientId);
}