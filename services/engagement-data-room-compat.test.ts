import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { createEmptyProject } from "../src/schemas/projectSchema.js";
import { saveProject } from "../src/storage/projectStore.js";
import { addFileReference, loadClientDataRoom } from "./client-data-room-store";
import { GET as getEngagementDataRoom } from "../app/api/engagements/[id]/data-room/route";
import { POST as postEngagementDataRoom } from "../app/api/engagements/[id]/data-room/route";
import {
  GET as getEngagementFile,
  PATCH as patchEngagementFile,
  DELETE as deleteEngagementFile,
} from "../app/api/engagements/[id]/data-room/[fileId]/route";
import { GET as getEngagementFolders } from "../app/api/engagements/[id]/data-room/folders/route";

const projectStorageDir = path.resolve("data/projects");
const clientStorageDir = path.resolve("data/clients");

function uniqueId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

async function cleanupProject(id: string) {
  await fs.rm(path.join(projectStorageDir, `${id}.json`), { force: true });
}

async function cleanupClientDataRoom(clientId: string) {
  await fs.rm(path.join(clientStorageDir, `${clientId}-data-room.json`), { force: true });
}

test("engagement data-room list returns only files linked to engagement", async () => {
  const clientId = uniqueId("compat-client");
  const project = createEmptyProject({
    clientId,
    companyName: "Compat Co",
    objective: "Validate engagement compatibility listing",
  });

  await saveProject(project);

  try {
    const linked = await addFileReference(
      clientId,
      {
        name: "linked-file.pdf",
        mimeType: "application/pdf",
        size: 10_000,
        engagementIds: [project.id],
      },
      "tester",
      "/internal/linked-file.pdf"
    );

    await addFileReference(
      clientId,
      {
        name: "other-engagement.pdf",
        mimeType: "application/pdf",
        size: 10_000,
        engagementIds: ["OTHER-ENGAGEMENT"],
      },
      "tester",
      "/internal/other-engagement.pdf"
    );

    const response = await getEngagementDataRoom(
      new Request("http://127.0.0.1/api/engagements/id/data-room"),
      { params: Promise.resolve({ id: project.id }) }
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.engagementId, project.id);
    assert.equal(body.clientId, clientId);
    assert.equal(body.fileCount, 1);
    assert.equal(body.files[0].id, linked.id);
    assert.equal("storagePath" in body.files[0], false);
  } finally {
    await cleanupProject(project.id);
    await cleanupClientDataRoom(clientId);
  }
});

test("engagement file detail is constrained to same engagement linkage", async () => {
  const clientId = uniqueId("compat-client-detail");
  const project = createEmptyProject({
    clientId,
    companyName: "Compat Detail Co",
    objective: "Validate detail compatibility access",
  });

  await saveProject(project);

  try {
    const linked = await addFileReference(
      clientId,
      {
        name: "linked-detail.pdf",
        mimeType: "application/pdf",
        size: 10_000,
        engagementIds: [project.id],
      },
      "tester",
      "/internal/linked-detail.pdf"
    );

    const unlinked = await addFileReference(
      clientId,
      {
        name: "unlinked-detail.pdf",
        mimeType: "application/pdf",
        size: 10_000,
        engagementIds: ["OTHER-ENGAGEMENT"],
      },
      "tester",
      "/internal/unlinked-detail.pdf"
    );

    const okResponse = await getEngagementFile(
      new Request("http://127.0.0.1/api/engagements/id/data-room/file"),
      { params: Promise.resolve({ id: project.id, fileId: linked.id }) }
    );
    const okBody = await okResponse.json();

    const blockedResponse = await getEngagementFile(
      new Request("http://127.0.0.1/api/engagements/id/data-room/file"),
      { params: Promise.resolve({ id: project.id, fileId: unlinked.id }) }
    );

    assert.equal(okResponse.status, 200);
    assert.equal(okBody.id, linked.id);
    assert.equal("storagePath" in okBody, false);
    assert.equal(blockedResponse.status, 404);
  } finally {
    await cleanupProject(project.id);
    await cleanupClientDataRoom(clientId);
  }
});

