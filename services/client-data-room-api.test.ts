import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { POST as postClientDataRoomFile } from "../app/api/clients/[clientId]/data-room/files/route";
import { POST as postClientProcess } from "../app/api/clients/[clientId]/data-room/files/[fileId]/process/route";
import { GET as getClientDocuments } from "../app/api/clients/[clientId]/data-room/documents/route";
import { createClient } from "../src/schemas/clientSchema.js";
import { saveClient } from "../src/storage/clientStore.js";
import { addFileReference } from "./client-data-room-store";

const clientStorageDir = path.resolve("data/clients");
const uploadStorageDir = path.resolve("data/uploads");

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
      .map((name) => fs.rm(path.join(uploadStorageDir, name), { force: true }))
  );
}

test("client data-room upload rejects unsupported MIME types", async () => {
  const client = createClient({ name: "Unsupported MIME Test Co" });
  await saveClient(client);

  try {
    const form = new FormData();
    form.append("file", new File(["dummy"], "script.js", { type: "application/javascript" }));

    const response = await postClientDataRoomFile(
      new Request(`http://127.0.0.1/api/clients/${client.id}/data-room/files`, {
        method: "POST",
        body: form,
      }) as any,
      { params: Promise.resolve({ clientId: client.id }) }
    );

    const body = await response.json();
    assert.equal(response.status, 400);
    assert.match(body.error, /File type not allowed/);
  } finally {
    await cleanupClient(client.id);
    await removeUploadArtifacts(client.id);
  }
});

test("client data-room upload rejects dangerous executable MIME type", async () => {
  const client = createClient({ name: "Dangerous MIME Test Co" });
  await saveClient(client);

  try {
    const form = new FormData();
    form.append("file", new File(["MZ"], "malware.exe", { type: "application/x-msdownload" }));

    const response = await postClientDataRoomFile(
      new Request(`http://127.0.0.1/api/clients/${client.id}/data-room/files`, {
        method: "POST",
        body: form,
      }) as any,
      { params: Promise.resolve({ clientId: client.id }) }
    );

    const body = await response.json();
    assert.equal(response.status, 400);
    assert.match(body.error, /File type not allowed/);
  } finally {
    await cleanupClient(client.id);
    await removeUploadArtifacts(client.id);
  }
});

test("client data-room processing creates safe document metadata", async () => {
  const client = createClient({ name: "Process Test Co" });
  await saveClient(client);

  try {
    const uploadPath = path.join(uploadStorageDir, `${client.id}-sample.txt`);
    await fs.mkdir(uploadStorageDir, { recursive: true });
    await fs.writeFile(uploadPath, "Revenue forecast improved by 19 percent for Q3.");

    const file = await addFileReference(
      client.id,
      {
        name: "sample.txt",
        mimeType: "text/plain",
        size: 64,
        approvedForAgentUse: true,
        sensitive: false,
      },
      "tester",
      uploadPath
    );

    const processResponse = await postClientProcess(
      new Request(`http://127.0.0.1/api/clients/${client.id}/data-room/files/${file.id}/process`, {
        method: "POST",
      }) as any,
      { params: Promise.resolve({ clientId: client.id, fileId: file.id }) }
    );

    const processBody = await processResponse.json();
    assert.equal(processResponse.status, 200);
    assert.equal(processBody.success, true);
    assert.equal(processBody.document.processingStatus, "completed");
    assert.equal("textExtracted" in processBody.document, false);

    const listResponse = await getClientDocuments(
      new Request(`http://127.0.0.1/api/clients/${client.id}/data-room/documents`),
      { params: Promise.resolve({ clientId: client.id }) }
    );
    const listBody = await listResponse.json();

    assert.equal(listResponse.status, 200);
    assert.equal(listBody.count, 1);
    assert.equal(listBody.documents[0].fileId, file.id);
    assert.equal("textExtracted" in listBody.documents[0], false);
  } finally {
    await cleanupClient(client.id);
    await removeUploadArtifacts(client.id);
  }
});

test("client data-room processing skips sensitive or unapproved files", async () => {
  const client = createClient({ name: "Process Policy Test Co" });
  await saveClient(client);

  try {
    const uploadPath = path.join(uploadStorageDir, `${client.id}-policy.txt`);
    await fs.mkdir(uploadStorageDir, { recursive: true });
    await fs.writeFile(uploadPath, "Sensitive board memo");

    const sensitiveFile = await addFileReference(
      client.id,
      {
        name: "sensitive.txt",
        mimeType: "text/plain",
        size: 22,
        approvedForAgentUse: true,
        sensitive: true,
      },
      "tester",
      uploadPath
    );

    const response = await postClientProcess(
      new Request(`http://127.0.0.1/api/clients/${client.id}/data-room/files/${sensitiveFile.id}/process`, {
        method: "POST",
      }) as any,
      { params: Promise.resolve({ clientId: client.id, fileId: sensitiveFile.id }) }
    );

    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.document.processingStatus, "skipped");
    assert.equal(body.document.extractionWarnings.includes("sensitive_file_skipped"), true);
  } finally {
    await cleanupClient(client.id);
    await removeUploadArtifacts(client.id);
  }
});
