import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { GET as listHumanInputRoute, POST as createHumanInputRoute } from "../app/api/human-input/route";
import { GET as getClientHumanInputRoute } from "../app/api/clients/[clientId]/human-input/route";
import { GET as getEngagementHumanInputRoute } from "../app/api/engagements/[id]/human-input/route";
import { POST as createProjectRunRoute } from "../app/api/projects/[id]/run/route";
import { POST as createProjectRoute } from "../app/api/projects/route";
import { listHumanInputRequests } from "./human-input-service";

const projectStorageDir = join(process.cwd(), "data", "projects");
const requestStorageDir = join(process.cwd(), "data", "human-input-requests");
const taskStorageDir = join(process.cwd(), "data", "agent-tasks");

async function cleanupProject(projectId: string) {
  await rm(join(projectStorageDir, `${projectId}.json`), { force: true });
}

async function cleanupRequest(requestId: string) {
  await rm(join(requestStorageDir, `${requestId}.json`), { force: true });
}

async function cleanupTask(taskId: string) {
  await rm(join(taskStorageDir, `${taskId}.json`), { force: true });
}

async function createProject(payload: Record<string, unknown>) {
  const response = await createProjectRoute(
    new Request("http://localhost/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  );

  assert.equal(response.status, 201);
  const body = (await response.json()) as { id: string; audit?: { warnings?: string[] } };
  return body;
}

test("Human input API creates and lists safe metadata only", async () => {
  const created = await createHumanInputRoute(
    new Request("http://localhost/api/human-input", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: "client-a",
        engagementId: "eng-a",
        type: "missing_information",
        title: "Confirm address",
        prompt: "Please confirm the business address.",
        priority: "high",
        requestedBy: "admin",
        relatedField: "address",
        requiredToContinue: true,
        options: [],
        evidence: [],
        sourceReferences: [],
        metadata: {},
      }),
    }),
  );

  assert.equal(created.status, 201);
  const createdBody = (await created.json()) as { data: { id: string } };

  const list = await listHumanInputRoute(new Request("http://localhost/api/human-input?openOnly=true"));
  assert.equal(list.status, 200);
  const listBody = (await list.json()) as { data: Array<Record<string, unknown>> };
  assert.ok(Array.isArray(listBody.data));
  assert.equal(listBody.data.some((request) => request.id === createdBody.data.id), true);
  const serialized = JSON.stringify(listBody.data[0] || {});
  assert.equal(serialized.includes("systemPrompt"), false);
  assert.equal(serialized.includes("rawProviderPayload"), false);

  await cleanupRequest(createdBody.data.id);
});

test("Smart intake creates an enrichment request for Hardware Brewery and keeps workflow runnable", async () => {
  const created = await createProject({
    companyName: "Hardware Brewery",
    website: "https://hardwarebrewery.com",
    objective: "Acquisition / real estate evaluation",
  });

  const requests = await listHumanInputRequests({ engagementId: created.id, openOnly: true });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].relatedField, "address");
  assert.equal(requests[0].requiredToContinue, false);
  assert.match(requests[0].prompt, /confirm the business address/i);
  assert.equal(Array.isArray(created.audit?.warnings), true);
  assert.equal((created.audit?.warnings || []).some((warning) => /confirm the business address/i.test(warning)), true);

  const run = await createProjectRunRoute(
    new Request(`http://localhost/api/projects/${created.id}/run`, { method: "POST" }),
    { params: Promise.resolve({ id: created.id }) },
  );

  assert.equal(run.status, 202);

  if (requests[0].agentTaskId) {
    await cleanupTask(requests[0].agentTaskId);
  }
  await cleanupRequest(requests[0].id);
  await cleanupProject(created.id);
});

test("Missing strong anchors create a blocking human input request and pause workflow launch", async () => {
  const created = await createProject({
    companyName: "Hardware Brewery",
    objective: "Acquisition / real estate evaluation",
  });

  const requests = await listHumanInputRequests({ engagementId: created.id, openOnly: true });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].requiredToContinue, true);
  assert.equal(requests[0].relatedField, "website");

  const run = await createProjectRunRoute(
    new Request(`http://localhost/api/projects/${created.id}/run`, { method: "POST" }),
    { params: Promise.resolve({ id: created.id }) },
  );

  assert.equal(run.status, 409);
  const body = (await run.json()) as { blockingRequests?: Array<{ id: string }> };
  assert.equal(Array.isArray(body.blockingRequests), true);
  assert.equal(body.blockingRequests?.length, 1);

  await cleanupRequest(requests[0].id);
  await cleanupProject(created.id);
});

test("Client and engagement human input endpoints return safe filtered records", async () => {
  const created = await createHumanInputRoute(
    new Request("http://localhost/api/human-input", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: "client-safe",
        engagementId: "eng-safe",
        type: "clarification",
        title: "Clarify ownership",
        prompt: "Please clarify ownership details.",
        priority: "medium",
        requestedBy: "admin",
        requiredToContinue: false,
        options: [],
        evidence: [],
        sourceReferences: [],
        metadata: {},
      }),
    }),
  );

  const createdBody = (await created.json()) as { data: { id: string; clientId?: string; engagementId?: string } };
  const clientRes = await getClientHumanInputRoute(new Request("http://localhost/api/clients/client-safe/human-input"), {
    params: Promise.resolve({ clientId: "client-safe" }),
  });
  const clientBody = (await clientRes.json()) as { data: Array<Record<string, unknown>> };
  assert.equal(clientRes.status, 200);
  assert.equal(clientBody.data.length, 1);

  const engagementRes = await getEngagementHumanInputRoute(new Request("http://localhost/api/engagements/eng-safe/human-input"), {
    params: Promise.resolve({ id: "eng-safe" }),
  });
  const engagementBody = (await engagementRes.json()) as { data: Array<Record<string, unknown>> };
  assert.equal(engagementRes.status, 200);
  assert.equal(engagementBody.data.length, 1);

  await cleanupRequest(createdBody.data.id);
});
