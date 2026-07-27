import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { GET as getClientDataRoomFiles } from "../app/api/clients/[clientId]/data-room/files/route";
import { POST as postHumanInputAnswer } from "../app/api/human-input/[id]/answer/route";
import { POST as postHumanInputConfirm } from "../app/api/human-input/[id]/confirm/route";
import { POST as postHumanInputReject } from "../app/api/human-input/[id]/reject/route";
import { POST as postHumanInputSkip } from "../app/api/human-input/[id]/skip/route";
import { POST as postDemoSeed } from "../app/api/demo/seed/route";
import { createClient } from "../src/schemas/clientSchema.js";
import { saveClient } from "../src/storage/clientStore.js";
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