test("engagement file patch and delete delegate to client-owned record", async () => {
  const clientId = uniqueId("compat-client-write");
  const project = createEmptyProject({
    clientId,
    companyName: "Compat Write Co",
    objective: "Validate update/delete compatibility path",
  });

  await saveProject(project);

  try {
    const linked = await addFileReference(
      clientId,
      {
        name: "mutable.pdf",
        mimeType: "application/pdf",
        size: 10_000,
        engagementIds: [project.id],
      },
      "tester",
      "/internal/mutable.pdf"
    );

    const patchResponse = await patchEngagementFile(
      new Request("http://127.0.0.1/api/engagements/id/data-room/file", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: "Updated from compatibility route", tags: ["compat"] }),
      }),
      { params: Promise.resolve({ id: project.id, fileId: linked.id }) }
    );
    const patchBody = await patchResponse.json();

    assert.equal(patchResponse.status, 200);
    assert.equal(patchBody.file.description, "Updated from compatibility route");
    assert.deepEqual(patchBody.file.tags, ["compat"]);

    const deleteResponse = await deleteEngagementFile(
      new Request("http://127.0.0.1/api/engagements/id/data-room/file", { method: "DELETE" }),
      { params: Promise.resolve({ id: project.id, fileId: linked.id }) }
    );

    assert.equal(deleteResponse.status, 200);

    const listResponse = await getEngagementDataRoom(
      new Request("http://127.0.0.1/api/engagements/id/data-room"),
      { params: Promise.resolve({ id: project.id }) }
    );
    const listBody = await listResponse.json();

    assert.equal(listResponse.status, 200);
    assert.equal(listBody.fileCount, 0);
  } finally {
    await cleanupProject(project.id);
    await cleanupClientDataRoom(clientId);
  }
});

test("engagement folders route returns client default folders", async () => {
  const clientId = uniqueId("compat-client-folders");
  const project = createEmptyProject({
    clientId,
    companyName: "Compat Folder Co",
    objective: "Validate folder compatibility route",
  });

  await saveProject(project);

  try {
    const response = await getEngagementFolders(
      new Request("http://127.0.0.1/api/engagements/id/data-room/folders"),
      { params: Promise.resolve({ id: project.id }) }
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.clientId, clientId);
    assert.equal(body.engagementId, project.id);
    assert.equal(Array.isArray(body.folders), true);
    assert.equal(body.folders.length >= 10, true);
    assert.equal(body.folders[0].clientId, clientId);
  } finally {
    await cleanupProject(project.id);
    await cleanupClientDataRoom(clientId);
  }
});

test("engagement data-room routes return 404 for unknown engagement", async () => {
  const response = await getEngagementDataRoom(
    new Request("http://127.0.0.1/api/engagements/unknown/data-room"),
    { params: Promise.resolve({ id: "UNKNOWN-ENGAGEMENT-ID" }) }
  );
  const body = await response.json();

  assert.equal(response.status, 404);
  assert.match(body.error, /Engagement not found:/);
});

test("engagement upload writes a single client-owned record without duplication", async () => {
  const clientId = uniqueId("compat-client-upload");
  const project = createEmptyProject({
    clientId,
    companyName: "Compat Upload Co",
    objective: "Validate no duplicate records on compatibility upload",
  });

  await saveProject(project);

  try {
    const form = new FormData();
    form.append("file", new File(["report body"], "report.txt", { type: "text/plain" }));
    form.append("type", "document");
    form.append("folderId", "misc");

    const response = await postEngagementDataRoom(
      new Request("http://127.0.0.1/api/engagements/id/data-room", {
        method: "POST",
        body: form,
      }) as any,
      { params: Promise.resolve({ id: project.id }) }
    );
    const body = await response.json();

    assert.equal(response.status, 201);
    assert.equal(body.clientId, clientId);
    assert.equal(body.engagementId, project.id);

    const room = await loadClientDataRoom(clientId);
    assert.equal(room.files.length, 1);
    assert.equal(room.files[0].clientId, clientId);
    assert.equal(room.files[0].engagementIds.includes(project.id), true);

    const engagementOwnedLegacyPath = path.join(clientStorageDir, `${project.id}-data-room.json`);
    const legacyExists = await fs
      .access(engagementOwnedLegacyPath)
      .then(() => true)
      .catch(() => false);

    assert.equal(legacyExists, false);
  } finally {
    await cleanupProject(project.id);
    await cleanupClientDataRoom(clientId);
  }
});
