import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { GET as getClientDataRoomFiles } from "../app/api/clients/[clientId]/data-room/files/route";
import { POST as postHumanInputAnswer } from "../app/api/human-input/[id]/answer/route";
import { POST as postHumanInputConfirm } from "../app/api/human-input/[id]/confirm/route";
import { POST as postHumanInputReject } from "../app/api/human-input/[id]/reject/route";
import { POST as postHumanInputSkip } from "../app/api/human-input/[id]/skip/route";
import { POST as postAgentTaskRun } from "../app/api/agent-tasks/[id]/run/route";
import { POST as postDemoSeed } from "../app/api/demo/seed/route";
import { AgentTaskSchema, globalExecutionStore, globalTaskStore } from "../agents";
import { createClient } from "../src/schemas/clientSchema.js";
import { createEmptyProject } from "../src/schemas/projectSchema.js";
import { saveClient } from "../src/storage/clientStore.js";
import { saveProject } from "../src/storage/projectStore.js";
import { addFileReference } from "./client-data-room-store";
import { createHumanInputRequest, getHumanInputRequest } from "./human-input-service";
import { createTestNextRequest } from "./test-next-request";
import { createTestAuthHeader } from "./test-auth";
import {
  clearSecurityAuditEventsForTests,
  getSecurityAuditEventsForTests,
  resetSecurityAuditSinkForTests,
  setSecurityAuditSinkForTests,
} from "../lib/security/security-audit";

const clientStorageDir = path.resolve("data/clients");
const uploadStorageDir = path.resolve("data/uploads");
const requestStorageDir = path.resolve("data/human-input-requests");
const projectStorageDir = path.resolve("data/projects");

process.env.FULLSENDOS_AUTH_DEV_TEST_ENABLED = "1";
process.env.FULLSENDOS_AUTH_DEV_TEST_SECRET = "route-guard-test-secret-0123456789";

test.afterEach(() => {
  resetSecurityAuditSinkForTests();
  clearSecurityAuditEventsForTests();
});

type HumanInputMutationRoute = {
  name: string;
  route: typeof postHumanInputConfirm;
  status: "confirmed" | "rejected" | "skipped";
  action: string;
  serviceResponse: string;
};

const humanInputMutationRoutes: HumanInputMutationRoute[] = [
  {
    name: "confirm",
    route: postHumanInputConfirm,
    status: "confirmed",
    action: "human_input_confirm",
    serviceResponse: "Confirmed by test",
  },
  {
    name: "reject",
    route: postHumanInputReject,
    status: "rejected",
    action: "human_input_reject",
    serviceResponse: "Rejected by test",
  },
  {
    name: "skip",
    route: postHumanInputSkip,
    status: "skipped",
    action: "human_input_skip",
    serviceResponse: "Skipped by test",
  },
];

async function cleanupClient(id: string) {
  await fs.rm(path.join(clientStorageDir, `${id}.json`), { force: true });
  await fs.rm(path.join(clientStorageDir, `${id}-data-room.json`), { force: true });
}

async function removeUploadArtifacts(clientId: string) {
  await fs.mkdir(uploadStorageDir, { recursive: true });
  const files = await fs.readdir(uploadStorageDir);
  await Promise.all(
    files
      .filter((name) => name.startsWith(`${clientId}-`))
      .map((name) => fs.rm(path.join(uploadStorageDir, name), { force: true })),
  );
}

async function cleanupRequest(id: string) {
  await fs.rm(path.join(requestStorageDir, `${id}.json`), { force: true });
}

async function cleanupProject(id: string) {
  await fs.rm(path.join(projectStorageDir, `${id}.json`), { force: true });
}

async function cleanupTaskArtifacts(taskId: string) {
  await fs.rm(path.join("data/agent-tasks", `${taskId}.json`), { force: true });
  const executions = await globalExecutionStore.listByTaskId(taskId);
  await Promise.all(
    executions.map((execution) =>
      fs.rm(path.join("data/agent-executions", `${execution.id}.json`), { force: true }),
    ),
  );
}

function makeAgentTaskRunRequest(taskId: string, body: Record<string, unknown> = {}, headers: Record<string, string> = {}) {
  return createTestNextRequest(`http://localhost/api/agent-tasks/${taskId}/run`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

async function createProjectRecord(input: { clientId?: string; companyName: string; objective: string }) {
  const project = createEmptyProject({
    companyName: input.companyName,
    objective: input.objective,
    clientId: input.clientId,
  });
  await saveProject(project);
  return project;
}

function buildAgentTask(overrides: Record<string, unknown> = {}) {
  const now = new Date().toISOString();
  return AgentTaskSchema.parse({
    id: `task-security-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    agentId: "orchestrator",
    title: "Security route run task",
    objective: "Validate run route security enforcement",
    status: "queued",
    provider: "mock",
    model: "mock-1.0",
    approvalStatus: "not_required",
    priority: "high",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });
}

function makeMutationRequest(url: string, body: Record<string, unknown>, headers: Record<string, string>) {
  return createTestNextRequest(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

async function readAuditEventsForRoute(action: string) {
  return getSecurityAuditEventsForTests().filter((event) => event.action === action);
}

test("client-owned read route denies unauthenticated requests", async () => {
  const response = await getClientDataRoomFiles(
    createTestNextRequest("http://127.0.0.1/api/clients/client-a/data-room/files"),
    { params: Promise.resolve({ clientId: "client-a" }) },
  );

  assert.equal(response.status, 401);
});

test("client-owned read route allows authorized same-client user and conceals cross-client access", async () => {
  const clientA = createClient({ name: "Security Route Client A" });
  const clientB = createClient({ name: "Security Route Client B" });
  await saveClient(clientA);
  await saveClient(clientB);

  try {
    const uploadPath = path.join(uploadStorageDir, `${clientA.id}-evidence.txt`);
    await fs.mkdir(uploadStorageDir, { recursive: true });
    await fs.writeFile(uploadPath, "Tenant-scoped evidence", "utf8");

    await addFileReference(
      clientA.id,
      {
        name: "evidence.txt",
        mimeType: "text/plain",
        size: 24,
        approvedForAgentUse: true,
        sensitive: false,
      },
      "tester",
      uploadPath,
    );

    const allowResponse = await getClientDataRoomFiles(
      createTestNextRequest(`http://127.0.0.1/api/clients/${clientA.id}/data-room/files`, {
        headers: {
          authorization: createTestAuthHeader({
            id: "client-user-1",
            role: "client_user",
            clientId: clientA.id,
          }),
        },
      }),
      { params: Promise.resolve({ clientId: clientA.id }) },
    );

    assert.equal(allowResponse.status, 200);
    const allowBody = await allowResponse.json();
    assert.equal(allowBody.clientId, clientA.id);
    assert.equal(Array.isArray(allowBody.files), true);

    const denyResponse = await getClientDataRoomFiles(
      createTestNextRequest(`http://127.0.0.1/api/clients/${clientB.id}/data-room/files`, {
        headers: {
          authorization: createTestAuthHeader({
            id: "client-user-1",
            role: "client_user",
            clientId: clientA.id,
          }),
        },
      }),
      { params: Promise.resolve({ clientId: clientB.id }) },
    );

    assert.equal(denyResponse.status, 404);
  } finally {
    await cleanupClient(clientA.id);
    await cleanupClient(clientB.id);
    await removeUploadArtifacts(clientA.id);
    await removeUploadArtifacts(clientB.id);
  }
});

