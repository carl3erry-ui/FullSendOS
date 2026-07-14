import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { GET as getClients, POST as createClient } from "../app/api/clients/route";
import { GET as getClientDetail, PATCH as patchClientLifecycle } from "../app/api/clients/[clientId]/route";
import { POST as createEngagement } from "../app/api/engagements/route";
import { loadProject } from "../src/storage/projectStore.js";

const clientStorageDir = path.resolve("data/clients");
const projectStorageDir = path.resolve("data/projects");

async function cleanupClient(id: string) {
  await fs.rm(path.join(clientStorageDir, `${id}.json`), { force: true });
}

async function cleanupProject(id: string) {
  await fs.rm(path.join(projectStorageDir, `${id}.json`), { force: true });
}

test("client routes support create, list, and detail with associated engagement summaries", async () => {
  const createClientRequest = new Request("http://127.0.0.1:3000/api/clients", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Client Route Test Co",
      industry: "Manufacturing",
      website: "https://client-route-test.example",
      primaryContact: "Dana Operator",
    }),
  });

  const createdClientResponse = await createClient(createClientRequest);
  const createdClientBody = await createdClientResponse.json();

  assert.equal(createdClientResponse.status, 201);
  assert.equal(typeof createdClientBody.id, "string");
  assert.equal(createdClientBody.name, "Client Route Test Co");

  let createdEngagementId: string | null = null;

  try {
    const engagementRequest = new Request("http://127.0.0.1:3000/api/engagements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: createdClientBody.id,
        companyName: "Client Route Test Co",
        objective: "Validate client-linked engagement flow",
      }),
    });

    const engagementResponse = await createEngagement(engagementRequest);
    const engagementBody = await engagementResponse.json();
    createdEngagementId = engagementBody.id;

    assert.equal(engagementResponse.status, 201);
    assert.equal(engagementBody.clientId, createdClientBody.id);

    const persisted = await loadProject(engagementBody.id);
    assert.equal(persisted.clientId, createdClientBody.id);

    const clientListResponse = await getClients();
    const clientListBody = await clientListResponse.json();

    assert.equal(clientListResponse.status, 200);
    assert.equal(Array.isArray(clientListBody), true);
    const listedClient = clientListBody.find((client: { id?: string }) => client.id === createdClientBody.id);
    assert.ok(listedClient);
    assert.equal(listedClient.engagementCount, 1);

    const detailResponse = await getClientDetail(new Request(`http://127.0.0.1:3000/api/clients/${createdClientBody.id}`), {
      params: Promise.resolve({ clientId: createdClientBody.id }),
    });
    const detailBody = await detailResponse.json();

    assert.equal(detailResponse.status, 200);
    assert.equal(detailBody.id, createdClientBody.id);
    assert.equal(detailBody.engagementCount, 1);
    assert.equal(Array.isArray(detailBody.engagements), true);
    assert.equal(detailBody.engagements.length, 1);
    assert.equal(detailBody.engagements[0].id, createdEngagementId);
  } finally {
    if (createdEngagementId) {
      await cleanupProject(createdEngagementId);
    }
    await cleanupClient(createdClientBody.id);
  }
});

test("engagement create rejects unknown clientId with structured validation error", async () => {
  const request = new Request("http://127.0.0.1:3000/api/engagements", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientId: "UNKNOWN-CLIENT-ID",
      companyName: "Unknown Client Co",
      objective: "Should fail",
    }),
  });

  const response = await createEngagement(request);
  const body = await response.json();

  assert.equal(response.status, 422);
  assert.equal(body.error, "Engagement validation failed.");
  assert.equal(Array.isArray(body.fieldErrors), true);
  assert.equal(body.fieldErrors.some((item: { path?: string; message?: string }) => item.path === "clientId"), true);
});

test("legacy engagement creation without clientId remains supported", async () => {
  const request = new Request("http://127.0.0.1:3000/api/engagements", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      companyName: "Legacy Engagement Co",
      objective: "Ensure no client association required",
    }),
  });

  const response = await createEngagement(request);
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.equal(typeof body.id, "string");
  assert.equal(body.clientId, undefined);

  try {
    const persisted = await loadProject(body.id);
    assert.equal(persisted.clientId, undefined);
  } finally {
    await cleanupProject(body.id);
  }
});

test("client detail route returns 404 for unknown id", async () => {
  const response = await getClientDetail(new Request("http://127.0.0.1:3000/api/clients/unknown"), {
    params: Promise.resolve({ clientId: "UNKNOWN-CLIENT-ID" }),
  });
  const body = await response.json();

  assert.equal(response.status, 404);
  assert.equal(body.error, "Client not found.");
});

test("client lifecycle actions archive, restore, and soft-delete without hard deletion", async () => {
  const createRequest = new Request("http://127.0.0.1:3000/api/clients", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Client Lifecycle Test Co",
      industry: "Services",
    }),
  });

  const createdResponse = await createClient(createRequest);
  const createdBody = await createdResponse.json();

  assert.equal(createdResponse.status, 201);

  try {
    const archiveResponse = await patchClientLifecycle(
      new Request(`http://127.0.0.1:3000/api/clients/${createdBody.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "archive" }),
      }),
      { params: Promise.resolve({ clientId: createdBody.id }) },
    );
    assert.equal(archiveResponse.status, 200);

    const defaultList = await (await getClients()).json();
    assert.equal(defaultList.some((client: { id?: string }) => client.id === createdBody.id), false);

    const archivedList = await (
      await getClients(new Request("http://127.0.0.1:3000/api/clients?includeArchived=true"))
    ).json();
    assert.equal(archivedList.some((client: { id?: string; lifecycleStatus?: string }) => client.id === createdBody.id && client.lifecycleStatus === "archived"), true);

    const restoreResponse = await patchClientLifecycle(
      new Request(`http://127.0.0.1:3000/api/clients/${createdBody.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore" }),
      }),
      { params: Promise.resolve({ clientId: createdBody.id }) },
    );
    assert.equal(restoreResponse.status, 200);

    const restoredList = await (await getClients()).json();
    assert.equal(restoredList.some((client: { id?: string }) => client.id === createdBody.id), true);

    const deleteResponse = await patchClientLifecycle(
      new Request(`http://127.0.0.1:3000/api/clients/${createdBody.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete" }),
      }),
      { params: Promise.resolve({ clientId: createdBody.id }) },
    );
    assert.equal(deleteResponse.status, 200);

    const deletedList = await (
      await getClients(new Request("http://127.0.0.1:3000/api/clients?includeDeleted=true"))
    ).json();
    assert.equal(deletedList.some((client: { id?: string; lifecycleStatus?: string }) => client.id === createdBody.id && client.lifecycleStatus === "deleted"), true);
  } finally {
    await cleanupClient(createdBody.id);
  }
});
