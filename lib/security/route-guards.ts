import type { AuthenticatedActor, SecurityDecisionAuditEvent } from "./types";
import { getAuthenticatedActor } from "./authentication";
import { recordSecurityDecision } from "./security-audit";
import { unauthorized } from "./security-response";

type SecurityActionInput = {
  action: string;
  resourceType: string;
  resourceId?: string;
};

function buildEvent(input: {
  actor: AuthenticatedActor | null;
  action: string;
  resourceType: string;
  resourceId?: string;
  decision: "allow" | "deny";
  reasonCode: string;
}): SecurityDecisionAuditEvent {
  return {
    timestamp: new Date().toISOString(),
    actorId: input.actor?.id ?? null,
    actorRole: input.actor?.role ?? "anonymous",
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    decision: input.decision,
    reasonCode: input.reasonCode,
  };
}

export async function recordAllow(
  actor: AuthenticatedActor,
  input: SecurityActionInput,
  reasonCode: string,
): Promise<void> {
  await recordSecurityDecision(
    buildEvent({
      actor,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      decision: "allow",
      reasonCode,
    }),
  );
}

export async function recordDeny(
  actor: AuthenticatedActor | null,
  input: SecurityActionInput,
  reasonCode: string,
): Promise<void> {
  await recordSecurityDecision(
    buildEvent({
      actor,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      decision: "deny",
      reasonCode,
    }),
  );
}

export async function requireAuthenticatedActor(
  request: Request,
  input: SecurityActionInput,
): Promise<AuthenticatedActor> {
  const auth = getAuthenticatedActor(request);
  if (!auth.ok) {
    await recordDeny(null, input, auth.reason);
    unauthorized(auth.reason);
  }

  await recordAllow(auth.actor, input, "authenticated");
  return auth.actor;
}