test("client-owned mutation route denies unauthenticated requests", async () => {
  const requestRecord = await createHumanInputRequest({
    clientId: "client-auth-mutation",
    engagementId: "eng-auth-mutation",
    type: "clarification",
    title: "Confirm legal name",
    prompt: "Please confirm legal name.",
    priority: "high",
    requestedBy: "system",
    requiredToContinue: false,
    options: [],
    evidence: [],
    sourceReferences: [],
    metadata: {},
  });

  try {
    const response = await postHumanInputAnswer(
      new Request(`http://localhost/api/human-input/${requestRecord.id}/answer`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ response: "Confirmed" }),
      }),
      { params: Promise.resolve({ id: requestRecord.id }) },
    );

    assert.equal(response.status, 401);
  } finally {
    await cleanupRequest(requestRecord.id);
  }
});

test("client-owned mutation route allows authorized client and denies cross-client user", async () => {
  const requestRecord = await createHumanInputRequest({
    clientId: "client-owned-a",
    engagementId: "eng-owned-a",
    type: "clarification",
    title: "Confirm ownership",
    prompt: "Confirm ownership details.",
    priority: "medium",
    requestedBy: "system",
    requiredToContinue: false,
    options: [],
    evidence: [],
    sourceReferences: [],
    metadata: {},
  });

  try {
    const allowed = await postHumanInputAnswer(
      new Request(`http://localhost/api/human-input/${requestRecord.id}/answer`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: createTestAuthHeader({
            id: "client-user-a",
            role: "client_user",
            clientId: "client-owned-a",
          }),
        },
        body: JSON.stringify({ response: "Approved" }),
      }),
      { params: Promise.resolve({ id: requestRecord.id }) },
    );

    assert.equal(allowed.status, 200);

    const denied = await postHumanInputAnswer(
      new Request(`http://localhost/api/human-input/${requestRecord.id}/answer`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: createTestAuthHeader({
            id: "client-user-b",
            role: "client_user",
            clientId: "client-owned-b",
          }),
        },
        body: JSON.stringify({ response: "Attempted cross-tenant answer" }),
      }),
      { params: Promise.resolve({ id: requestRecord.id }) },
    );

    assert.equal(denied.status, 404);
  } finally {
    await cleanupRequest(requestRecord.id);
  }
});

for (const mutationRoute of humanInputMutationRoutes) {
  test(`human-input ${mutationRoute.name} route enforces authz, audit, and state transitions`, async () => {
    clearSecurityAuditEventsForTests();

    const requestRecord = await createHumanInputRequest({
      clientId: "client-mutation-a",
      engagementId: "eng-mutation-a",
      type: "clarification",
      title: `Mutation ${mutationRoute.name}`,
      prompt: `Please exercise the ${mutationRoute.name} route.`,
      priority: "medium",
      requestedBy: "system",
      requiredToContinue: false,
      options: [],
      evidence: [],
      sourceReferences: [],
      metadata: {},
    });

    try {
      const allowed = await mutationRoute.route(
        makeMutationRequest(
          `http://localhost/api/human-input/${requestRecord.id}/${mutationRoute.name}`,
          { response: mutationRoute.serviceResponse },
          {
            authorization: createTestAuthHeader({
              id: "client-user-a",
              role: "client_user",
              clientId: "client-mutation-a",
            }),
          },
        ),
        { params: Promise.resolve({ id: requestRecord.id }) },
      );

      assert.equal(allowed.status, 200);
      const allowedBody = await allowed.json();
      assert.equal(allowedBody.data.status, mutationRoute.status);

      const updated = await getHumanInputRequest(requestRecord.id);
      assert.equal(updated.status, mutationRoute.status);

      const events = await readAuditEventsForRoute(mutationRoute.action);
      assert.equal(events.some((event) => event.decision === "allow"), true);
      assert.equal(events.some((event) => event.reasonCode === "authenticated"), true);

      const denied = await mutationRoute.route(
        makeMutationRequest(
          `http://localhost/api/human-input/${requestRecord.id}/${mutationRoute.name}`,
          { response: `Cross-client ${mutationRoute.name}`, clientId: "caller-overrides-client", engagementId: "caller-overrides-engagement" },
          {
            authorization: createTestAuthHeader({
              id: "client-user-b",
              role: "client_user",
              clientId: "client-mutation-b",
            }),
          },
        ),
        { params: Promise.resolve({ id: requestRecord.id }) },
      );

      assert.equal(denied.status, 404);

      const afterDenied = await getHumanInputRequest(requestRecord.id);
      assert.equal(afterDenied.status, mutationRoute.status);

      const deniedEvents = await readAuditEventsForRoute(mutationRoute.action);
      assert.equal(deniedEvents.some((event) => event.decision === "deny"), true);
    } finally {
      await cleanupRequest(requestRecord.id);
    }
  });
}

