import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { POST as postClientDataRoomFile } from "../app/api/clients/[clientId]/data-room/files/route";
import { createClient } from "../src/schemas/clientSchema.js";
import { saveClient } from "../src/storage/clientStore.js";

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
