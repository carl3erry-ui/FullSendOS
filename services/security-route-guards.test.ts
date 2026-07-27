import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { GET as getClientDataRoomFiles } from "../app/api/clients/[clientId]/data-room/files/route";
import { POST as postHumanInputAnswer } from "../app/api/human-input/[id]/answer/route";
import { POST as postDemoSeed } from "../app/api/demo/seed/route";
import { createClient } from "../src/schemas/clientSchema.js";
import { saveClient } from "../src/storage/clientStore.js";
import { addFileReference } from "./client-data-room-store";
import { createHumanInputRequest } from "./human-input-service";
import { createTestNextRequest } from "./test-next-request";
import { createTestAuthHeader } from "./test-auth";
import {
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
});

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