for (const mutationRoute of humanInputMutationRoutes) {
  test(`human-input ${mutationRoute.name} route keeps invalid bodies and auth failures safe`, async () => {
    clearSecurityAuditEventsForTests();

    const requestRecord = await createHumanInputRequest({
      clientId: "client-mutation-b",
      engagementId: "eng-mutation-b",
      type: "clarification",
      title: `Mutation ${mutationRoute.name} invalid body`,
      prompt: `Please exercise invalid body handling on ${mutationRoute.name}.`,
      priority: "medium",
      requestedBy: "system",
      requiredToContinue: false,
      options: [],
      evidence: [],
      sourceReferences: [],
      metadata: {},
    });

    try {
      const invalidResponse = await mutationRoute.route(
        makeMutationRequest(
          `http://localhost/api/human-input/${requestRecord.id}/${mutationRoute.name}`,
          { response: "" },
          {
            authorization: createTestAuthHeader({
              id: "client-user-b",
              role: "client_user",
              clientId: "client-mutation-b",
            }),
          },
        ),
        { params: Promise.resolve({ id: requestRecord.id }) },
      );

      assert.equal(invalidResponse.status, 400);
      const afterInvalid = await getHumanInputRequest(requestRecord.id);
      assert.equal(afterInvalid.status, "open");

      const unauthorizedResponse = await mutationRoute.route(
        makeMutationRequest(
          `http://localhost/api/human-input/${requestRecord.id}/${mutationRoute.name}`,
          { response: "Missing auth" },
          {},
        ),
        { params: Promise.resolve({ id: requestRecord.id }) },
      );

      assert.equal(unauthorizedResponse.status, 401);
      const unauthorizedBody = await unauthorizedResponse.json();
      assert.equal(JSON.stringify(unauthorizedBody).includes("Bearer"), false);
      assert.equal(JSON.stringify(unauthorizedBody).includes("authorization"), false);
      assert.equal(JSON.stringify(unauthorizedBody).includes("intentional audit sink failure"), false);
    } finally {
      await cleanupRequest(requestRecord.id);
    }
  });
}

for (const mutationRoute of humanInputMutationRoutes) {
  test(`human-input ${mutationRoute.name} route enforces role policy and concealed ownership`, async () => {
    clearSecurityAuditEventsForTests();

    const ownedRequest = await createHumanInputRequest({
      clientId: `client-${mutationRoute.name}-owned`,
      engagementId: `eng-${mutationRoute.name}-owned`,
      type: "clarification",
      title: `Owned ${mutationRoute.name}`,
      prompt: `Exercise role policy for ${mutationRoute.name}.`,
      priority: "medium",
      requestedBy: "system",
      requiredToContinue: false,
      options: [],
      evidence: [],
      sourceReferences: [],
      metadata: {},
    });

    const internalOnlyRequest = await createHumanInputRequest({
      engagementId: `eng-${mutationRoute.name}-internal`,
      type: "clarification",
      title: `Internal-only ${mutationRoute.name}`,
      prompt: `Exercise unscoped access for ${mutationRoute.name}.`,
      priority: "medium",
      requestedBy: "system",
      requiredToContinue: false,
      options: [],
      evidence: [],
      sourceReferences: [],
      metadata: {},
    });

    try {
      const adminResponse = await mutationRoute.route(
        makeMutationRequest(
          `http://localhost/api/human-input/${ownedRequest.id}/${mutationRoute.name}`,
          { response: `Admin ${mutationRoute.name}` },
          {
            authorization: createTestAuthHeader({ id: "admin-1", role: "internal_admin" }),
          },
        ),
        { params: Promise.resolve({ id: ownedRequest.id }) },
      );

      assert.equal(adminResponse.status, 200);

      const operatorResponse = await mutationRoute.route(
        makeMutationRequest(
          `http://localhost/api/human-input/${ownedRequest.id}/${mutationRoute.name}`,
          { response: `Operator ${mutationRoute.name}` },
          {
            authorization: createTestAuthHeader({
              id: "operator-1",
              role: "internal_operator",
              clientId: `client-${mutationRoute.name}-owned`,
            }),
          },
        ),
        { params: Promise.resolve({ id: ownedRequest.id }) },
      );

      assert.equal(operatorResponse.status, 403);

      const crossClientResponse = await mutationRoute.route(
        makeMutationRequest(
          `http://localhost/api/human-input/${ownedRequest.id}/${mutationRoute.name}`,
          {
            response: `Cross-client ${mutationRoute.name}`,
            clientId: "caller-overrides-client",
            engagementId: "caller-overrides-engagement",
          },
          {
            authorization: createTestAuthHeader({
              id: "client-user-cross",
              role: "client_user",
              clientId: `client-${mutationRoute.name}-other`,
            }),
          },
        ),
        { params: Promise.resolve({ id: ownedRequest.id }) },
      );

      assert.equal(crossClientResponse.status, 404);

      const internalOnlyDenied = await mutationRoute.route(
        makeMutationRequest(
          `http://localhost/api/human-input/${internalOnlyRequest.id}/${mutationRoute.name}`,
          { response: `Client user ${mutationRoute.name}` },
          {
            authorization: createTestAuthHeader({
              id: "client-user-unscoped",
              role: "client_user",
              clientId: `client-${mutationRoute.name}-owned`,
            }),
          },
        ),
        { params: Promise.resolve({ id: internalOnlyRequest.id }) },
      );

      assert.equal(internalOnlyDenied.status, 403);

      const missingRequest = await mutationRoute.route(
        makeMutationRequest(
          `http://localhost/api/human-input/missing-${mutationRoute.name}/${mutationRoute.name}`,
          { response: `Missing ${mutationRoute.name}` },
          {
            authorization: createTestAuthHeader({
              id: "client-user-missing",
              role: "client_user",
              clientId: `client-${mutationRoute.name}-owned`,
            }),
          },
        ),
        { params: Promise.resolve({ id: `missing-${mutationRoute.name}` }) },
      );

      assert.equal(missingRequest.status, 404);
      const missingBody = await missingRequest.json();
      assert.equal(JSON.stringify(missingBody).includes("missing-"), false);

      const allowedBody = await adminResponse.json();
      assert.equal(allowedBody.data.status, mutationRoute.status);

      const owned = await getHumanInputRequest(ownedRequest.id);
      assert.equal(owned.status, mutationRoute.status);

      const events = await readAuditEventsForRoute(mutationRoute.action);
      assert.equal(events.some((event) => event.decision === "allow"), true);
      assert.equal(events.some((event) => event.decision === "deny"), true);
    } finally {
      await cleanupRequest(ownedRequest.id);
      await cleanupRequest(internalOnlyRequest.id);
    }
  });
}

