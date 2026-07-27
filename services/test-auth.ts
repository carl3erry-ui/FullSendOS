import { issueDevTestActorToken } from "../lib/security/authentication";
import type { ActorRole } from "../lib/security/types";

type TestActorInput = {
  id: string;
  role: ActorRole;
  clientId?: string;
  displayName?: string;
};

export function createTestAuthHeader(actor: TestActorInput): string {
  const token = issueDevTestActorToken({
    sub: actor.id,
    role: actor.role,
    clientId: actor.clientId,
    displayName: actor.displayName,
  });
  return `Bearer ${token}`;
}
