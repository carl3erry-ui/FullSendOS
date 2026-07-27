import type { AuthenticatedActor } from "./types";
import { concealedNotFound, forbidden } from "./security-response";

export function requireInternalAdmin(actor: AuthenticatedActor): void {
  if (actor.role !== "internal_admin") {
    forbidden("internal_admin_required");
  }
}

function actorHasClientAccess(actor: AuthenticatedActor, clientId: string): boolean {
  if (actor.role === "internal_admin") return true;
  if (!actor.clientId) return false;
  if (actor.role === "internal_operator") return actor.clientId === clientId;
  if (actor.role === "client_user") return actor.clientId === clientId;
  return false;
}

export function requireClientAccess(actor: AuthenticatedActor, clientId: string): void {
  if (actorHasClientAccess(actor, clientId)) {
    return;
  }

  if (actor.role === "client_user") {
    concealedNotFound("client_resource_concealed");
  }

  forbidden("client_access_denied");
}

export async function requireEngagementAccess(actor: AuthenticatedActor, engagementId: string): Promise<string> {
  const { loadProject } = await import("@/src/storage/projectStore.js");

  let project: { id: string; clientId?: string | null };
  try {
    project = await loadProject(engagementId);
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "ENOENT") {
      concealedNotFound("engagement_not_found");
    }
    throw error;
  }

  const clientId = project.clientId || "";
  if (!clientId) {
    forbidden("engagement_missing_client_scope");
  }

  requireClientAccess(actor, clientId);
  return clientId;
}