for (const mutationRoute of humanInputMutationRoutes) {
  test(`human-input ${mutationRoute.name} route preserves forbidden and concealed responses when audit fails`, async () => {
    setSecurityAuditSinkForTests(() => {
      throw new Error("intentional audit sink failure");
    });

    const requestRecord = await createHumanInputRequest({
      clientId: `client-${mutationRoute.name}-audit`,
      engagementId: `eng-${mutationRoute.name}-audit`,
      type: "clarification",
      title: `Audit failure ${mutationRoute.name}`,
      prompt: `Exercise audit failure handling for ${mutationRoute.name}.`,
      priority: "medium",
      requestedBy: "system",
      requiredToContinue: false,
      options: [],
      evidence: [],
      sourceReferences: [],
      metadata: {},
    });

    try {
      const forbiddenResponse = await mutationRoute.route(
        makeMutationRequest(
          `http://localhost/api/human-input/${requestRecord.id}/${mutationRoute.name}`,
          { response: `Operator ${mutationRoute.name}` },
          {
            authorization: createTestAuthHeader({
              id: "operator-audit",
              role: "internal_operator",
              clientId: `client-${mutationRoute.name}-audit`,
            }),
          },
        ),
        { params: Promise.resolve({ id: requestRecord.id }) },
      );

      assert.equal(forbiddenResponse.status, 403);
      const forbiddenBody = await forbiddenResponse.json();
      const forbiddenSerialized = JSON.stringify(forbiddenBody);
      assert.equal(forbiddenSerialized.includes("intentional audit sink failure"), false);
      assert.equal(forbiddenSerialized.includes("Bearer"), false);
      assert.equal(forbiddenSerialized.includes("authorization"), false);

      const concealedResponse = await mutationRoute.route(
        makeMutationRequest(
          `http://localhost/api/human-input/${requestRecord.id}/${mutationRoute.name}`,
          { response: `Cross-client ${mutationRoute.name}` },
          {
            authorization: createTestAuthHeader({
              id: "client-user-audit-cross",
              role: "client_user",
              clientId: `client-${mutationRoute.name}-other`,
            }),
          },
        ),
        { params: Promise.resolve({ id: requestRecord.id }) },
      );

      assert.equal(concealedResponse.status, 404);
      const concealedBody = await concealedResponse.json();
      const concealedSerialized = JSON.stringify(concealedBody);
      assert.equal(concealedSerialized.includes(requestRecord.id), false);
      assert.equal(concealedSerialized.includes(requestRecord.clientId || ""), false);
      assert.equal(concealedSerialized.includes("intentional audit sink failure"), false);
    } finally {
      await cleanupRequest(requestRecord.id);
    }
  });
}

test("human-input routes preserve overwrite behavior on repeated actions", async () => {
  const requestRecord = await createHumanInputRequest({
    clientId: "client-mutation-overwrite",
    engagementId: "eng-mutation-overwrite",
    type: "clarification",
    title: "Mutation overwrite",
    prompt: "Exercise overwrite behavior.",
    priority: "medium",
    requestedBy: "system",
    requiredToContinue: false,
    options: [],
    evidence: [],
    sourceReferences: [],
    metadata: {},
  });

  try {
    const first = await postHumanInputReject(
      makeMutationRequest(
        `http://localhost/api/human-input/${requestRecord.id}/reject`,
        { response: "Rejected once" },
        {
          authorization: createTestAuthHeader({
            id: "admin-1",
            role: "internal_admin",
          }),
        },
      ),
      { params: Promise.resolve({ id: requestRecord.id }) },
    );

    assert.equal(first.status, 200);

    const second = await postHumanInputReject(
      makeMutationRequest(
        `http://localhost/api/human-input/${requestRecord.id}/reject`,
        { response: "Rejected twice" },
        {
          authorization: createTestAuthHeader({
            id: "admin-1",
            role: "internal_admin",
          }),
        },
      ),
      { params: Promise.resolve({ id: requestRecord.id }) },
    );

    assert.equal(second.status, 200);
    const body = await second.json();
    assert.equal(body.data.status, "rejected");
    assert.equal(body.data.response, "Rejected twice");
  } finally {
    await cleanupRequest(requestRecord.id);
  }
});

test("human-input mutation audit events do not include mutation payload content", async () => {
  clearSecurityAuditEventsForTests();

  const confirmPayload = "CONFIDENTIAL_CONFIRMATION_PAYLOAD_ABC123";
  const rejectPayload = "SENSITIVE_REJECTION_REASON_XYZ789";

  const confirmRequest = await createHumanInputRequest({
    clientId: "client-mutation-audit-payload-confirm",
    engagementId: "eng-mutation-audit-payload-confirm",
    type: "clarification",
    title: "Audit payload confirm",
    prompt: "Confirm with sensitive payload.",
    priority: "medium",
    requestedBy: "system",
    requiredToContinue: false,
    options: [],
    evidence: [],
    sourceReferences: [],
    metadata: {},
  });

  const rejectRequest = await createHumanInputRequest({
    clientId: "client-mutation-audit-payload-reject",
    engagementId: "eng-mutation-audit-payload-reject",
    type: "clarification",
    title: "Audit payload reject",
    prompt: "Reject with sensitive payload.",
    priority: "medium",
    requestedBy: "system",
    requiredToContinue: false,
    options: [],
    evidence: [],
    sourceReferences: [],
    metadata: {},
  });

  try {
    const confirmResponse = await postHumanInputConfirm(
      makeMutationRequest(
        `http://localhost/api/human-input/${confirmRequest.id}/confirm`,
        { response: confirmPayload },
        {
          authorization: createTestAuthHeader({
            id: "admin-audit-payload",
            role: "internal_admin",
          }),
        },
      ),
      { params: Promise.resolve({ id: confirmRequest.id }) },
    );

    const rejectResponse = await postHumanInputReject(
      makeMutationRequest(
        `http://localhost/api/human-input/${rejectRequest.id}/reject`,
        { response: rejectPayload },
        {
          authorization: createTestAuthHeader({
            id: "admin-audit-payload",
            role: "internal_admin",
          }),
        },
      ),
      { params: Promise.resolve({ id: rejectRequest.id }) },
    );

    assert.equal(confirmResponse.status, 200);
    assert.equal(rejectResponse.status, 200);

    const events = getSecurityAuditEventsForTests().filter(
      (event) => event.action === "human_input_confirm" || event.action === "human_input_reject",
    );

    assert.equal(events.length >= 2, true);

    const serializedEvents = JSON.stringify(events);
    assert.equal(serializedEvents.includes(confirmPayload), false);
    assert.equal(serializedEvents.includes(rejectPayload), false);
    assert.equal(serializedEvents.includes("\"response\":"), false);
    assert.equal(serializedEvents.includes("\"resolvedBy\":"), false);
    assert.equal(serializedEvents.includes("Bearer"), false);
    assert.equal(serializedEvents.includes("authorization"), false);

    const confirmAllow = events.find(
      (event) => event.action === "human_input_confirm" && event.decision === "allow" && event.reasonCode === "human_input_confirmed",
    );
    const rejectAllow = events.find(
      (event) => event.action === "human_input_reject" && event.decision === "allow" && event.reasonCode === "human_input_rejected",
    );

    assert.ok(confirmAllow);
    assert.ok(rejectAllow);

    assert.equal(typeof confirmAllow.actorId, "string");
    assert.equal(confirmAllow.actorRole, "internal_admin");
    assert.equal(confirmAllow.action, "human_input_confirm");
    assert.equal(confirmAllow.resourceType, "human_input_request");
    assert.equal(confirmAllow.resourceId, confirmRequest.id);
    assert.equal(confirmAllow.decision, "allow");
    assert.equal(confirmAllow.reasonCode, "human_input_confirmed");

    assert.equal(typeof rejectAllow.actorId, "string");
    assert.equal(rejectAllow.actorRole, "internal_admin");
    assert.equal(rejectAllow.action, "human_input_reject");
    assert.equal(rejectAllow.resourceType, "human_input_request");
    assert.equal(rejectAllow.resourceId, rejectRequest.id);
    assert.equal(rejectAllow.decision, "allow");
    assert.equal(rejectAllow.reasonCode, "human_input_rejected");
  } finally {
    await cleanupRequest(confirmRequest.id);
    await cleanupRequest(rejectRequest.id);
  }
});

