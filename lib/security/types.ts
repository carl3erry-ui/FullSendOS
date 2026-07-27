export type ActorRole = "internal_admin" | "internal_operator" | "client_user";

export type AuthenticatedActor = {
  id: string;
  role: ActorRole;
  clientId?: string;
  displayName?: string;
  authenticated: true;
};

export type SecurityDecision = "allow" | "deny";

export type SecurityDecisionAuditEvent = {
  timestamp: string;
  actorId: string | null;
  actorRole: ActorRole | "anonymous";
  action: string;
  resourceType: string;
  resourceId?: string;
  decision: SecurityDecision;
  reasonCode: string;
};
