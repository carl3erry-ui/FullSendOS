import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { getAuthenticatedActor, issueDevTestActorToken } from "../lib/security/authentication";
import { requireClientAccess, requireEngagementAccess, requireInternalAdmin } from "../lib/security/authorization";
import {
  clearSecurityAuditEventsForTests,
  getSecurityAuditEventsForTests,
  recordSecurityDecision,
} from "../lib/security/security-audit";
import { createEmptyProject } from "../src/schemas/projectSchema.js";
import { saveProject } from "../src/storage/projectStore.js";

const projectStorageDir = path.resolve("data/projects");

async function cleanupProject(projectId: string) {
  await fs.rm(path.join(projectStorageDir, `${projectId}.json`), { force: true });
}

test("missing identity fails closed", () => {
  const request = new Request("http://localhost/api/secure");
  const result = getAuthenticatedActor(request, {
    NODE_ENV: "development",
    FULLSENDOS_AUTH_DEV_TEST_ENABLED: "1",
    FULLSENDOS_AUTH_DEV_TEST_SECRET: "test-secret",
  } as NodeJS.ProcessEnv);

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.reason, "missing_identity");
  }
});

test("malformed identity fails closed", () => {
  const request = new Request("http://localhost/api/secure", {
    headers: { authorization: "Bearer not-a-valid-token" },
  });

  const result = getAuthenticatedActor(request, {
    NODE_ENV: "development",
    FULLSENDOS_AUTH_DEV_TEST_ENABLED: "1",
    FULLSENDOS_AUTH_DEV_TEST_SECRET: "test-secret",
  } as NodeJS.ProcessEnv);

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.reason, /malformed_identity|invalid_signature/);
  }
});

test("valid internal admin, operator, and client user authenticate", () => {
  const env = {
    NODE_ENV: "development",
    FULLSENDOS_AUTH_DEV_TEST_ENABLED: "1",
    FULLSENDOS_AUTH_DEV_TEST_SECRET: "test-secret",
  } as NodeJS.ProcessEnv;

  const adminToken = issueDevTestActorToken({ sub: "admin-1", role: "internal_admin" }, "test-secret");
  const operatorToken = issueDevTestActorToken(
    { sub: "op-1", role: "internal_operator", clientId: "client-1" },
    "test-secret",
  );
  const clientToken = issueDevTestActorToken(
    { sub: "client-user-1", role: "client_user", clientId: "client-1" },
    "test-secret",
  );

  const admin = getAuthenticatedActor(new Request("http://localhost", { headers: { authorization: `Bearer ${adminToken}` } }), env);
  const operator = getAuthenticatedActor(new Request("http://localhost", { headers: { authorization: `Bearer ${operatorToken}` } }), env);
  const client = getAuthenticatedActor(new Request("http://localhost", { headers: { authorization: `Bearer ${clientToken}` } }), env);

  assert.equal(admin.ok, true);
  assert.equal(operator.ok, true);
  assert.equal(client.ok, true);
});

test("development/test adapter is disabled in production", () => {
  const token = issueDevTestActorToken({ sub: "admin-1", role: "internal_admin" }, "prod-secret");
  const request = new Request("http://localhost", {
    headers: { authorization: `Bearer ${token}` },
  });

  const result = getAuthenticatedActor(request, {
    NODE_ENV: "production",
    FULLSENDOS_AUTH_DEV_TEST_ENABLED: "1",
    FULLSENDOS_AUTH_DEV_TEST_SECRET: "prod-secret",
  } as NodeJS.ProcessEnv);

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.reason, "provider_not_configured");
  }
});

test("authorization policies enforce tenant and internal-role boundaries", async () => {
  const admin = { id: "admin-1", role: "internal_admin", authenticated: true } as const;
  const operator = {
    id: "op-1",
    role: "internal_operator",
    clientId: "client-a",
    authenticated: true,
  } as const;
  const clientUser = {
    id: "client-user-1",
    role: "client_user",
    clientId: "client-a",
    authenticated: true,
  } as const;

  requireInternalAdmin(admin);
  assert.throws(() => requireInternalAdmin(operator), /FORBIDDEN/);

  requireClientAccess(admin, "client-b");
  requireClientAccess(operator, "client-a");
  requireClientAccess(clientUser, "client-a");

  assert.throws(() => requireClientAccess(operator, "client-b"), /FORBIDDEN/);
  assert.throws(() => requireClientAccess(clientUser, "client-b"), /NOT_FOUND/);

  const project = createEmptyProject({
    clientId: "client-b",
    companyName: "Tenant Scope Co",
    objective: "Validate engagement ownership checks",
  });
  await saveProject(project);

  try {
    const clientId = await requireEngagementAccess(admin, project.id);
    assert.equal(clientId, "client-b");

    const operatorProject = createEmptyProject({
      clientId: "client-a",
      companyName: "Operator Scope Co",
      objective: "Validate operator ownership checks",
    });
    await saveProject(operatorProject);

    try {
      const ownClientId = await requireEngagementAccess(operator, operatorProject.id);
      assert.equal(ownClientId, "client-a");
    } finally {
      await cleanupProject(operatorProject.id);
    }

    await assert.rejects(() => requireEngagementAccess(clientUser, project.id), /NOT_FOUND/);
    await assert.rejects(() => requireEngagementAccess(clientUser, "missing-engagement-id"), /NOT_FOUND/);
  } finally {
    await cleanupProject(project.id);
  }
});

test("security audit events record allow/deny decisions without token leakage", async () => {
  clearSecurityAuditEventsForTests();

  await recordSecurityDecision({
    timestamp: new Date().toISOString(),
    actorId: "admin-1",
    actorRole: "internal_admin",
    action: "demo_workspace_seed",
    resourceType: "demo_workspace",
    resourceId: "seed",
    decision: "allow",
    reasonCode: "internal_admin_granted",
  });

  await recordSecurityDecision({
    timestamp: new Date().toISOString(),
    actorId: null,
    actorRole: "anonymous",
    action: "client_data_room_files_read",
    resourceType: "client",
    resourceId: "client-a",
    decision: "deny",
    reasonCode: "missing_identity",
  });

  const events = getSecurityAuditEventsForTests();
  assert.equal(events.length >= 2, true);

  const serialized = JSON.stringify(events);
  assert.equal(serialized.includes("authorization"), false);
  assert.equal(serialized.includes("Bearer"), false);
  assert.equal(serialized.includes("token"), false);
});