test("human-input mutation routes reject malformed payloads before mutation", async () => {
  const requestRecord = await createHumanInputRequest({
    clientId: "client-mutation-invalid",
    engagementId: "eng-mutation-invalid",
    type: "clarification",
    title: "Mutation invalid payload",
    prompt: "Exercise invalid payload handling.",
    priority: "medium",
    requestedBy: "system",
    requiredToContinue: false,
    options: [],
    evidence: [],
    sourceReferences: [],
    metadata: {},
  });

  try {
    const response = await postHumanInputConfirm(
      createTestNextRequest(`http://localhost/api/human-input/${requestRecord.id}/confirm`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: createTestAuthHeader({
            id: "client-user-invalid",
            role: "client_user",
            clientId: "client-mutation-invalid",
          }),
        },
        body: JSON.stringify({ response: "" }),
      }),
      { params: Promise.resolve({ id: requestRecord.id }) },
    );

    assert.equal(response.status, 400);
    const after = await getHumanInputRequest(requestRecord.id);
    assert.equal(after.status, "open");
  } finally {
    await cleanupRequest(requestRecord.id);
  }
});

test("human-input mutation routes preserve overwrite behavior on repeated transitions", async () => {
  const requestRecord = await createHumanInputRequest({
    clientId: "client-mutation-conflict",
    engagementId: "eng-mutation-conflict",
    type: "clarification",
    title: "Mutation conflict",
    prompt: "Exercise duplicate transition handling.",
    priority: "medium",
    requestedBy: "system",
    requiredToContinue: false,
    options: [],
    evidence: [],
    sourceReferences: [],
    metadata: {},
  });

  try {
    const firstResponse = await postHumanInputReject(
      createTestNextRequest(`http://localhost/api/human-input/${requestRecord.id}/reject`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: createTestAuthHeader({
            id: "internal-admin-1",
            role: "internal_admin",
          }),
        },
        body: JSON.stringify({ response: "Rejected once" }),
      }),
      { params: Promise.resolve({ id: requestRecord.id }) },
    );

    assert.equal(firstResponse.status, 200);

    const duplicateResponse = await postHumanInputReject(
      createTestNextRequest(`http://localhost/api/human-input/${requestRecord.id}/reject`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: createTestAuthHeader({
            id: "internal-admin-1",
            role: "internal_admin",
          }),
        },
        body: JSON.stringify({ response: "Rejected twice" }),
      }),
      { params: Promise.resolve({ id: requestRecord.id }) },
    );

    assert.equal(duplicateResponse.status, 200);
    const duplicateBody = await duplicateResponse.json();
    assert.equal(duplicateBody.data.status, "rejected");
    assert.equal(duplicateBody.data.response, "Rejected twice");
  } finally {
    await cleanupRequest(requestRecord.id);
  }
});

test("human-input mutation routes deny internal operators and leave state unchanged", async () => {
  const requestRecord = await createHumanInputRequest({
    clientId: "client-mutation-operator",
    engagementId: "eng-mutation-operator",
    type: "clarification",
    title: "Mutation operator denial",
    prompt: "Exercise internal operator denial.",
    priority: "medium",
    requestedBy: "system",
    requiredToContinue: false,
    options: [],
    evidence: [],
    sourceReferences: [],
    metadata: {},
  });

  try {
    const response = await postHumanInputSkip(
      createTestNextRequest(`http://localhost/api/human-input/${requestRecord.id}/skip`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: createTestAuthHeader({
            id: "operator-1",
            role: "internal_operator",
            clientId: "client-mutation-operator",
          }),
        },
        body: JSON.stringify({ response: "Skip attempt" }),
      }),
      { params: Promise.resolve({ id: requestRecord.id }) },
    );

    assert.equal(response.status, 403);
    const after = await getHumanInputRequest(requestRecord.id);
    assert.equal(after.status, "open");
  } finally {
    await cleanupRequest(requestRecord.id);
  }
});

test("internal-only route enforces internal role and allows internal admin", async () => {
  const unauthorized = await postDemoSeed(
    new Request("http://localhost/api/demo/seed", {
      method: "POST",
      headers: {
        authorization: createTestAuthHeader({
          id: "client-user-1",
          role: "client_user",
          clientId: "client-a",
        }),
      },
    }),
  );

  assert.equal(unauthorized.status, 403);

  const operatorDenied = await postDemoSeed(
    new Request("http://localhost/api/demo/seed", {
      method: "POST",
      headers: {
        authorization: createTestAuthHeader({
          id: "operator-1",
          role: "internal_operator",
          clientId: "client-a",
        }),
      },
    }),
  );

  assert.equal(operatorDenied.status, 403);

  const allowed = await postDemoSeed(
    new Request("http://localhost/api/demo/seed", {
      method: "POST",
      headers: {
        authorization: createTestAuthHeader({ id: "admin-1", role: "internal_admin" }),
      },
    }),
  );

  assert.equal(allowed.status, 200);
  const body = await allowed.json();
  assert.equal(body.success, true);
});

