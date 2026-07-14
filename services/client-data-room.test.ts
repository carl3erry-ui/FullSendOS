import { test } from "node:test";
import { strict as assert } from "node:assert";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  addFileReference,
  archiveFile,
  getFileReference,
  getFolders,
  linkFileToEngagement,
  listFiles,
  loadClientDataRoom,
  searchFiles,
  unlinkFileFromEngagement,
  updateFileMetadata,
} from "./client-data-room-store";
import { DEFAULT_FOLDERS, FileReferenceSafeSchema } from "../schemas/client-data-room";

const dataDir = path.resolve("data/clients");

function uniqueClient(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

async function cleanupClientDataRoom(clientId: string) {
  await fs.rm(path.join(dataDir, `${clientId}-data-room.json`), { force: true });
}

test("Client Data Room initializes for a client with default folders", async () => {
  const clientId = uniqueClient("cdr-init");

  try {
    const dataRoom = await loadClientDataRoom(clientId);
    assert.equal(dataRoom.clientId, clientId);
    assert.equal(dataRoom.files.length, 0);
    assert.equal(dataRoom.fileCount, 0);
    assert.equal(dataRoom.totalSize, 0);
    assert.equal(dataRoom.folders.length, DEFAULT_FOLDERS.length);
    assert.ok(dataRoom.createdAt);
    assert.ok(dataRoom.updatedAt);
  } finally {
    await cleanupClientDataRoom(clientId);
  }
});

test("Default folders preserve stable IDs and sorted order", async () => {
  const clientId = uniqueClient("cdr-folders");

  try {
    const folders = await getFolders(clientId);
    assert.equal(folders.length, DEFAULT_FOLDERS.length);
    assert.deepEqual(
      folders.map((folder) => folder.id),
      DEFAULT_FOLDERS.map((folder) => folder.id)
    );
    assert.deepEqual(
      folders.map((folder) => folder.sortOrder),
      [...folders].map((folder) => folder.sortOrder).sort((a, b) => a - b)
    );
    assert.equal(folders.every((folder) => folder.clientId === clientId), true);
  } finally {
    await cleanupClientDataRoom(clientId);
  }
});

test("Client-level upload stores clientId and folder metadata", async () => {
  const clientId = uniqueClient("cdr-upload");

  try {
    const fileRef = await addFileReference(
      clientId,
      {
        name: "financials-q1.pdf",
        mimeType: "application/pdf",
        size: 42_000,
        folderId: "financials",
        description: "Quarterly financial report",
        tags: ["q1", "finance"],
        type: "financial",
      },
      "test-user",
      "/internal/test/financials-q1.pdf"
    );

    assert.equal(fileRef.clientId, clientId);
    assert.equal(fileRef.folderId, "financials");
    assert.equal(fileRef.type, "financial");
    assert.deepEqual(fileRef.tags, ["q1", "finance"]);
    assert.equal(fileRef.isArchived, false);
  } finally {
    await cleanupClientDataRoom(clientId);
  }
});

test("Client file list returns all non-archived files", async () => {
  const clientId = uniqueClient("cdr-list");

  try {
    await addFileReference(
      clientId,
      {
        name: "one.pdf",
        mimeType: "application/pdf",
        size: 10_000,
      },
      "user",
      "/internal/one.pdf"
    );

    await addFileReference(
      clientId,
      {
        name: "two.pdf",
        mimeType: "application/pdf",
        size: 20_000,
      },
      "user",
      "/internal/two.pdf"
    );

    const files = await listFiles(clientId);
    assert.equal(files.length, 2);
  } finally {
    await cleanupClientDataRoom(clientId);
  }
});

test("Filtering by folderId returns only folder-matching files", async () => {
  const clientId = uniqueClient("cdr-folder-filter");

  try {
    await addFileReference(
      clientId,
      {
        name: "brand-logo.png",
        mimeType: "image/png",
        size: 6_000,
        folderId: "brand",
      },
      "user",
      "/internal/brand-logo.png"
    );

    await addFileReference(
      clientId,
      {
        name: "legal-contract.pdf",
        mimeType: "application/pdf",
        size: 12_000,
        folderId: "legal",
      },
      "user",
      "/internal/legal-contract.pdf"
    );

    const brandFiles = await listFiles(clientId, { folderId: "brand" });
    assert.equal(brandFiles.length, 1);
    assert.equal(brandFiles[0].folderId, "brand");
  } finally {
    await cleanupClientDataRoom(clientId);
  }
});

test("File can be linked and unlinked to engagement IDs", async () => {
  const clientId = uniqueClient("cdr-link");
  const engagementId = "ENG-LINK-001";

  try {
    const file = await addFileReference(
      clientId,
      {
        name: "brief.txt",
        mimeType: "text/plain",
        size: 2_000,
      },
      "user",
      "/internal/brief.txt"
    );

    const linked = await linkFileToEngagement(clientId, file.id, engagementId);
    assert.equal(linked.engagementIds.includes(engagementId), true);

    const linkedAgain = await linkFileToEngagement(clientId, file.id, engagementId);
    assert.equal(linkedAgain.engagementIds.filter((id) => id === engagementId).length, 1);

    const unlinked = await unlinkFileFromEngagement(clientId, file.id, engagementId);
    assert.equal(unlinked.engagementIds.includes(engagementId), false);
  } finally {
    await cleanupClientDataRoom(clientId);
  }
});

test("Filtering by engagementId returns only linked files", async () => {
  const clientId = uniqueClient("cdr-engagement-filter");

  try {
    const linked = await addFileReference(
      clientId,
      {
        name: "linked.pdf",
        mimeType: "application/pdf",
        size: 9_000,
        engagementIds: ["ENG-1"],
      },
      "user",
      "/internal/linked.pdf"
    );

    await addFileReference(
      clientId,
      {
        name: "unlinked.pdf",
        mimeType: "application/pdf",
        size: 9_000,
      },
      "user",
      "/internal/unlinked.pdf"
    );

    const files = await listFiles(clientId, { engagementId: "ENG-1" });
    assert.equal(files.length, 1);
    assert.equal(files[0].id, linked.id);
  } finally {
    await cleanupClientDataRoom(clientId);
  }
});

test("getFileReference returns null for missing files", async () => {
  const clientId = uniqueClient("cdr-get");

  try {
    const missing = await getFileReference(clientId, "missing-id");
    assert.equal(missing, null);
  } finally {
    await cleanupClientDataRoom(clientId);
  }
});

test("Safe schema omits storagePath from API-safe metadata", async () => {
  const clientId = uniqueClient("cdr-safe");

  try {
    const file = await addFileReference(
      clientId,
      {
        name: "safe-test.pdf",
        mimeType: "application/pdf",
        size: 4_000,
      },
      "user",
      "/internal/safe-test.pdf"
    );

    const safe = FileReferenceSafeSchema.parse(file);
    assert.equal("storagePath" in safe, false);
    assert.equal(safe.clientId, clientId);
  } finally {
    await cleanupClientDataRoom(clientId);
  }
});

test("updateFileMetadata supports engagementIds and policy flags", async () => {
  const clientId = uniqueClient("cdr-update");

  try {
    const file = await addFileReference(
      clientId,
      {
        name: "policy.docx",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        size: 5_000,
      },
      "user",
      "/internal/policy.docx"
    );

    const updated = await updateFileMetadata(clientId, file.id, {
      description: "Updated",
      tags: ["legal", "approved"],
      type: "contract",
      engagementIds: ["ENG-77"],
      approvedForAgentUse: true,
      sensitive: true,
    });

    assert.equal(updated.description, "Updated");
    assert.deepEqual(updated.tags, ["legal", "approved"]);
    assert.equal(updated.type, "contract");
    assert.deepEqual(updated.engagementIds, ["ENG-77"]);
    assert.equal(updated.approvedForAgentUse, true);
    assert.equal(updated.sensitive, true);
  } finally {
    await cleanupClientDataRoom(clientId);
  }
});

test("archiveFile soft-deletes and updates aggregate counts", async () => {
  const clientId = uniqueClient("cdr-archive");

  try {
    const file = await addFileReference(
      clientId,
      {
        name: "archive.pdf",
        mimeType: "application/pdf",
        size: 30_000,
      },
      "user",
      "/internal/archive.pdf"
    );

    let dataRoom = await loadClientDataRoom(clientId);
    assert.equal(dataRoom.fileCount, 1);
    assert.equal(dataRoom.totalSize, 30_000);

    await archiveFile(clientId, file.id);

    dataRoom = await loadClientDataRoom(clientId);
    assert.equal(dataRoom.fileCount, 0);
    assert.equal(dataRoom.totalSize, 0);

    const listed = await listFiles(clientId);
    assert.equal(listed.length, 0);
  } finally {
    await cleanupClientDataRoom(clientId);
  }
});

test("searchFiles supports tags, name, type, folder and engagement filters", async () => {
  const clientId = uniqueClient("cdr-search");

  try {
    await addFileReference(
      clientId,
      {
        name: "market-research-2026.pdf",
        mimeType: "application/pdf",
        size: 8_000,
        type: "research",
        tags: ["market", "north-america"],
        folderId: "marketing",
        engagementIds: ["ENG-A"],
      },
      "user",
      "/internal/market-research-2026.pdf"
    );

    await addFileReference(
      clientId,
      {
        name: "employment-policy.pdf",
        mimeType: "application/pdf",
        size: 8_000,
        type: "document",
        tags: ["hr"],
        folderId: "hr",
      },
      "user",
      "/internal/employment-policy.pdf"
    );

    const results = await searchFiles(clientId, {
      tags: ["market"],
      name: "research",
      type: "research",
      folderId: "marketing",
      engagementId: "ENG-A",
    });

    assert.equal(results.length, 1);
    assert.equal(results[0].name, "market-research-2026.pdf");
  } finally {
    await cleanupClientDataRoom(clientId);
  }
});

test("addFileReference rejects unknown folderId", async () => {
  const clientId = uniqueClient("cdr-folder-missing");

  try {
    await assert.rejects(
      () =>
        addFileReference(
          clientId,
          {
            name: "bad-folder.pdf",
            mimeType: "application/pdf",
            size: 1_000,
            folderId: "does-not-exist",
          },
          "user",
          "/internal/bad-folder.pdf"
        ),
      /Folder not found/
    );
  } finally {
    await cleanupClientDataRoom(clientId);
  }
});

test("file size validation rejects oversized files", async () => {
  const clientId = uniqueClient("cdr-size");
  const maxFileSize = 100 * 1024 * 1024;

  try {
    await assert.rejects(
      () =>
        addFileReference(
          clientId,
          {
            name: "huge.bin",
            mimeType: "application/octet-stream",
            size: maxFileSize + 1,
          },
          "user",
          "/internal/huge.bin"
        ),
      /exceeds maximum size/
    );
  } finally {
    await cleanupClientDataRoom(clientId);
  }
});

test("client storage quota validation rejects overflow", async () => {
  const clientId = uniqueClient("cdr-quota");
  const maxFileSize = 100 * 1024 * 1024;

  try {
    for (let index = 0; index < 51; index += 1) {
      await addFileReference(
        clientId,
        {
          name: `near-limit-${index}.bin`,
          mimeType: "application/octet-stream",
          size: maxFileSize,
        },
        "user",
        `/internal/near-limit-${index}.bin`
      );
    }

    await assert.rejects(
      () =>
        addFileReference(
          clientId,
          {
            name: "overflow.bin",
            mimeType: "application/octet-stream",
            size: 30 * 1024 * 1024,
          },
          "user",
          "/internal/overflow.bin"
        ),
      /quota exceeded/
    );
  } finally {
    await cleanupClientDataRoom(clientId);
  }
});