test("audit sink failure does not change deny outcome", async () => {
  setSecurityAuditSinkForTests(() => {
    throw new Error("intentional audit sink failure");
  });

  const response = await getClientDataRoomFiles(
    createTestNextRequest("http://127.0.0.1/api/clients/client-a/data-room/files"),
    { params: Promise.resolve({ clientId: "client-a" }) },
  );

  assert.equal(response.status, 401);
});

test("audit sink failure does not change allow outcome", async () => {
  setSecurityAuditSinkForTests(() => {
    throw new Error("intentional audit sink failure");
  });

  const client = createClient({ name: "Security Audit Failure Client" });
  await saveClient(client);

  try {
    const response = await getClientDataRoomFiles(
      createTestNextRequest(`http://127.0.0.1/api/clients/${client.id}/data-room/files`, {
        headers: {
          authorization: createTestAuthHeader({
            id: "client-user-audit",
            role: "client_user",
            clientId: client.id,
          }),
        },
      }),
      { params: Promise.resolve({ clientId: client.id }) },
    );

    assert.equal(response.status, 200);
  } finally {
    await cleanupClient(client.id);
    await removeUploadArtifacts(client.id);
  }
});

test("agent-task run route denies missing identity and records safe deny audit", async () => {
  const project = await createProjectRecord({
    clientId: "client-agent-run-auth",
    companyName: "Agent Run Auth",
    objective: "Auth check",
  });
  const task = buildAgentTask({ projectId: project.id, engagementId: project.id });
  await globalTaskStore.saveTask(task);

  try {
    const response = await postAgentTaskRun(
      makeAgentTaskRunRequest(task.id),
      { params: Promise.resolve({ id: task.id }) },
    );

    assert.equal(response.status, 401);

    const events = getSecurityAuditEventsForTests().filter((event) => event.action === "agent_task_run");
    assert.equal(events.some((event) => event.decision === "deny"), true);
    const serialized = JSON.stringify(events);
    assert.equal(serialized.includes("Bearer"), false);
    assert.equal(serialized.includes("authorization"), false);
    assert.equal(serialized.includes("projectId"), false);
  } finally {
    await cleanupTaskArtifacts(task.id);
    await cleanupProject(project.id);
  }
});

test("agent-task run route denies malformed identity", async () => {
  const project = await createProjectRecord({
    clientId: "client-agent-run-malformed",
    companyName: "Agent Run Malformed",
    objective: "Malformed check",
  });
  const task = buildAgentTask({ projectId: project.id, engagementId: project.id });
  await globalTaskStore.saveTask(task);

  try {
    const response = await postAgentTaskRun(
      makeAgentTaskRunRequest(task.id, {}, { authorization: "Bearer malformed-token" }),
      { params: Promise.resolve({ id: task.id }) },
    );

    assert.equal(response.status, 401);
  } finally {
    await cleanupTaskArtifacts(task.id);
    await cleanupProject(project.id);
  }
});

test("agent-task run route enforces role policy and denies internal operator and client user", async () => {
  const project = await createProjectRecord({
    clientId: "client-agent-run-roles",
    companyName: "Agent Run Roles",
    objective: "Role policy check",
  });
  const task = buildAgentTask({ projectId: project.id, engagementId: project.id });
  await globalTaskStore.saveTask(task);

  try {
    const operatorResponse = await postAgentTaskRun(
      makeAgentTaskRunRequest(task.id, {}, {
        authorization: createTestAuthHeader({
          id: "operator-run",
          role: "internal_operator",
          clientId: "client-agent-run-roles",
        }),
      }),
      { params: Promise.resolve({ id: task.id }) },
    );

    const clientUserResponse = await postAgentTaskRun(
      makeAgentTaskRunRequest(task.id, {}, {
        authorization: createTestAuthHeader({
          id: "client-user-run",
          role: "client_user",
          clientId: "client-agent-run-roles",
        }),
      }),
      { params: Promise.resolve({ id: task.id }) },
    );

    assert.equal(operatorResponse.status, 403);
    assert.equal(clientUserResponse.status, 403);

    const executions = await globalExecutionStore.listByTaskId(task.id);
    assert.equal(executions.length, 0);
  } finally {
    await cleanupTaskArtifacts(task.id);
    await cleanupProject(project.id);
  }
});

test("agent-task run route returns generic 404 for unknown task and does not execute", async () => {
  const response = await postAgentTaskRun(
    makeAgentTaskRunRequest("missing-agent-task", {}, {
      authorization: createTestAuthHeader({ id: "admin-missing", role: "internal_admin" }),
    }),
    { params: Promise.resolve({ id: "missing-agent-task" }) },
  );

  assert.equal(response.status, 404);
  const body = await response.json();
  assert.equal(JSON.stringify(body).includes("missing-agent-task"), false);
});

test("agent-task run route fails closed when project linkage is missing, broken, or mismatched", async () => {
  const project = await createProjectRecord({
    clientId: "client-agent-run-linkage",
    companyName: "Agent Run Linkage",
    objective: "Linkage check",
  });

  const missingProjectLinkTask = buildAgentTask({
    id: `task-missing-link-${Date.now()}`,
    engagementId: project.id,
  });
  const missingProjectTask = buildAgentTask({
    id: `task-missing-project-${Date.now()}`,
    projectId: `missing-project-${Date.now()}`,
    engagementId: `missing-project-${Date.now()}`,
  });
  const mismatchedLinkTask = buildAgentTask({
    id: `task-mismatch-link-${Date.now()}`,
    projectId: project.id,
    engagementId: `eng-mismatch-${Date.now()}`,
  });

  await globalTaskStore.saveTask(missingProjectLinkTask);
  await globalTaskStore.saveTask(missingProjectTask);
  await globalTaskStore.saveTask(mismatchedLinkTask);

  try {
    const adminHeader = {
      authorization: createTestAuthHeader({ id: "admin-linkage", role: "internal_admin" }),
    };

    const missingProjectLinkResponse = await postAgentTaskRun(
      makeAgentTaskRunRequest(
        missingProjectLinkTask.id,
        { projectId: project.id },
        adminHeader,
      ),
      { params: Promise.resolve({ id: missingProjectLinkTask.id }) },
    );

    const missingProjectResponse = await postAgentTaskRun(
      makeAgentTaskRunRequest(missingProjectTask.id, {}, adminHeader),
      { params: Promise.resolve({ id: missingProjectTask.id }) },
    );

    const mismatchedLinkResponse = await postAgentTaskRun(
      makeAgentTaskRunRequest(mismatchedLinkTask.id, {}, adminHeader),
      { params: Promise.resolve({ id: mismatchedLinkTask.id }) },
    );

    assert.equal(missingProjectLinkResponse.status, 403);
    assert.equal(missingProjectResponse.status, 404);
    assert.equal(mismatchedLinkResponse.status, 403);

    const missingProjectLinkExecutions = await globalExecutionStore.listByTaskId(missingProjectLinkTask.id);
    const missingProjectExecutions = await globalExecutionStore.listByTaskId(missingProjectTask.id);
    const mismatchedExecutions = await globalExecutionStore.listByTaskId(mismatchedLinkTask.id);

    assert.equal(missingProjectLinkExecutions.length, 0);
    assert.equal(missingProjectExecutions.length, 0);
    assert.equal(mismatchedExecutions.length, 0);
  } finally {
    await cleanupTaskArtifacts(missingProjectLinkTask.id);
    await cleanupTaskArtifacts(missingProjectTask.id);
    await cleanupTaskArtifacts(mismatchedLinkTask.id);
    await cleanupProject(project.id);
  }
});

test("agent-task run route fails closed when linked project has no client ownership", async () => {
  const project = await createProjectRecord({
    companyName: "Agent Run No Client",
    objective: "No client ownership",
  });
  const task = buildAgentTask({ projectId: project.id, engagementId: project.id });
  await globalTaskStore.saveTask(task);

  try {
    const response = await postAgentTaskRun(
      makeAgentTaskRunRequest(task.id, {}, {
        authorization: createTestAuthHeader({ id: "admin-no-client", role: "internal_admin" }),
      }),
      { params: Promise.resolve({ id: task.id }) },
    );

    assert.equal(response.status, 403);
    const executions = await globalExecutionStore.listByTaskId(task.id);
    assert.equal(executions.length, 0);
  } finally {
    await cleanupTaskArtifacts(task.id);
    await cleanupProject(project.id);
  }
});

test("agent-task run route allows internal admin and redacts unsafe execution diagnostics", async () => {
  const project = await createProjectRecord({
    clientId: "client-agent-run-allow",
    companyName: "Agent Run Allowed",
    objective: "Allowed run",
  });
  const task = buildAgentTask({ projectId: project.id, engagementId: project.id });
  await globalTaskStore.saveTask(task);

  try {
    const response = await postAgentTaskRun(
      makeAgentTaskRunRequest(task.id, {}, {
        authorization: createTestAuthHeader({ id: "admin-run", role: "internal_admin" }),
      }),
      { params: Promise.resolve({ id: task.id }) },
    );

    assert.equal(response.status, 200);
    const body = await response.json();
    const serialized = JSON.stringify(body);

    assert.equal(serialized.includes("systemPromptSnapshot"), false);
    assert.equal(serialized.includes("toolPermissionsSnapshot"), false);
    assert.equal(serialized.includes("rawResponse"), false);
    assert.equal(serialized.includes("inputSnapshot"), false);
    assert.equal(serialized.includes("authorization"), false);

    const events = getSecurityAuditEventsForTests().filter((event) => event.action === "agent_task_run");
    assert.equal(events.some((event) => event.decision === "allow"), true);
    const eventSerialized = JSON.stringify(events);
    assert.equal(eventSerialized.includes("systemPromptSnapshot"), false);
    assert.equal(eventSerialized.includes("toolPermissionsSnapshot"), false);
    assert.equal(eventSerialized.includes("rawResponse"), false);
    assert.equal(eventSerialized.includes("output"), false);
    assert.equal(eventSerialized.includes("diagnostic"), false);
  } finally {
    await cleanupTaskArtifacts(task.id);
    await cleanupProject(project.id);
  }
});

test("agent-task run route preserves completed-task behavior and does not re-execute", async () => {
  const project = await createProjectRecord({
    clientId: "client-agent-run-completed",
    companyName: "Agent Run Completed",
    objective: "Preserve completed behavior",
  });

  const completedTask = buildAgentTask({
    id: `task-completed-${Date.now()}`,
    projectId: project.id,
    engagementId: project.id,
    status: "completed",
    completedAt: new Date().toISOString(),
  });

  await globalTaskStore.saveTask(completedTask);

  try {
    const response = await postAgentTaskRun(
      makeAgentTaskRunRequest(completedTask.id, {}, {
        authorization: createTestAuthHeader({ id: "admin-completed", role: "internal_admin" }),
      }),
      { params: Promise.resolve({ id: completedTask.id }) },
    );

    assert.equal(response.status, 409);
    const body = await response.json();
    assert.equal(body.success, false);
    assert.equal(body.error?.code, "TASK_ALREADY_COMPLETED");

    const executions = await globalExecutionStore.listByTaskId(completedTask.id);
    assert.equal(executions.length, 0);
  } finally {
    await cleanupTaskArtifacts(completedTask.id);
    await cleanupProject(project.id);
  }
});

test("agent-task run route returns sanitized generic 500 for unexpected non-executor failures", async () => {
  const project = await createProjectRecord({
    clientId: "client-agent-run-unexpected",
    companyName: "Agent Run Unexpected",
    objective: "Unexpected failure sanitization",
  });
  const task = buildAgentTask({ projectId: project.id, engagementId: project.id });
  await globalTaskStore.saveTask(task);

  const originalLoadTask = globalTaskStore.loadTask.bind(globalTaskStore);
  const leakageMarker = "intentional-run-leak-message-ALPHA05203A";
  globalTaskStore.loadTask = async () => {
    throw new Error(leakageMarker);
  };

  try {
    const response = await postAgentTaskRun(
      makeAgentTaskRunRequest(task.id, {}, {
        authorization: createTestAuthHeader({ id: "admin-unexpected", role: "internal_admin" }),
      }),
      { params: Promise.resolve({ id: task.id }) },
    );

    assert.equal(response.status, 500);
    const body = await response.json();
    const serialized = JSON.stringify(body);
    assert.equal(body.error?.code, "INTERNAL_ERROR");
    assert.equal(serialized.includes(leakageMarker), false);
    assert.equal(serialized.includes("stack"), false);
    assert.equal(serialized.includes("/workspaces/"), false);
  } finally {
    globalTaskStore.loadTask = originalLoadTask;
    await cleanupTaskArtifacts(task.id);
    await cleanupProject(project.id);
  }
});

test("agent-task run route preserves duplicate-run and approval gating behavior", async () => {
  const project = await createProjectRecord({
    clientId: "client-agent-run-preconditions",
    companyName: "Agent Run Preconditions",
    objective: "Preserve preconditions",
  });

  const runningTask = buildAgentTask({
    id: `task-running-${Date.now()}`,
    projectId: project.id,
    engagementId: project.id,
    status: "running",
    startedAt: new Date().toISOString(),
  });
  const pendingApprovalTask = buildAgentTask({
    id: `task-pending-${Date.now()}`,
    projectId: project.id,
    engagementId: project.id,
    approvalStatus: "pending",
  });

  await globalTaskStore.saveTask(runningTask);
  await globalTaskStore.saveTask(pendingApprovalTask);

  try {
    const adminHeader = {
      authorization: createTestAuthHeader({ id: "admin-preconditions", role: "internal_admin" }),
    };

    const duplicateResponse = await postAgentTaskRun(
      makeAgentTaskRunRequest(runningTask.id, {}, adminHeader),
      { params: Promise.resolve({ id: runningTask.id }) },
    );
    const approvalResponse = await postAgentTaskRun(
      makeAgentTaskRunRequest(pendingApprovalTask.id, {}, adminHeader),
      { params: Promise.resolve({ id: pendingApprovalTask.id }) },
    );

    assert.equal(duplicateResponse.status, 409);
    assert.equal(approvalResponse.status, 403);

    const duplicateBody = await duplicateResponse.json();
    const approvalBody = await approvalResponse.json();
    assert.equal(duplicateBody.error?.code, "TASK_ALREADY_RUNNING");
    assert.equal(approvalBody.error?.code, "APPROVAL_REQUIRED");
  } finally {
    await cleanupTaskArtifacts(runningTask.id);
    await cleanupTaskArtifacts(pendingApprovalTask.id);
    await cleanupProject(project.id);
  }
});

test("agent-task run route preserves safe execution-failure mapping", async () => {
  const project = await createProjectRecord({
    clientId: "client-agent-run-failure",
    companyName: "Agent Run Failure",
    objective: "Preserve failure mapping",
  });
  const task = buildAgentTask({
    projectId: project.id,
    engagementId: project.id,
    provider: "xai",
  });
  await globalTaskStore.saveTask(task);

  try {
    const response = await postAgentTaskRun(
      makeAgentTaskRunRequest(task.id, {}, {
        authorization: createTestAuthHeader({ id: "admin-failure", role: "internal_admin" }),
      }),
      { params: Promise.resolve({ id: task.id }) },
    );

    assert.equal(response.status, 404);
    const body = await response.json();
    const serialized = JSON.stringify(body);
    assert.equal(serialized.includes("Error:"), false);
    assert.equal(serialized.includes("stack"), false);
  } finally {
    await cleanupTaskArtifacts(task.id);
    await cleanupProject(project.id);
  }
});

test("agent-task run route preserves outcomes when audit sink fails", async () => {
  setSecurityAuditSinkForTests(() => {
    throw new Error("intentional audit sink failure");
  });

  const project = await createProjectRecord({
    clientId: "client-agent-run-audit-fail",
    companyName: "Agent Run Audit Failure",
    objective: "Audit failure invariance",
  });
  const task = buildAgentTask({ projectId: project.id, engagementId: project.id });
  await globalTaskStore.saveTask(task);

  try {
    const successResponse = await postAgentTaskRun(
      makeAgentTaskRunRequest(task.id, {}, {
        authorization: createTestAuthHeader({ id: "admin-audit-fail", role: "internal_admin" }),
      }),
      { params: Promise.resolve({ id: task.id }) },
    );
    assert.equal(successResponse.status, 200);

    const unauthorizedResponse = await postAgentTaskRun(
      makeAgentTaskRunRequest(task.id),
      { params: Promise.resolve({ id: task.id }) },
    );
    assert.equal(unauthorizedResponse.status, 401);

    const forbiddenResponse = await postAgentTaskRun(
      makeAgentTaskRunRequest(task.id, {}, {
        authorization: createTestAuthHeader({
          id: "operator-audit-fail",
          role: "internal_operator",
          clientId: "client-agent-run-audit-fail",
        }),
      }),
      { params: Promise.resolve({ id: task.id }) },
    );
    assert.equal(forbiddenResponse.status, 403);

    const notFoundResponse = await postAgentTaskRun(
      makeAgentTaskRunRequest("missing-agent-task-audit", {}, {
        authorization: createTestAuthHeader({ id: "admin-audit-missing", role: "internal_admin" }),
      }),
      { params: Promise.resolve({ id: "missing-agent-task-audit" }) },
    );
    assert.equal(notFoundResponse.status, 404);
  } finally {
    await cleanupTaskArtifacts(task.id);
    await cleanupProject(project.id);
  }
});

test("agent-task run route preserves executor failure mapping when audit sink fails", async () => {
  setSecurityAuditSinkForTests(() => {
    throw new Error("intentional audit sink failure");
  });

  const project = await createProjectRecord({
    clientId: "client-agent-run-audit-executor-fail",
    companyName: "Agent Run Audit Executor Failure",
    objective: "Audit failure invariance for executor failures",
  });
  const task = buildAgentTask({
    projectId: project.id,
    engagementId: project.id,
    provider: "xai",
  });
  await globalTaskStore.saveTask(task);

  try {
    const response = await postAgentTaskRun(
      makeAgentTaskRunRequest(task.id, {}, {
        authorization: createTestAuthHeader({ id: "admin-audit-executor", role: "internal_admin" }),
      }),
      { params: Promise.resolve({ id: task.id }) },
    );

    assert.equal(response.status, 404);
    const body = await response.json();
    const serialized = JSON.stringify(body);
    assert.equal(body.error?.code, "PROVIDER_NOT_FOUND");
    assert.equal(serialized.includes("intentional audit sink failure"), false);
    assert.equal(serialized.includes("Bearer"), false);
    assert.equal(serialized.includes("authorization"), false);
    assert.equal(serialized.includes("rawResponse"), false);
    assert.equal(serialized.includes("systemPromptSnapshot"), false);
    assert.equal(serialized.includes("toolPermissionsSnapshot"), false);
    assert.equal(serialized.includes("Error:"), false);
    assert.equal(serialized.includes("stack"), false);
  } finally {
    await cleanupTaskArtifacts(task.id);
    await cleanupProject(project.id);
  }
});
